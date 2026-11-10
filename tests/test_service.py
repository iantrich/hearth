"""Tests for HearthService (invented people only)."""

from __future__ import annotations

import io
import os
from datetime import date
from itertools import count
from pathlib import Path

import pytest
from PIL import Image

from custom_components.hearth_crm.db import CRMRepository, open_database
from custom_components.hearth_crm.photos import PhotoStore
from custom_components.hearth_crm.service import HearthService, InvalidInput, NotFound


@pytest.fixture
def svc(tmp_path: Path) -> HearthService:
    repo = CRMRepository(open_database(tmp_path / "crm.db"))
    ids = count(1)
    service = HearthService(
        repo,
        PhotoStore(tmp_path / "photos"),
        today=lambda: date(2026, 3, 1),
        new_id=lambda: f"id{next(ids)}",
    )
    yield service
    repo.close()


@pytest.fixture
def service_with_person(svc):
    person = svc.create("person", {"name": "Alex Example"}, "panel")
    return svc, person["id"]


def _png(size: tuple[int, int]) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(out, format="PNG")
    return out.getvalue()


def test_create_person_sets_id_and_timestamps(svc):
    person = svc.create("person", {"name": "Alex Example", "favorite": True}, "panel")

    assert person["id"] == "id1"
    assert person["name"] == "Alex Example"
    assert person["favorite"] is True
    assert person["created_at"] == person["updated_at"]
    assert svc._repo.get("person", "id1").name == "Alex Example"


def test_blank_name_rejected(svc):
    with pytest.raises(InvalidInput, match="name") as err:
        svc.create("person", {"name": "   "}, "panel")
    assert err.value.field == "name"


def test_missing_and_wrong_type_fields_name_the_field(svc):
    with pytest.raises(InvalidInput) as err:
        svc.create("person", {}, "panel")
    assert err.value.field == "name"
    with pytest.raises(InvalidInput) as err:
        svc.create("person", {"name": "A", "favorite": "yes"}, "panel")
    assert err.value.field == "favorite"


def test_unknown_and_read_only_fields_rejected(svc):
    for bad in ("nickname", "id", "created_at", "photo_hash", "google_contact_id"):
        with pytest.raises(InvalidInput) as err:
            svc.create("person", {"name": "A", bad: "x"}, "panel")
        assert err.value.field == bad
    assert svc._repo.snapshot().people == []


def test_update_changes_fields_and_timestamp(svc):
    svc.create("person", {"name": "Alex Example", "notes": "hi"}, "panel")

    updated = svc.update("person", "id1", {"name": "Alex E."}, "panel")

    assert updated["name"] == "Alex E."
    assert updated["notes"] == "hi"
    assert updated["updated_at"] >= updated["created_at"]
    with pytest.raises(NotFound) as err:
        svc.update("person", "nope", {"name": "X"}, "panel")
    assert (err.value.kind, err.value.entity_id) == ("person", "nope")


def test_person_household_must_exist(svc):
    with pytest.raises(InvalidInput) as err:
        svc.create("person", {"name": "A", "household_id": "ghost"}, "panel")
    assert err.value.field == "household_id"
    household = svc.create("household", {"name_override": "The Examples"}, "panel")
    person = svc.create("person", {"name": "A", "household_id": household["id"]}, "panel")
    assert person["household_id"] == household["id"]


def test_relationship_to_self_rejected(svc):
    svc.create("person", {"name": "A"}, "panel")
    with pytest.raises(InvalidInput):
        svc.create(
            "relationship", {"person_a_id": "id1", "person_b_id": "id1", "type": "Friend"}, "panel"
        )


def test_relationship_people_must_exist(svc):
    svc.create("person", {"name": "A"}, "panel")
    with pytest.raises(InvalidInput) as err:
        svc.create(
            "relationship", {"person_a_id": "id1", "person_b_id": "ghost", "type": "Friend"}, "panel"
        )
    assert err.value.field == "person_b_id"
    other = svc.create("person", {"name": "B"}, "panel")
    rel = svc.create(
        "relationship", {"person_a_id": "id1", "person_b_id": other["id"], "type": "Friend"}, "panel"
    )
    assert rel["type"] == "Friend"


def _two_people(svc):
    svc.create("person", {"name": "A"}, "panel")
    svc.create("person", {"name": "B"}, "panel")


def test_interaction_needs_existing_unique_people(svc):
    _two_people(svc)
    base = {"summary": "Coffee", "date": "2026-02-01", "type": "Catch-up"}
    for ids in ([], ["id1", "id1"], ["id1", "ghost"]):
        with pytest.raises(InvalidInput) as err:
            svc.create("interaction", base | {"person_ids": ids}, "panel")
        assert err.value.field == "person_ids"


def test_update_interaction_people_keeps_order(svc):
    _two_people(svc)
    svc.create(
        "interaction",
        {"summary": "Coffee", "date": "2026-02-01", "type": "Catch-up", "person_ids": ["id1"]},
        "panel",
    )

    updated = svc.update("interaction", "id3", {"person_ids": ["id2", "id1"]}, "panel")

    assert updated["person_ids"] == ["id2", "id1"]
    assert svc._repo.get("interaction", "id3").person_ids == ["id2", "id1"]
    with pytest.raises(InvalidInput):
        svc.update("interaction", "id3", {"person_ids": []}, "panel")


def test_group_member_ids_are_applied_and_sorted(svc):
    _two_people(svc)

    group = svc.create("contact_group", {"name": "Book Club", "member_ids": ["id2", "id1"]}, "panel")
    assert group["member_ids"] == ["id1", "id2"]

    group = svc.update("contact_group", group["id"], {"member_ids": ["id2"]}, "panel")
    assert group["member_ids"] == ["id2"]
    group = svc.update("contact_group", group["id"], {"name": "Readers"}, "panel")
    assert group["member_ids"] == ["id2"]

    with pytest.raises(InvalidInput) as err:
        svc.update("contact_group", group["id"], {"member_ids": ["ghost"]}, "panel")
    assert err.value.field == "member_ids"


def test_delete_returns_result_and_missing_is_not_found(svc):
    svc.create("person", {"name": "A"}, "panel")
    assert svc.delete("person", "id1", "panel").deleted == {"person": ["id1"]}
    with pytest.raises(NotFound):
        svc.delete("person", "id1", "panel")


def test_rename_changes_household_name_in_snapshot(svc):
    household = svc.create("household", {}, "panel")
    svc.create("person", {"name": "Alex Example", "household_id": household["id"]}, "panel")
    svc.create("person", {"name": "Blair Example", "household_id": household["id"]}, "panel")
    svc.update("household", household["id"], {"name_override": "The Examples"}, "panel")

    snap = svc.snapshot()
    assert [h["name"] for h in snap["households"]] == ["The Examples"]


def test_set_photo_resizes_and_stores_jpeg(svc, tmp_path):
    svc.create("person", {"name": "A"}, "panel")

    photo_hash = svc.set_photo("person", "id1", _png((3000, 2000)), "panel")

    assert svc._repo.get("person", "id1").photo_hash == photo_hash
    with Image.open(tmp_path / "photos" / photo_hash) as stored:
        assert stored.format == "JPEG"
        assert stored.size == (1024, 683)
    svc.clear_photo("person", "id1", "panel")
    assert svc._repo.get("person", "id1").photo_hash is None
    with pytest.raises(NotFound):
        svc.set_photo("person", "ghost", _png((10, 10)), "panel")


def test_set_photo_applies_exif_orientation(svc, tmp_path):
    svc.create("person", {"name": "A"}, "panel")
    img = Image.new("RGB", (40, 20))
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 clockwise to display
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif)

    photo_hash = svc.set_photo("person", "id1", out.getvalue(), "panel")

    with Image.open(tmp_path / "photos" / photo_hash) as stored:
        assert stored.size == (20, 40)


def test_set_photo_rejects_non_image(svc):
    svc.create("person", {"name": "A"}, "panel")
    with pytest.raises(InvalidInput) as err:
        svc.set_photo("person", "id1", b"not an image", "panel")
    assert err.value.field == "image"


def test_set_photo_rejects_decompression_bomb(svc, monkeypatch):
    svc.create("person", {"name": "A"}, "panel")
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)
    with pytest.raises(InvalidInput, match="DecompressionBombWarning"):
        svc.set_photo("person", "id1", _png((12, 12)), "panel")  # over limit, under 2x: warning
    with pytest.raises(InvalidInput, match="DecompressionBombError"):
        svc.set_photo("person", "id1", _png((20, 20)), "panel")  # over 2x: error


def test_me_person_must_exist(svc):
    svc.create("person", {"name": "A"}, "panel")
    assert svc.get_settings() == {"me_person_id": None}
    with pytest.raises(InvalidInput) as err:
        svc.set_settings({"me_person_id": "ghost"}, "panel")
    assert err.value.field == "me_person_id"
    assert svc.set_settings({"me_person_id": "id1"}, "panel") == {"me_person_id": "id1"}
    assert svc.set_settings({"me_person_id": None}, "panel") == {"me_person_id": None}
    with pytest.raises(InvalidInput):
        svc.set_settings({"other": 1}, "panel")


def test_photo_put_fsyncs_before_rename(tmp_path, monkeypatch):
    calls: list[str] = []
    real_fsync, real_replace = os.fsync, os.replace
    monkeypatch.setattr(os, "fsync", lambda fd: (calls.append("fsync"), real_fsync(fd))[1])
    monkeypatch.setattr(os, "replace", lambda a, b: (calls.append("replace"), real_replace(a, b))[1])

    PhotoStore(tmp_path / "photos").put(b"bytes")

    assert calls == ["fsync", "replace"]


def test_photo_put_rewrites_when_path_is_not_a_file(tmp_path):
    store = PhotoStore(tmp_path / "photos")
    photo_hash = store.put(b"x")
    (tmp_path / "photos" / photo_hash).unlink()
    (tmp_path / "photos" / photo_hash).mkdir()
    with pytest.raises(OSError):
        store.put(b"x")  # not treated as already stored


def _delete_after_check(svc, monkeypatch, person_id):
    real = svc._check_references

    def check(*args):
        real(*args)
        svc._repo.delete("person", person_id, "panel")

    monkeypatch.setattr(svc, "_check_references", check)


def test_group_create_is_atomic_when_a_member_vanishes(svc, monkeypatch):
    _two_people(svc)
    _delete_after_check(svc, monkeypatch, "id2")

    with pytest.raises(InvalidInput):
        svc.create("contact_group", {"name": "Club", "member_ids": ["id1", "id2"]}, "panel")

    assert svc._repo.snapshot().groups == []


def test_group_update_is_atomic_when_a_member_vanishes(svc, monkeypatch):
    _two_people(svc)
    group = svc.create("contact_group", {"name": "Club", "member_ids": ["id1"]}, "panel")
    _delete_after_check(svc, monkeypatch, "id2")

    with pytest.raises(InvalidInput):
        svc.update("contact_group", group["id"], {"name": "Renamed", "member_ids": ["id2"]}, "panel")

    data = svc._repo.snapshot()
    assert [g.name for g in data.groups] == ["Club"]
    assert data.group_members == [(group["id"], "id1")]


def test_arguments_are_checked(svc):
    svc.create("person", {"name": "A"}, "panel")
    with pytest.raises(InvalidInput):
        svc.create("person", ["name"], "panel")
    with pytest.raises(InvalidInput):
        svc.update("person", "id1", "x", "panel")
    with pytest.raises(InvalidInput):
        svc.set_settings(["me_person_id"], "panel")
    for bad_id in ("", None, 5):
        with pytest.raises(InvalidInput):
            svc.update("person", bad_id, {}, "panel")
        with pytest.raises(InvalidInput):
            svc.delete("person", bad_id, "panel")
    with pytest.raises(InvalidInput) as err:
        svc.create("planet", {}, "panel")
    assert err.value.field == "kind"
    with pytest.raises(InvalidInput) as err:
        svc.delete("planet", "id1", "panel")
    assert err.value.field == "kind"
    for call in (svc.set_photo, ):
        with pytest.raises(InvalidInput) as err:
            call("relationship", "id1", _png((5, 5)), "panel")
        assert err.value.field == "kind"
    with pytest.raises(InvalidInput):
        svc.clear_photo("interaction", "id1", "panel")


def test_person_name_is_stored_normalized(svc):
    person = svc.create("person", {"name": "  Alex \t Example  "}, "panel")
    assert person["name"] == "Alex Example"
    assert svc.update("person", person["id"], {"name": " Alex   E. "}, "panel")["name"] == "Alex E."


def test_set_photo_rejects_non_bytes_and_unsupported_formats(svc):
    svc.create("person", {"name": "A"}, "panel")
    for bad in ("text", None, 12):
        with pytest.raises(InvalidInput) as err:
            svc.set_photo("person", "id1", bad, "panel")
        assert err.value.field == "image"
    eps = b"%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 10 10\n"
    with pytest.raises(InvalidInput):
        svc.set_photo("person", "id1", eps, "panel")


def test_set_photo_limit_is_what_the_websocket_can_carry(svc):
    from custom_components.hearth_crm import service, websocket

    # The largest upload the websocket accepts decodes to exactly the service's limit.
    assert service.MAX_PHOTO_BYTES == 3_000_000
    assert websocket.MAX_PHOTO_DATA_CHARS * 3 // 4 == service.MAX_PHOTO_BYTES
    svc.create("person", {"name": "A"}, "panel")
    with pytest.raises(InvalidInput) as err:
        svc.set_photo("person", "id1", bytes(service.MAX_PHOTO_BYTES + 1), "panel")
    assert err.value.field == "image" and "3 MB" in err.value.message


def test_set_photo_rejects_too_many_pixels(svc, monkeypatch):
    svc.create("person", {"name": "A"}, "panel")
    monkeypatch.setattr("custom_components.hearth_crm.service.MAX_PHOTO_PIXELS", 100)
    with pytest.raises(InvalidInput, match="pixels"):
        svc.set_photo("person", "id1", _png((11, 10)), "panel")


def test_set_photo_accepts_cmyk_and_transparent_images(svc, tmp_path):
    svc.create("person", {"name": "A"}, "panel")
    cmyk = io.BytesIO()
    Image.new("CMYK", (30, 20), (0, 100, 100, 0)).save(cmyk, format="JPEG")
    alpha = io.BytesIO()
    Image.new("RGBA", (30, 20), (0, 0, 0, 0)).save(alpha, format="PNG")

    for data in (cmyk.getvalue(), alpha.getvalue()):
        photo_hash = svc.set_photo("person", "id1", data, "panel")
        with Image.open(tmp_path / "photos" / photo_hash) as stored:
            assert stored.mode == "RGB"
    with Image.open(tmp_path / "photos" / photo_hash) as stored:
        assert stored.getpixel((5, 5)) == (255, 255, 255)  # transparent -> white


def test_set_photo_does_not_revert_a_concurrent_edit(svc, monkeypatch):
    svc.create("person", {"name": "A"}, "panel")
    real_put = svc._photos.put

    def put(data):
        svc.update("person", "id1", {"notes": "edited meanwhile"}, "panel")
        return real_put(data)

    monkeypatch.setattr(svc._photos, "put", put)

    photo_hash = svc.set_photo("person", "id1", _png((10, 10)), "panel")

    person = svc._repo.get("person", "id1")
    assert person.notes == "edited meanwhile"
    assert person.photo_hash == photo_hash


def _bundle(data, photos=None, me=None):
    from custom_components.hearth_crm.bundle import Bundle

    return Bundle(data=data, me_person_id=me, photos=photos or {})


def test_import_data_replaces_everything_and_stores_photos(svc):
    import hashlib

    from tests.conftest import sample_data

    svc.create("person", {"name": "Old Example"}, "import")
    photo = b"photo-bytes"
    digest = hashlib.sha256(photo).hexdigest()
    svc.import_data(_bundle(sample_data(), {digest: photo}, me="p2"), replace_existing=False)
    assert svc._repo.snapshot() == sample_data()
    assert svc.get_settings() == {"me_person_id": "p2"}
    assert svc._photos.path(digest).read_bytes() == photo


def test_import_data_is_refused_over_local_changes(svc):
    from custom_components.hearth_crm.db import ImportRefusedError
    from tests.conftest import sample_data

    svc.create("person", {"name": "Local Edit"}, "panel")
    with pytest.raises(ImportRefusedError):
        svc.import_data(_bundle(sample_data()), replace_existing=False)
    svc.import_data(_bundle(sample_data()), replace_existing=True)
    assert len(svc._repo.snapshot().people) == 4


def test_import_waits_for_a_service_write_in_progress(svc):
    """An import holds the service lock, so a concurrent edit cannot land a stale row over it."""
    import threading

    from tests.conftest import sample_data

    done = threading.Event()
    with svc._write_lock:  # a service write is between its read and its write
        thread = threading.Thread(
            target=lambda: (svc.import_data(_bundle(sample_data()), replace_existing=True),
                            done.set())
        )
        thread.start()
        assert not done.wait(0.2)
    assert done.wait(5)
    thread.join()


def test_changing_summary_sets_summary_updated(service_with_person):
    service, pid = service_with_person
    saved = service.update("person", pid, {"relationship_summary": "New words"}, "panel")
    assert saved["summary_updated"] == "2026-03-01"


def test_unchanged_summary_keeps_summary_updated(service_with_person):
    service, pid = service_with_person
    service.update("person", pid, {"relationship_summary": "Same", "summary_updated": "2025-01-01"}, "panel")
    saved = service.update("person", pid, {"relationship_summary": "Same", "phone": "555"}, "panel")
    assert saved["summary_updated"] == "2025-01-01"


def test_explicit_summary_updated_wins(service_with_person):
    service, pid = service_with_person
    saved = service.update(
        "person", pid, {"relationship_summary": "Words", "summary_updated": "2024-02-02"}, "panel"
    )
    assert saved["summary_updated"] == "2024-02-02"


def test_create_with_summary_sets_summary_updated(svc):
    with_summary = svc.create("person", {"name": "Blake Sample", "relationship_summary": "Hi"}, "panel")
    without = svc.create("person", {"name": "Casey Sample"}, "panel")
    assert with_summary["summary_updated"] == "2026-03-01"
    assert without["summary_updated"] is None


def test_text_longer_than_limit_is_refused(service_with_person):
    service, pid = service_with_person
    with pytest.raises(InvalidInput) as err:
        service.update("person", pid, {"name": "x" * 201}, "panel")
    assert err.value.field == "name"
    assert "200" in str(err.value)
    assert service.update("person", pid, {"name": "x" * 200}, "panel")["name"] == "x" * 200


def test_limits_cover_places_and_other_kinds(svc, service_with_person):
    service, pid = service_with_person
    with pytest.raises(InvalidInput) as err:
        service.update("person", pid, {"address": {"formatted": "y" * 1001}}, "panel")
    assert err.value.field == "address"
    assert "is longer than 1000 characters" in str(err.value)
    with pytest.raises(InvalidInput) as err:
        service.update("person", pid, {"school": {"formatted": "s" * 1001}}, "panel")
    assert err.value.field == "school"
    with pytest.raises(InvalidInput) as err:
        service.create("person", {"name": "Dana Sample", "notes": "n" * 20_001}, "panel")
    assert err.value.field == "notes"
    with pytest.raises(InvalidInput) as err:
        service.create("household", {"name_override": "h" * 201}, "panel")
    assert err.value.field == "name_override"
    with pytest.raises(InvalidInput) as err:
        service.create("household", {"address": {"formatted": "a" * 1001}}, "panel")
    assert err.value.field == "address"
    with pytest.raises(InvalidInput) as err:
        service.create("contact_group", {"name": "Group", "description": "d" * 20_001}, "panel")
    assert err.value.field == "description"
    with pytest.raises(InvalidInput) as err:
        service.create(
            "interaction",
            {"summary": "s" * 301, "date": "2026-01-01", "type": "call", "person_ids": [pid]},
            "panel",
        )
    assert err.value.field == "summary"


def test_import_is_not_limited(svc):
    import dataclasses

    from tests.conftest import sample_data

    data = sample_data()
    data.people[0] = dataclasses.replace(data.people[0], notes="n" * 25_000, name="x" * 250)
    svc.import_data(_bundle(data), replace_existing=False)
    saved = svc._repo.snapshot().people[0]
    assert len(saved.notes) == 25_000 and len(saved.name) == 250


def test_relationship_update_can_swap_ends(svc):
    from custom_components.hearth_crm.enums import ConnectionType

    josie = svc.create("person", {"name": "Josie Hollis"}, "panel")["id"]
    phil = svc.create("person", {"name": "Phil Hollis"}, "panel")["id"]
    rel = svc.create(
        "relationship", {"person_a_id": josie, "person_b_id": phil, "type": "Parent"}, "panel"
    )

    svc.update(
        "relationship",
        rel["id"],
        {"person_a_id": phil, "person_b_id": josie, "type": "Mentee"},
        "panel",
    )

    (row,) = svc.snapshot()["relationships"]
    assert row["person_a_id"] == phil
    assert row["person_b_id"] == josie
    assert row["type"] == "Mentee"
    assert row["inverse_type"] == ConnectionType.MENTEE.inverse.value == "Mentor"
