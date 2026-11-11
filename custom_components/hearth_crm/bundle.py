"""The Hearth bundle: the integration's only import/export format.

A bundle is a zip holding ``bundle.json`` (format, version, ``exported_at``, ``me_person_id`` and
every table, as produced by ``serialize.data_to_dict``) plus ``photos/<sha256>`` image files.
"""

from __future__ import annotations

import hashlib
import json
import re
import zipfile
import zlib
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .models import CRMData, Reminder
from .reminders import MAX_REPEAT_EVERY, MIN_REPEAT_EVERY
from .serialize import data_from_dict, data_to_dict

BUNDLE_FORMAT = "hearth-bundle"
BUNDLE_VERSION = 1
MAX_UNCOMPRESSED_BYTES = 1_073_741_824

_JSON_NAME = "bundle.json"
_PHOTO_PREFIX = "photos/"
_HASH_RE = re.compile(r"[0-9a-f]{64}")
_PHOTO_MEMBER_RE = re.compile(r"photos/([0-9a-f]{64})")
_META_KEYS = ("format", "version", "exported_at", "me_person_id")


@dataclass
class Bundle:
    data: CRMData
    me_person_id: str | None
    photos: dict[str, bytes]


class BundleError(Exception):
    """A bundle is unreadable or inconsistent; ``problems`` lists every issue found."""

    def __init__(self, problems: list[str]) -> None:
        self.problems = list(problems)
        super().__init__("; ".join(self.problems))


def _referenced_hashes(data: CRMData) -> set[str]:
    rows = [*data.people, *data.households, *data.groups]
    return {r.photo_hash for r in rows if r.photo_hash}


def write_bundle(
    path: Path,
    data: CRMData,
    photo_bytes: Callable[[str], bytes],
    *,
    me_person_id: str | None = None,
) -> None:
    """Write ``data`` and every referenced photo to ``path`` (all or nothing).

    ``photo_bytes(hash)`` supplies image bytes; if it raises, or returns bytes that do not hash to
    the name asked for, nothing is left behind at ``path`` (an existing file there is untouched).
    """
    hashes = sorted(_referenced_hashes(data))
    for photo_hash in hashes:
        if not _HASH_RE.fullmatch(photo_hash):
            raise ValueError(f"invalid photo hash: {photo_hash!r}")

    document = {
        "format": BUNDLE_FORMAT,
        "version": BUNDLE_VERSION,
        "exported_at": datetime.now(UTC).isoformat(),
        "me_person_id": me_person_id,
        **data_to_dict(data),
    }
    tmp = path.with_name(path.name + ".tmp")
    try:
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(_JSON_NAME, json.dumps(document, indent=2, allow_nan=False))
            for photo_hash in hashes:
                content = photo_bytes(photo_hash)
                if hashlib.sha256(content).hexdigest() != photo_hash:
                    raise ValueError(f"photo bytes do not match hash {photo_hash}")
                zf.writestr(f"{_PHOTO_PREFIX}{photo_hash}", content)
        tmp.replace(path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def read_bundle(path: Path) -> Bundle:
    """Read and fully validate a bundle, raising one ``BundleError`` listing every problem."""
    try:
        zf = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as err:
        raise BundleError([f"not a readable zip file: {err}"]) from None
    with zf:
        return _read(zf)


def _read(zf: zipfile.ZipFile) -> Bundle:
    problems: list[str] = []
    infos = zf.infolist()

    total = sum(i.file_size for i in infos)
    if total > MAX_UNCOMPRESSED_BYTES:
        raise BundleError(
            [f"bundle is too large: {total} bytes uncompressed exceeds the limit of "
             f"{MAX_UNCOMPRESSED_BYTES}"]
        )

    names = [i.filename for i in infos]
    for name, count in Counter(names).items():
        if count > 1:
            problems.append(f"duplicate zip member: {name!r}")
    photo_names: dict[str, str] = {}  # hash -> member name
    for name in dict.fromkeys(names):
        if name == _JSON_NAME:
            continue
        match = _PHOTO_MEMBER_RE.fullmatch(name)
        if match:
            photo_names[match.group(1)] = name
        else:
            problems.append(f"unexpected zip member: {name!r}")

    document = _load_document(zf, names, problems)
    if document is None:
        raise BundleError(problems)

    version = document.get("version")
    bad_header = False
    if document.get("format") != BUNDLE_FORMAT:
        problems.append(f"wrong format: expected {BUNDLE_FORMAT!r}, got {document.get('format')!r}")
        bad_header = True
    if isinstance(version, bool) or version != BUNDLE_VERSION:
        problems.append(f"unsupported version: expected {BUNDLE_VERSION}, got {version!r}")
        bad_header = True
    if bad_header:  # the rest of the document may not have the shape we expect
        raise BundleError(problems)

    photos: dict[str, bytes] = {}
    for photo_hash, name in photo_names.items():
        content = _read_member(zf, name, problems)
        if content is None:
            continue
        if hashlib.sha256(content).hexdigest() != photo_hash:
            problems.append(f"photo {photo_hash} does not match its sha256 name")
        else:
            photos[photo_hash] = content

    exported_at = document.get("exported_at")
    try:
        if not isinstance(exported_at, str) or datetime.fromisoformat(exported_at).tzinfo is None:
            raise ValueError
    except ValueError:
        problems.append(f"exported_at must be a timezone-aware ISO-8601 timestamp, got {exported_at!r}")
    me_person_id = document.get("me_person_id")
    if me_person_id is not None and not isinstance(me_person_id, str):
        problems.append(f"me_person_id must be a string or null, got {me_person_id!r}")
        me_person_id = None

    try:
        data = data_from_dict({k: v for k, v in document.items() if k not in _META_KEYS})
    except (ValueError, OverflowError) as err:
        problems.append(str(err))
        raise BundleError(problems) from None

    problems.extend(_reference_problems(data, me_person_id, set(photo_names), set(photos)))
    if problems:
        raise BundleError(problems)
    return Bundle(data=data, me_person_id=me_person_id, photos=photos)


def _read_member(zf: zipfile.ZipFile, name: str, problems: list[str]) -> bytes | None:
    """Read one member; any decompression or IO failure becomes a problem."""
    try:
        return zf.read(name)
    except (zlib.error, EOFError, zipfile.BadZipFile, OSError, RuntimeError, ValueError) as err:
        problems.append(f"cannot read {name!r}: {err}")
        return None


def _load_document(zf: zipfile.ZipFile, names: list[str], problems: list[str]) -> dict | None:
    if _JSON_NAME not in names:
        problems.append(f"{_JSON_NAME} is missing")
        return None
    raw = _read_member(zf, _JSON_NAME, problems)
    if raw is None:
        return None
    try:
        document = json.loads(raw)
    except ValueError as err:
        problems.append(f"{_JSON_NAME} is not valid JSON: {err}")
        return None
    if not isinstance(document, dict):
        problems.append(f"{_JSON_NAME} must hold a JSON object")
        return None
    return document


def _schedule_problems(m: Reminder) -> list[str]:
    """What the service would never save, and the scheduler cannot work from."""
    problems: list[str] = []
    if (m.repeat_every is None) != (m.repeat_unit is None):
        problems.append(f"reminder {m.id!r} has a repeat number or unit without the other")
    if m.repeat_every is not None and not MIN_REPEAT_EVERY <= m.repeat_every <= MAX_REPEAT_EVERY:
        problems.append(
            f"reminder {m.id!r} repeats every {m.repeat_every}: it must be between "
            f"{MIN_REPEAT_EVERY} and {MAX_REPEAT_EVERY}"
        )
    if m.repeat_every is not None or m.repeat_unit is not None:
        for field in ("due_at", "anchor_at"):
            if getattr(m, field) is None:
                problems.append(f"reminder {m.id!r} repeats without {field}")
    if m.due_at is None:
        for field in ("anchor_at", "notified_for"):
            if getattr(m, field) is not None:
                problems.append(f"reminder {m.id!r} has {field} without due_at")
    return problems


def _reference_problems(
    data: CRMData, me_person_id: str | None, present: set[str], valid: set[str]
) -> list[str]:
    problems: list[str] = []
    tables = {
        "people": data.people,
        "households": data.households,
        "groups": data.groups,
        "relationships": data.relationships,
        "interactions": data.interactions,
        "reminders": data.reminders,
    }
    for table, rows in tables.items():
        for pid, count in Counter(r.id for r in rows).items():
            if count > 1:
                problems.append(f"duplicate id {pid!r} in {table}")
    for pair, count in Counter(data.group_members).items():
        if count > 1:
            problems.append(f"duplicate group member {list(pair)!r}")

    people = {p.id for p in data.people}
    households = {h.id for h in data.households}
    groups = {g.id for g in data.groups}

    for p in data.people:
        if p.household_id is not None and p.household_id not in households:
            problems.append(f"person {p.id!r} references missing household {p.household_id!r}")
    for group_id, person_id in data.group_members:
        if group_id not in groups:
            problems.append(f"group member [{group_id!r}, {person_id!r}] references missing group")
        if person_id not in people:
            problems.append(f"group member [{group_id!r}, {person_id!r}] references missing person")
    for r in data.relationships:
        if r.person_a_id == r.person_b_id:
            problems.append(f"relationship {r.id!r} relates person {r.person_a_id!r} to themselves")
        for person_id in (r.person_a_id, r.person_b_id):
            if person_id not in people:
                problems.append(f"relationship {r.id!r} references missing person {person_id!r}")
    for i in data.interactions:
        if not i.person_ids:
            problems.append(f"interaction {i.id!r} has no people")
        for person_id in i.person_ids:
            if person_id not in people:
                problems.append(f"interaction {i.id!r} references missing person {person_id!r}")
    interactions = {i.id for i in data.interactions}
    for m in data.reminders:
        if m.person_id not in people:
            problems.append(f"reminder {m.id!r} references missing person {m.person_id!r}")
        if m.interaction_id is not None and m.interaction_id not in interactions:
            problems.append(
                f"reminder {m.id!r} references missing interaction {m.interaction_id!r}"
            )
        problems.extend(_schedule_problems(m))
    if me_person_id is not None and me_person_id not in people:
        problems.append(f"me_person_id references missing person {me_person_id!r}")

    referenced = _referenced_hashes(data)
    for photo_hash in sorted(referenced - present):
        problems.append(f"referenced photo {photo_hash} is missing from the bundle")
    for photo_hash in sorted(present - referenced):
        problems.append(f"unreferenced photo {photo_hash}")
    return problems
