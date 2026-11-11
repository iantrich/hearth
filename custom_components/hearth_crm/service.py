"""HearthService: the one path every write takes (no Home Assistant imports).

It validates input, assigns IDs and timestamps, processes photos and owns the settings. It is
synchronous; Home Assistant code calls it in the executor.
"""

from __future__ import annotations

import dataclasses
import io
import json
import re
import sqlite3
import threading
import warnings
from contextlib import contextmanager
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING, Any, Literal
from uuid import uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

from .db import (
    IMPORT_SOURCE,
    META_GOOGLE_LINK_VERIFIED,
    META_GOOGLE_SYNC,
    META_ME_PERSON,
    META_NOTIFICATIONS,
    CRMRepository,
    DeleteResult,
)
from .db_entities import EntityKind
from . import reminders
from .derive import build_snapshot, reminder_row
from .google_payload import ERROR_CONTACT_MISSING, ERROR_CREATE_UNCERTAIN
from .models import (
    ContactGroup,
    CRMData,
    Household,
    Interaction,
    Person,
    Relationship,
    Reminder,
)
from .photos import PhotoStore
from .serialize import (
    group_from_dict,
    household_from_dict,
    interaction_from_dict,
    person_from_dict,
    relationship_from_dict,
    reminder_from_dict,
    to_dict,
)

if TYPE_CHECKING:
    from .bundle import Bundle

PHOTO_MAX_EDGE = 1024
PHOTO_JPEG_QUALITY = 85
# The largest upload: what the websocket's 4,000,000 base64 characters decode to. Home
# Assistant closes websocket connections whose messages exceed about 4 MiB.
MAX_PHOTO_BYTES = 3_000_000
MAX_PHOTO_PIXELS = 40_000_000
PHOTO_FORMATS = ["JPEG", "PNG", "GIF", "WEBP"]

PhotoKind = Literal["person", "household", "contact_group"]

_NOT_EDITABLE = frozenset({
    "id", "created_at", "updated_at", "photo_hash", "google_contact_id",
    "google_synced_at", "google_photo_hash", "google_sync_error",
    "anchor_at", "notified_for", "done_at",
})
_FROM_DICT: dict[str, Callable[[dict[str, Any]], Any]] = {
    "person": person_from_dict,
    "household": household_from_dict,
    "contact_group": group_from_dict,
    "relationship": relationship_from_dict,
    "interaction": interaction_from_dict,
    "reminder": reminder_from_dict,
}
_MODELS = {
    "person": Person,
    "household": Household,
    "contact_group": ContactGroup,
    "relationship": Relationship,
    "interaction": Interaction,
    "reminder": Reminder,
}
_GROUP_MEMBERS = "member_ids"


# The birthday and log nudges start switched off, at times in Home Assistant's time zone.
# Reminders fire when each one is due, so that switch has no time and starts on.
DEFAULT_NOTIFICATIONS = {
    "birthdays": {"enabled": False, "time": "09:00"},
    "log_reminder": {"enabled": False, "time": "20:00"},
    "reminders": {"enabled": True},
}
_CLOCK_TIME = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


class Unset:
    """The type of ``UNSET``: "leave this field as it is" (``None`` means "clear it")."""

    def __repr__(self) -> str:
        return "UNSET"


UNSET = Unset()


class GoogleSyncRefused(Exception):
    """The Google sync cannot be switched on yet."""


class NotBlocked(Exception):
    """The person's Google link can only be cleared while the sync is blocked on them."""


class NotFound(Exception):
    """The entity does not exist."""

    def __init__(self, kind: str, entity_id: str) -> None:
        super().__init__(f"{kind} {entity_id!r} does not exist")
        self.kind = kind
        self.entity_id = entity_id


class InvalidInput(Exception):
    """A field was rejected; ``field`` names it."""

    def __init__(self, field: str, message: str) -> None:
        super().__init__(f"{field}: {message}")
        self.field = field
        self.message = message


class StorageError(Exception):
    """The database could not complete a write."""


@contextmanager
def _db_errors() -> Iterator[None]:
    try:
        yield
    except sqlite3.IntegrityError:
        raise InvalidInput("fields", "refers to something that no longer exists") from None
    except sqlite3.Error as err:
        raise StorageError(f"could not save ({type(err).__name__})") from None


MAX_TEXT_LENGTHS: dict[str, int] = {
    "name": 200,
    "name_override": 200,
    "phone": 50,
    "phone2": 50,
    "email": 500,
    "email2": 500,
    "website": 500,
    "linkedin": 500,
    "facebook": 500,
    "instagram": 500,
    "occupation": 300,
    "employer": 300,
    "summary": 300,
    "how_i_know_them": 2_000,
    "formatted": 1_000,
    "notes": 20_000,
    "note": 20_000,
    "relationship_summary": 20_000,
    "description": 20_000,
}


def _check_lengths(fields: dict) -> None:
    """Refuse over-long text in the fields an edit supplies (imports are not checked)."""

    def check(field: str, value: Any, limit_name: str) -> None:
        limit = MAX_TEXT_LENGTHS.get(limit_name)
        if limit is not None and isinstance(value, str) and len(value) > limit:
            raise InvalidInput(field, f"is longer than {limit} characters")

    for key, value in fields.items():
        if isinstance(value, dict):  # a place: only its text is limited, named by the place field
            check(key, value.get("formatted"), "formatted")
        else:
            check(key, value, key)


def _check_id(entity_id: Any) -> None:
    if not isinstance(entity_id, str) or not entity_id:
        raise InvalidInput("id", "expected a non-empty string")


def _editable_fields(kind: str) -> set[str]:
    names = {f.name for f in dataclasses.fields(_MODELS[kind])} - _NOT_EDITABLE
    if kind == "contact_group":
        names.add(_GROUP_MEMBERS)
    return names


class HearthService:
    """Validated reads and writes over one CRM."""

    def __init__(
        self,
        repo: CRMRepository,
        photos: PhotoStore,
        *,
        today: Callable[[], date],
        now: Callable[[], datetime] = lambda: datetime.now().astimezone(),
        new_id: Callable[[], str] = lambda: str(uuid4()),
    ) -> None:
        self._repo = repo
        self._photos = photos
        self._today = today
        self._now = now
        self._new_id = new_id
        self._write_lock = threading.Lock()

    def snapshot(self) -> dict:
        return build_snapshot(
            self._repo.snapshot(),
            me_person_id=self._repo.get_meta(META_ME_PERSON),
            today=self._today(),
            tz=self._now().tzinfo,
        )

    def reminder_row(self, reminder_id: str) -> dict:
        """The snapshot row of one saved reminder (state and local strings included)."""
        reminder = self._require("reminder", reminder_id)
        return reminder_row(reminder, self._today(), self._now().tzinfo)

    # -- writes ---------------------------------------------------------

    def create(self, kind: EntityKind, fields: dict, source: str) -> dict:
        """Add an entity from its editable fields; returns the saved entity."""
        self._check_fields(kind, fields)
        _check_lengths(fields)
        with self._write_lock:
            now = datetime.now(UTC).isoformat()
            raw = {"id": self._new_id(), "created_at": now, "updated_at": now} | {
                k: v for k, v in fields.items() if k != _GROUP_MEMBERS
            }
            if kind == "person" and raw.get("relationship_summary") and "summary_updated" not in fields:
                raw["summary_updated"] = self._today().isoformat()
            if kind == "reminder":
                self._localize_due(raw)
            entity = self._decode(kind, raw)
            if kind == "reminder":
                entity.anchor_at = entity.due_at
            members = self._members(kind, fields)
            self._check_references(kind, entity, members)
            with _db_errors():
                if kind == "contact_group":
                    self._repo.save_group(entity, members, source, create=True)
                else:
                    self._repo.insert(kind, entity, source)
            return self._saved(kind, entity)

    def update(self, kind: EntityKind, entity_id: str, changes: dict, source: str) -> dict:
        """Change some editable fields of an entity; returns the saved entity."""
        self._check_fields(kind, changes)
        _check_lengths(changes)
        _check_id(entity_id)
        with self._write_lock:
            existing = self._repo.get(kind, entity_id)
            if existing is None:
                raise NotFound(kind, entity_id)
            if kind == "reminder" and existing.done_at is not None:
                raise InvalidInput("reminder", "a done reminder cannot be edited")
            raw = to_dict(existing) | {k: v for k, v in changes.items() if k != _GROUP_MEMBERS}
            if kind == "reminder":
                self._localize_due(raw)
            raw["updated_at"] = datetime.now(UTC).isoformat()
            if (
                kind == "person"
                and "relationship_summary" in changes
                and "summary_updated" not in changes
                and changes["relationship_summary"] != existing.relationship_summary
            ):
                raw["summary_updated"] = self._today().isoformat()
            entity = self._decode(kind, raw)
            if kind == "reminder" and entity.due_at != existing.due_at:
                entity.anchor_at = entity.due_at  # a new due time starts a new schedule
                entity.notified_for = None
            elif kind == "reminder" and (entity.repeat_every, entity.repeat_unit) != (
                existing.repeat_every,
                existing.repeat_unit,
            ):
                # A new rule counts from the date shown now, not from the first one; what was
                # already sent stays sent, so the edit itself does not fire again.
                entity.anchor_at = entity.due_at
            members = self._members(kind, changes)
            self._check_references(kind, entity, members)
            try:
                with _db_errors():
                    if kind == "contact_group":
                        self._repo.save_group(entity, members, source, create=False)
                    else:
                        self._repo.update(kind, entity, source)
            except KeyError:
                raise NotFound(kind, entity_id) from None
            return self._saved(kind, entity)

    def delete(self, kind: EntityKind, entity_id: str, source: str) -> DeleteResult:
        self._check_kind(kind)
        _check_id(entity_id)
        with self._write_lock:
            try:
                with _db_errors():
                    return self._repo.delete(kind, entity_id, source)
            except KeyError:
                raise NotFound(kind, entity_id) from None

    def complete_reminder(self, reminder_id: str, source: str) -> dict:
        """Mark a reminder done, or move a repeating one to its next future date.

        Returns the saved reminder's snapshot row, built under the write lock, so a delete
        that lands right after cannot make a committed completion look like it failed.
        """
        _check_id(reminder_id)
        with self._write_lock:
            existing = self._require("reminder", reminder_id)
            if existing.done_at is not None:
                raise InvalidInput("reminder", "this reminder is already done")
            now = self._now()
            entity = reminders.completed(existing, now, now.tzinfo)
            entity.updated_at = datetime.now(UTC)
            with _db_errors():
                self._repo.update("reminder", entity, source)
            return reminder_row(entity, self._today(), now.tzinfo)

    def mark_reminder_notified(self, reminder_id: str, occurrence: datetime) -> None:
        """Remember which scheduled instant was notified (bookkeeping: not an edit)."""
        with self._write_lock, _db_errors():
            self._repo.set_reminder_notified(reminder_id, occurrence)

    def import_data(self, bundle: Bundle, *, replace_existing: bool) -> None:
        """Replace the whole CRM with an already validated bundle, as an import.

        Holds the write lock, so no edit can read before the import and write after it, and
        ``me_person_id`` cannot be set to a person the import removes. Raises
        ImportRefusedError when the repository refuses the import.
        """
        # Content-addressed, so photos stored before a refused import are harmless.
        for content in bundle.photos.values():
            self._photos.put(content)
        with self._write_lock:
            self._repo.replace_all(
                bundle.data,
                IMPORT_SOURCE,
                replace_existing=replace_existing,
                me_person_id=bundle.me_person_id,
            )

    # -- photos ---------------------------------------------------------

    def set_photo(self, kind: PhotoKind, entity_id: str, image: bytes, source: str) -> str:
        """Store a resized JPEG as the entity's photo; returns its hash."""
        self._check_photo_target(kind, entity_id)
        self._require(kind, entity_id)
        if isinstance(image, bytes | bytearray) and len(image) > MAX_PHOTO_BYTES:
            raise InvalidInput("image", "image is larger than 3 MB")
        jpeg = _process_image(image)  # slow; done outside the write lock
        photo_hash = self._photos.put(jpeg)
        self._save_photo_hash(kind, entity_id, photo_hash, source)
        return photo_hash

    def clear_photo(self, kind: PhotoKind, entity_id: str, source: str) -> None:
        self._check_photo_target(kind, entity_id)
        self._save_photo_hash(kind, entity_id, None, source)

    def _check_photo_target(self, kind: Any, entity_id: Any) -> None:
        if kind not in ("person", "household", "contact_group"):
            raise InvalidInput("kind", f"photos are not supported for {kind!r}")
        _check_id(entity_id)

    def _save_photo_hash(
        self, kind: str, entity_id: str, photo_hash: str | None, source: str
    ) -> None:
        """Re-read under the lock and change only the photo, so other edits are not reverted."""
        with self._write_lock:
            entity = self._require(kind, entity_id)
            entity.photo_hash = photo_hash
            entity.updated_at = datetime.now(UTC)
            try:
                with _db_errors():
                    self._repo.update(kind, entity, source)
            except KeyError:
                raise NotFound(kind, entity_id) from None

    # -- settings -------------------------------------------------------

    def get_settings(self) -> dict:
        return {"me_person_id": self._repo.get_meta(META_ME_PERSON)}

    def set_settings(self, changes: dict, source: str) -> dict:
        if not isinstance(changes, dict):
            raise InvalidInput("changes", "expected an object")
        for key in changes:
            if key != "me_person_id":
                raise InvalidInput(str(key), "unknown setting")
        with self._write_lock:
            if "me_person_id" in changes:
                me = changes["me_person_id"]
                if me is not None and (
                    not isinstance(me, str) or self._repo.get("person", me) is None
                ):
                    raise InvalidInput("me_person_id", "must be an existing person or null")
                with _db_errors():
                    self._repo.set_meta(META_ME_PERSON, me, source)
            return self.get_settings()

    # -- notification settings ------------------------------------------

    def get_notification_settings(self) -> dict:
        """Each notification's switch and time, with defaults for anything not stored."""
        settings = {kind: dict(values) for kind, values in DEFAULT_NOTIFICATIONS.items()}
        raw = self._repo.get_meta(META_NOTIFICATIONS)
        try:
            stored = json.loads(raw) if raw else {}
        except ValueError:
            stored = {}
        if isinstance(stored, dict):
            for kind, values in settings.items():
                part = stored.get(kind)
                if not isinstance(part, dict):
                    continue
                if isinstance(part.get("enabled"), bool):
                    values["enabled"] = part["enabled"]
                if "time" in values and isinstance(part.get("time"), str) and _CLOCK_TIME.fullmatch(part["time"]):
                    values["time"] = part["time"]
        return settings

    def set_notification_settings(self, changes: dict, source: str) -> dict:
        """Change some switches or times; what isn't mentioned stays as it is."""
        if not isinstance(changes, dict):
            raise InvalidInput("changes", "expected an object")
        for kind, part in changes.items():
            if kind not in DEFAULT_NOTIFICATIONS:
                raise InvalidInput(str(kind), "unknown notification")
            if not isinstance(part, dict):
                raise InvalidInput(kind, "expected an object")
            for key, value in part.items():
                if key not in DEFAULT_NOTIFICATIONS[kind]:
                    raise InvalidInput(f"{kind}.{key}", "unknown setting")
                if key == "enabled":
                    if not isinstance(value, bool):
                        raise InvalidInput(f"{kind}.enabled", "must be true or false")
                elif not isinstance(value, str) or not _CLOCK_TIME.fullmatch(value):
                    raise InvalidInput(f"{kind}.time", "must be a time such as 09:30")
        with self._write_lock:
            settings = self.get_notification_settings()
            for kind, part in changes.items():
                settings[kind].update(part)
            with _db_errors():
                self._repo.set_meta(META_NOTIFICATIONS, json.dumps(settings, sort_keys=True), source)
            return settings

    # -- Google sync state ----------------------------------------------

    def read_data(self) -> CRMData:
        """The repository's snapshot, which the Google sync plans from."""
        return self._repo.snapshot()

    def read_data_with_clock(self, now: Callable[[], datetime]) -> tuple[CRMData, datetime]:
        """The snapshot and ``now()``, both taken while no edit can commit.

        Every edit stamps ``updated_at`` and commits under the write lock, so an edit is
        either in the snapshot or stamped later than the time returned.
        """
        with self._write_lock:
            data = self._repo.snapshot()
            return data, now()

    def record_google_sync(
        self,
        person_id: str,
        *,
        synced_at: datetime | None | Unset = UNSET,
        contact_id: str | None | Unset = UNSET,
        photo_hash: str | None | Unset = UNSET,
        error: str | None = None,
    ) -> None:
        """Write a person's google fields without touching ``updated_at``; logged as ``sync``.

        ``UNSET`` leaves ``synced_at``, ``contact_id`` and ``photo_hash`` as they are; ``error``
        is always written (``None`` clears it). Raises NotFound if the person is gone.
        """
        changes: dict[str, Any] = {"google_sync_error": error}
        for name, value in (
            ("google_synced_at", synced_at),
            ("google_contact_id", contact_id),
            ("google_photo_hash", photo_hash),
        ):
            if not isinstance(value, Unset):
                changes[name] = value
        self._save_google_state(person_id, changes, "sync")

    def clear_google_contact(self, person_id: str, source: str) -> None:
        """Forget the person's Google link, so the next run creates a fresh contact.

        Only for a person the sync is blocked on (their contact is missing in Google, or a
        create may have landed); anyone else raises ``NotBlocked``, since clearing a working
        link would make the next run create a duplicate.
        """
        _check_id(person_id)
        with self._write_lock:
            person = self._repo.get("person", person_id)
            if person is None:
                raise NotFound("person", person_id)
            if not _google_blocked(person):
                raise NotBlocked(
                    "Only a person whose Google contact is missing, or whose create is "
                    "uncertain, can be given a new contact"
                )
            self._write_google_state(
                person_id,
                {
                    "google_contact_id": None,
                    "google_synced_at": None,
                    "google_photo_hash": None,
                    "google_sync_error": None,
                },
                source,
            )

    def _save_google_state(self, person_id: str, changes: dict[str, Any], source: str) -> None:
        _check_id(person_id)
        with self._write_lock:
            self._write_google_state(person_id, changes, source)

    def _write_google_state(self, person_id: str, changes: dict[str, Any], source: str) -> None:
        """Hold the write lock while calling this."""
        try:
            with _db_errors():
                self._repo.update_google_state(person_id, changes, source)
        except KeyError:
            raise NotFound("person", person_id) from None

    def get_google_settings(self) -> dict:
        return {
            "enabled": self._repo.get_meta(META_GOOGLE_SYNC) == "1",
            "cutover_confirmed": self._repo.cutover_confirmed(),
        }

    def google_sync_enabled(self) -> bool:
        """Whether the sync is switched on (one meta read)."""
        return self._repo.get_meta(META_GOOGLE_SYNC) == "1"

    def google_link_verified(self) -> bool:
        """Whether Google has accepted an update or create through this CRM's link."""
        return self._repo.get_meta(META_GOOGLE_LINK_VERIFIED) == "1"

    def mark_google_link_verified(self) -> None:
        """Record that Google accepted a write through this link (logged as ``sync``)."""
        with self._write_lock:
            with _db_errors():
                self._repo.set_meta(META_GOOGLE_LINK_VERIFIED, "1", "sync")

    def set_google_sync_enabled(self, enabled: bool, source: str) -> None:
        """Switch the sync on (only after cutover is confirmed) or off (always allowed)."""
        with self._write_lock:
            if enabled and not self._repo.cutover_confirmed():
                raise GoogleSyncRefused("cutover has not been confirmed")
            with _db_errors():
                self._repo.set_meta(META_GOOGLE_SYNC, "1" if enabled else None, source)

    # -- helpers --------------------------------------------------------

    def _require(self, kind: str, entity_id: str) -> Any:
        self._check_kind(kind)
        _check_id(entity_id)
        entity = self._repo.get(kind, entity_id)
        if entity is None:
            raise NotFound(kind, entity_id)
        return entity

    def _check_kind(self, kind: Any) -> None:
        if not isinstance(kind, str) or kind not in _MODELS:
            raise InvalidInput("kind", f"unknown entity kind {kind!r}")

    def _check_fields(self, kind: str, fields: Any) -> set[str]:
        self._check_kind(kind)
        if not isinstance(fields, dict):
            raise InvalidInput("fields", "expected an object")
        editable = _editable_fields(kind)
        for key in fields:
            if key not in editable:
                raise InvalidInput(str(key), "unknown or read-only field")
        return editable

    def _decode(self, kind: str, raw: dict[str, Any]) -> Any:
        try:
            entity = _FROM_DICT[kind](raw)
        except ValueError as err:
            field, sep, message = str(err).partition(": ")
            raise InvalidInput(field if sep else "fields", message if sep else str(err)) from None
        if kind in ("person", "contact_group") and not entity.name.strip():
            raise InvalidInput("name", "must not be blank")
        if kind == "person":
            entity.name = " ".join(entity.name.split())
        return entity

    def _members(self, kind: str, fields: dict) -> list[str] | None:
        if kind != "contact_group" or _GROUP_MEMBERS not in fields:
            return None
        members = fields[_GROUP_MEMBERS]
        if not isinstance(members, list) or not all(isinstance(m, str) for m in members):
            raise InvalidInput(_GROUP_MEMBERS, "expected a list of person ids")
        return members

    def _localize_due(self, raw: dict[str, Any]) -> None:
        """Read a due time sent without an offset in Home Assistant's time zone."""
        due = raw.get("due_at")
        if not isinstance(due, str):
            return
        try:
            parsed = datetime.fromisoformat(due)
        except ValueError:
            return  # the decoder reports it
        if parsed.tzinfo is None:
            raw["due_at"] = reminders.localize(parsed, self._now().tzinfo).isoformat()

    def _person_exists(self, person_id: str) -> bool:
        return self._repo.get("person", person_id) is not None

    def _check_references(self, kind: str, entity: Any, members: list[str] | None) -> None:
        if kind == "relationship":
            if entity.person_a_id == entity.person_b_id:
                raise InvalidInput("person_b_id", "a person cannot be related to themselves")
            for field in ("person_a_id", "person_b_id"):
                if not self._person_exists(getattr(entity, field)):
                    raise InvalidInput(field, "person does not exist")
        elif kind == "interaction":
            if not entity.person_ids:
                raise InvalidInput("person_ids", "an interaction needs at least one person")
            if len(set(entity.person_ids)) != len(entity.person_ids):
                raise InvalidInput("person_ids", "must not contain duplicates")
            for person_id in entity.person_ids:
                if not self._person_exists(person_id):
                    raise InvalidInput("person_ids", f"person {person_id!r} does not exist")
        elif kind == "reminder":
            if not self._person_exists(entity.person_id):
                raise InvalidInput("person_id", "person does not exist")
            if entity.interaction_id is not None and self._repo.get("interaction", entity.interaction_id) is None:
                raise InvalidInput("interaction_id", "interaction does not exist")
            if (entity.repeat_every is None) != (entity.repeat_unit is None):
                raise InvalidInput("repeat_every", "a repeat needs both a number and a unit")
            if entity.repeat_every is not None:
                if entity.due_at is None:
                    raise InvalidInput("repeat_every", "a repeat needs a due time")
                if not 1 <= entity.repeat_every <= 999:
                    raise InvalidInput("repeat_every", "must be between 1 and 999")
        elif kind == "person":
            if entity.household_id is not None and self._repo.get("household", entity.household_id) is None:
                raise InvalidInput("household_id", "household does not exist")
        elif kind == "contact_group" and members is not None:
            for person_id in members:
                if not self._person_exists(person_id):
                    raise InvalidInput(_GROUP_MEMBERS, f"person {person_id!r} does not exist")

    def _saved(self, kind: str, entity: Any) -> dict:
        result = to_dict(entity)
        if kind == "contact_group":
            result[_GROUP_MEMBERS] = sorted(
                p for g, p in self._repo.snapshot().group_members if g == entity.id
            )
        return result


def _google_blocked(person: Person) -> bool:
    """The two states the sync stops on until the owner clears the link (as ``plan_for``)."""
    error = person.google_sync_error
    if person.google_contact_id:
        return error == ERROR_CONTACT_MISSING
    return error == ERROR_CREATE_UNCERTAIN


def _process_image(image: Any) -> bytes:
    """Any supported image as an upright, flattened JPEG fitting in PHOTO_MAX_EDGE.

    Memory is bounded by MAX_PHOTO_PIXELS; the upload size limit is ``set_photo``'s.
    """
    if not isinstance(image, bytes | bytearray):
        raise InvalidInput("image", "expected image bytes")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image), formats=PHOTO_FORMATS) as opened:
                if opened.width * opened.height > MAX_PHOTO_PIXELS:
                    return _too_big()
                opened.draft("RGB", (PHOTO_MAX_EDGE, PHOTO_MAX_EDGE))  # JPEG only; cheaper decode
                oriented = ImageOps.exif_transpose(opened)
                rgba = oriented.convert("RGBA")
            flat = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            rgb = Image.alpha_composite(flat, rgba).convert("RGB")
            rgb.thumbnail((PHOTO_MAX_EDGE, PHOTO_MAX_EDGE))
            out = io.BytesIO()
            rgb.save(out, format="JPEG", quality=PHOTO_JPEG_QUALITY)
            return out.getvalue()
    except InvalidInput:
        raise
    except Exception as err:
        raise InvalidInput("image", f"not a usable image ({type(err).__name__})") from None


def _too_big() -> bytes:
    raise InvalidInput("image", "image has too many pixels")
