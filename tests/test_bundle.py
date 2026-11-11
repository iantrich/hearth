"""Tests for reading and writing Hearth bundles."""

from __future__ import annotations

import copy
import hashlib
import json
import zipfile
from dataclasses import replace

import pytest

from custom_components.hearth_crm import bundle as bundle_mod
from custom_components.hearth_crm.bundle import (
    BUNDLE_FORMAT,
    BUNDLE_VERSION,
    BundleError,
    read_bundle,
    write_bundle,
)
from custom_components.hearth_crm.serialize import data_to_dict

PHOTO_A = b"photo-a-bytes"
PHOTO_B = b"photo-b-bytes"
HASH_A = hashlib.sha256(PHOTO_A).hexdigest()
HASH_B = hashlib.sha256(PHOTO_B).hexdigest()
PHOTOS = {HASH_A: PHOTO_A, HASH_B: PHOTO_B}


@pytest.fixture
def data(sample):
    """The sample with real photo hashes: person p1 -> A, household h1 -> B."""
    sample.people[0] = replace(sample.people[0], photo_hash=HASH_A)
    sample.households[0] = replace(sample.households[0], photo_hash=HASH_B)
    return sample


def raw_bundle(path, doc=None, members=None):
    """Write a zip by hand: `doc` becomes bundle.json, `members` are extra entries."""
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        if doc is not None:
            zf.writestr("bundle.json", doc if isinstance(doc, str) else json.dumps(doc))
        for name, content in (members or {}).items():
            zf.writestr(name, content)
    return path


def good_doc(data):
    return {
        "format": BUNDLE_FORMAT,
        "version": BUNDLE_VERSION,
        "exported_at": "2026-11-04T00:00:00+00:00",
        "me_person_id": None,
        **data_to_dict(data),
    }


def good_members():
    return {f"photos/{h}": b for h, b in PHOTOS.items()}


def test_write_then_read_round_trips_data_and_photos(tmp_path, data):
    p = tmp_path / "out.zip"
    write_bundle(p, data, PHOTOS.__getitem__, me_person_id="p2")
    b = read_bundle(p)
    assert b.data == data
    assert b.me_person_id == "p2"
    assert b.photos == PHOTOS
    assert not (tmp_path / "out.zip.tmp").exists()


def test_exported_at_is_utc_iso(tmp_path, data):
    p = tmp_path / "out.zip"
    write_bundle(p, data, PHOTOS.__getitem__)
    with zipfile.ZipFile(p) as zf:
        doc = json.loads(zf.read("bundle.json"))
    assert doc["format"] == BUNDLE_FORMAT
    assert doc["version"] == BUNDLE_VERSION
    assert doc["me_person_id"] is None
    assert doc["exported_at"].endswith("+00:00")


def test_shared_photo_written_once(tmp_path, data):
    data.groups[0] = replace(data.groups[0], photo_hash=HASH_A)  # same as person p1
    calls = []

    def supply(h):
        calls.append(h)
        return PHOTOS[h]

    p = tmp_path / "out.zip"
    write_bundle(p, data, supply)
    with zipfile.ZipFile(p) as zf:
        photo_names = [n for n in zf.namelist() if n.startswith("photos/")]
    assert sorted(photo_names) == sorted(f"photos/{h}" for h in PHOTOS)
    assert sorted(calls) == sorted(PHOTOS)


def test_read_rejects_path_traversal_member(tmp_path, data):
    p = raw_bundle(tmp_path / "b.zip", good_doc(data), {**good_members(), "../evil": b"x"})
    with pytest.raises(BundleError, match="evil"):
        read_bundle(p)


def test_read_rejects_unexpected_members(tmp_path, data):
    members = {**good_members(), "photos/ABC": b"x", "notes.txt": b"x", "photos/": b""}
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", good_doc(data), members))
    assert len(e.value.problems) == 3


def test_read_rejects_oversized_bundle(tmp_path, monkeypatch, data):
    p = raw_bundle(tmp_path / "b.zip", good_doc(data), good_members())
    monkeypatch.setattr(bundle_mod, "MAX_UNCOMPRESSED_BYTES", 10)
    with pytest.raises(BundleError, match="large|size|limit"):
        read_bundle(p)


def test_read_rejects_photo_hash_mismatch(tmp_path, data):
    members = {**good_members(), f"photos/{HASH_A}": b"tampered"}
    with pytest.raises(BundleError, match=HASH_A):
        read_bundle(raw_bundle(tmp_path / "b.zip", good_doc(data), members))


def test_read_rejects_missing_referenced_photo(tmp_path, data):
    members = {f"photos/{HASH_A}": PHOTO_A}
    with pytest.raises(BundleError, match=HASH_B):
        read_bundle(raw_bundle(tmp_path / "b.zip", good_doc(data), members))


def test_read_lists_every_dangling_reference(tmp_path, data):
    doc = good_doc(data)
    doc["people"][1]["household_id"] = "nope-h"
    doc["group_members"].append(["g1", "nope-p"])
    doc["interactions"][0]["person_ids"] = ["p1", "nope-i"]
    p = raw_bundle(tmp_path / "b.zip", doc, good_members())
    with pytest.raises(BundleError) as e:
        read_bundle(p)
    assert len(e.value.problems) == 3
    for needle in ("nope-h", "nope-p", "nope-i"):
        assert needle in str(e.value)


def test_read_reports_other_reference_problems(tmp_path, data):
    doc = good_doc(data)
    doc["relationships"][0]["person_b_id"] = "ghost-r"
    doc["interactions"][1]["person_ids"] = []
    doc["people"].append(copy.deepcopy(doc["people"][0]))  # duplicate id p1
    doc["me_person_id"] = "ghost-me"
    doc["group_members"].append(["ghost-g", "p1"])
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))
    text = str(e.value)
    assert len(e.value.problems) == 5
    for needle in ("ghost-r", "i2", "p1", "ghost-me", "ghost-g"):
        assert needle in text


def test_read_rejects_a_relationship_to_oneself(tmp_path, data):
    doc = good_doc(data)
    doc["relationships"][0]["person_b_id"] = doc["relationships"][0]["person_a_id"]
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))
    assert e.value.problems == ["relationship 'r1' relates person 'p1' to themselves"]


def test_read_huge_number_is_a_problem_not_a_crash(tmp_path, data):
    doc = good_doc(data)
    doc["people"][0]["address"]["lat"] = 10**400  # an int too large for a float
    with pytest.raises(BundleError, match="lat"):
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))


def test_read_any_overflow_while_decoding_is_a_problem(tmp_path, data, monkeypatch):
    def overflow(document):
        raise OverflowError("date value out of range")

    monkeypatch.setattr(bundle_mod, "data_from_dict", overflow)
    with pytest.raises(BundleError, match="out of range"):
        read_bundle(raw_bundle(tmp_path / "b.zip", good_doc(data), good_members()))


def test_read_rejects_wrong_format_and_version(tmp_path, data):
    doc = {**good_doc(data), "format": "other", "version": 99}
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))
    assert len(e.value.problems) == 2


def test_read_missing_bundle_json_is_one_problem(tmp_path):
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", None, {}))
    assert len(e.value.problems) == 1


def test_read_invalid_json_is_one_problem(tmp_path):
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", "{not json", {}))
    assert len(e.value.problems) == 1


def test_read_not_a_zip_is_one_problem(tmp_path):
    p = tmp_path / "b.zip"
    p.write_bytes(b"definitely not a zip")
    with pytest.raises(BundleError) as e:
        read_bundle(p)
    assert len(e.value.problems) == 1


def test_read_bad_row_is_a_problem(tmp_path, data):
    doc = good_doc(data)
    doc["people"][0]["birthday"] = "05/01/2020"
    with pytest.raises(BundleError, match="birthday"):
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))


def test_failed_write_leaves_no_file(tmp_path, data):
    p = tmp_path / "out.zip"

    def boom(h):
        raise OSError("disk on fire")

    with pytest.raises(OSError):
        write_bundle(p, data, boom)
    assert not p.exists()
    assert not (tmp_path / "out.zip.tmp").exists()


def test_failed_write_keeps_existing_file(tmp_path, data):
    p = tmp_path / "out.zip"
    p.write_bytes(b"previous")
    with pytest.raises(KeyError):
        write_bundle(p, data, {}.__getitem__)
    assert p.read_bytes() == b"previous"
    assert not (tmp_path / "out.zip.tmp").exists()


def test_write_rejects_bytes_that_do_not_match_hash(tmp_path, data):
    p = tmp_path / "out.zip"
    with pytest.raises(ValueError, match="do not match"):
        write_bundle(p, data, lambda h: b"wrong")
    assert not p.exists()


def test_write_rejects_malformed_photo_hash(tmp_path, sample):
    p = tmp_path / "out.zip"
    with pytest.raises(ValueError, match="abc123"):  # sample's p1 has photo_hash "abc123"
        write_bundle(p, sample, lambda h: b"x")
    assert not p.exists()


def _corrupt_member(path, name):
    """Flip bytes in the middle of a member's compressed stream."""
    with zipfile.ZipFile(path) as zf:
        info = zf.getinfo(name)
    raw = bytearray(path.read_bytes())
    # skip the local header: 30 bytes + name + extra (extra length is at offset 28)
    extra = int.from_bytes(raw[info.header_offset + 28:info.header_offset + 30], "little")
    start = info.header_offset + 30 + len(info.filename.encode()) + extra
    for i in range(start, start + info.compress_size):
        raw[i] = 0xFF
    path.write_bytes(bytes(raw))


def test_read_corrupt_photo_stream_is_a_problem(tmp_path, data):
    p = raw_bundle(tmp_path / "b.zip", good_doc(data), good_members())
    _corrupt_member(p, f"photos/{HASH_A}")
    with pytest.raises(BundleError):
        read_bundle(p)


def test_read_corrupt_bundle_json_is_one_problem(tmp_path, data):
    p = raw_bundle(tmp_path / "b.zip", good_doc(data), good_members())
    _corrupt_member(p, "bundle.json")
    with pytest.raises(BundleError) as e:
        read_bundle(p)
    assert len(e.value.problems) == 1


def test_read_truncated_stream_is_a_problem(tmp_path, data):
    p = raw_bundle(tmp_path / "b.zip", good_doc(data), good_members())
    with zipfile.ZipFile(p) as zf:
        info = zf.getinfo("bundle.json")
    # Shrink the stored compressed size so the stream ends early.
    raw = bytearray(p.read_bytes())
    cd = raw.rfind(b"PK\x01\x02")
    while cd != -1:
        n = int.from_bytes(raw[cd + 28:cd + 30], "little")
        if bytes(raw[cd + 46:cd + 46 + n]) == b"bundle.json":
            raw[cd + 20:cd + 24] = (info.compress_size // 2).to_bytes(4, "little")
            break
        cd = raw.rfind(b"PK\x01\x02", 0, cd)
    p.write_bytes(bytes(raw))
    with pytest.raises(BundleError):
        read_bundle(p)


def test_read_rejects_unreferenced_photo(tmp_path, data):
    extra = b"orphan"
    members = {**good_members(), f"photos/{hashlib.sha256(extra).hexdigest()}": extra}
    with pytest.raises(BundleError, match="unreferenced photo"):
        read_bundle(raw_bundle(tmp_path / "b.zip", good_doc(data), members))


def test_read_rejects_duplicate_zip_member(tmp_path, data):
    p = tmp_path / "b.zip"
    with pytest.warns(UserWarning, match="Duplicate name"):
        raw_bundle(p, good_doc(data), good_members())
        with zipfile.ZipFile(p, "a") as zf:
            zf.writestr(f"photos/{HASH_A}", PHOTO_A)
    with pytest.raises(BundleError, match="duplicate zip member"):
        read_bundle(p)


def test_header_is_checked_before_photos(tmp_path, data):
    doc = {**good_doc(data), "version": 99}
    members = {**good_members(), f"photos/{HASH_A}": b"tampered"}
    with pytest.raises(BundleError) as e:
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, members))
    assert len(e.value.problems) == 1


def test_write_refuses_nan_coordinates(tmp_path, data):
    from custom_components.hearth_crm.models import Place

    data.people[0] = replace(data.people[0], address=Place(formatted="x", lat=float("nan")))
    p = tmp_path / "out.zip"
    with pytest.raises(ValueError):
        write_bundle(p, data, PHOTOS.__getitem__)
    assert not p.exists()
    assert not (tmp_path / "out.zip.tmp").exists()


def test_a_reminder_for_a_missing_person_is_a_problem(tmp_path, data):
    doc = good_doc(data)
    doc["reminders"][0]["person_id"] = "ghost-p"
    with pytest.raises(BundleError, match="ghost-p"):
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))


def test_a_reminder_linked_to_a_missing_interaction_is_a_problem(tmp_path, data):
    doc = good_doc(data)
    doc["reminders"][0]["interaction_id"] = "ghost-i"
    with pytest.raises(BundleError, match="ghost-i"):
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))


def test_duplicate_reminder_ids_are_a_problem(tmp_path, data):
    doc = good_doc(data)
    doc["reminders"].append(copy.deepcopy(doc["reminders"][0]))
    with pytest.raises(BundleError, match="duplicate id 'm1'"):
        read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))


def test_export_includes_reminders_and_round_trips(tmp_path, data):
    path = tmp_path / "b.zip"
    write_bundle(path, data, PHOTOS.__getitem__)
    with zipfile.ZipFile(path) as zf:
        assert len(json.loads(zf.read("bundle.json"))["reminders"]) == 3


def test_an_old_bundle_without_reminders_imports_with_none(tmp_path, data):
    doc = good_doc(data)
    del doc["reminders"]
    result = read_bundle(raw_bundle(tmp_path / "b.zip", doc, good_members()))
    assert result.data.reminders == []
