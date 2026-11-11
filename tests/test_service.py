"""Tests for HearthService (invented people only)."""

from __future__ import annotations

import io
import os
from datetime import date
from itertools import count
from pathlib import Path

import pytest
from PIL import Image

from custom_components.hearth_crm import reminders
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


# -- reminders ---------------------------------------------------------------------------

from datetime import UTC, datetime  # noqa: E402
from zoneinfo import ZoneInfo  # noqa: E402

CHICAGO = ZoneInfo("America/Chicago")


@pytest.fixture
def clock():
    return {"now": datetime(2026, 12, 1, 9, 0, tzinfo=CHICAGO)}


@pytest.fixture
def rsvc(tmp_path: Path, clock):
    """A service whose clock is Chicago time and can be moved by tests."""
    repo = CRMRepository(open_database(tmp_path / "crm.db"))
    ids = count(1)
    service = HearthService(
        repo,
        PhotoStore(tmp_path / "photos"),
        today=lambda: clock["now"].date(),
        now=lambda: clock["now"],
        new_id=lambda: f"id{next(ids)}",
    )
    service.create("person", {"name": "Alex Example"}, "panel")  # id1
    yield service
    repo.close()


def stored(svc, reminder_id):
    return svc._repo.get("reminder", reminder_id)


def utc(value: datetime) -> datetime:
    return value.astimezone(UTC)


def test_create_reminder_sets_the_anchor_and_reads_a_naive_due_time_in_the_homes_zone(rsvc):
    made = rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-08T08:00"}, "panel")
    saved = stored(rsvc, made["id"])
    assert utc(saved.due_at) == datetime(2026, 12, 8, 14, 0, tzinfo=UTC)
    assert saved.anchor_at == saved.due_at
    assert saved.notified_for is None and saved.done_at is None

    gap = rsvc.create("reminder", {"person_id": "id1", "due_at": "2027-03-14T02:30"}, "panel")
    local = stored(rsvc, gap["id"]).due_at.astimezone(CHICAGO)
    assert (local.hour, local.minute) == (3, 30)


def test_an_aware_due_time_is_kept_as_given(rsvc):
    made = rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-08T08:00:00+00:00"}, "panel")
    assert utc(stored(rsvc, made["id"]).due_at) == datetime(2026, 12, 8, 8, 0, tzinfo=UTC)


def test_someday_has_no_due_time_and_no_anchor(rsvc):
    made = rsvc.create("reminder", {"person_id": "id1", "note": "Send a card"}, "panel")
    saved = stored(rsvc, made["id"])
    assert saved.due_at is None and saved.anchor_at is None


def test_reminder_needs_an_existing_person(rsvc):
    with pytest.raises(InvalidInput) as err:
        rsvc.create("reminder", {"person_id": "ghost"}, "panel")
    assert err.value.field == "person_id"


def test_linked_interaction_must_exist(rsvc):
    with pytest.raises(InvalidInput) as err:
        rsvc.create("reminder", {"person_id": "id1", "interaction_id": "ghost"}, "panel")
    assert err.value.field == "interaction_id"
    interaction = rsvc.create(
        "interaction",
        {"summary": "Coffee", "date": "2026-12-01", "type": "Catch-up", "person_ids": ["id1"]},
        "panel",
    )
    made = rsvc.create(
        "reminder", {"person_id": "id1", "interaction_id": interaction["id"]}, "panel"
    )
    assert made["interaction_id"] == interaction["id"]


@pytest.mark.parametrize(
    "fields",
    [
        {"repeat_every": 1},
        {"repeat_unit": "week"},
        {"repeat_every": 1, "repeat_unit": "week"},  # no due time
        {"due_at": "2026-12-08T08:00", "repeat_every": 0, "repeat_unit": "week"},
        {"due_at": "2026-12-08T08:00", "repeat_every": 1000, "repeat_unit": "week"},
    ],
)
def test_repeat_needs_both_parts_a_due_time_and_a_sane_number(rsvc, fields):
    with pytest.raises(InvalidInput):
        rsvc.create("reminder", {"person_id": "id1"} | fields, "panel")


def test_a_repeat_with_both_parts_and_a_due_time_is_saved(rsvc):
    made = rsvc.create(
        "reminder",
        {"person_id": "id1", "due_at": "2026-12-08T08:00", "repeat_every": 999, "repeat_unit": "day"},
        "panel",
    )
    assert (made["repeat_every"], made["repeat_unit"]) == (999, "day")


def test_note_length_limit(rsvc):
    rsvc.create("reminder", {"person_id": "id1", "note": "x" * 20_000}, "panel")
    with pytest.raises(InvalidInput) as err:
        rsvc.create("reminder", {"person_id": "id1", "note": "x" * 20_001}, "panel")
    assert err.value.field == "note"


@pytest.mark.parametrize("field", ["anchor_at", "notified_for", "done_at", "id"])
def test_read_only_fields_are_refused(rsvc, field):
    with pytest.raises(InvalidInput):
        rsvc.create("reminder", {"person_id": "id1", field: "2026-12-08T08:00:00+00:00"}, "panel")
    made = rsvc.create("reminder", {"person_id": "id1"}, "panel")
    with pytest.raises(InvalidInput):
        rsvc.update("reminder", made["id"], {field: "2026-12-08T08:00:00+00:00"}, "panel")


def _armed(rsvc, **extra):
    made = rsvc.create(
        "reminder", {"person_id": "id1", "due_at": "2026-12-08T08:00"} | extra, "panel"
    )
    rsvc.mark_reminder_notified(made["id"], stored(rsvc, made["id"]).due_at)
    assert stored(rsvc, made["id"]).notified_for is not None
    return made["id"]


def test_changing_the_due_time_resets_the_anchor_and_re_arms(rsvc):
    reminder_id = _armed(rsvc)
    rsvc.update("reminder", reminder_id, {"due_at": "2026-12-09T10:00"}, "panel")
    saved = stored(rsvc, reminder_id)
    assert utc(saved.due_at) == datetime(2026, 12, 9, 16, 0, tzinfo=UTC)
    assert saved.anchor_at == saved.due_at
    assert saved.notified_for is None


def test_editing_only_the_note_or_the_repeat_rule_keeps_notified_for_and_anchor(rsvc):
    reminder_id = _armed(rsvc)
    before = stored(rsvc, reminder_id)
    rsvc.update("reminder", reminder_id, {"note": "Ask about the trip"}, "panel")
    rsvc.update("reminder", reminder_id, {"repeat_every": 2, "repeat_unit": "week"}, "panel")
    after = stored(rsvc, reminder_id)
    assert after.note == "Ask about the trip" and after.repeat_every == 2
    assert after.anchor_at == before.anchor_at
    assert after.notified_for == before.notified_for
    # the same due time sent again is not a change either
    rsvc.update("reminder", reminder_id, {"due_at": "2026-12-08T08:00"}, "panel")
    assert stored(rsvc, reminder_id).notified_for == before.notified_for


def test_changing_the_repeat_rule_re_anchors_at_the_current_due_time_without_re_arming(rsvc, clock):
    made = rsvc.create(
        "reminder",
        {"person_id": "id1", "due_at": "2026-12-08T08:00", "repeat_every": 1, "repeat_unit": "month"},
        "panel",
    )
    clock["now"] = datetime(2026, 12, 8, 9, 0, tzinfo=CHICAGO)
    rsvc.complete_reminder(made["id"], "panel")  # due 8 Jan
    rsvc.mark_reminder_notified(made["id"], stored(rsvc, made["id"]).anchor_at)
    clock["now"] = datetime(2027, 1, 8, 9, 0, tzinfo=CHICAGO)
    rsvc.complete_reminder(made["id"], "panel")  # due 8 Feb, anchor still 8 Dec
    before = stored(rsvc, made["id"])
    assert before.due_at.astimezone(CHICAGO) == datetime(2027, 2, 8, 8, 0, tzinfo=CHICAGO)
    assert before.anchor_at != before.due_at

    rsvc.update("reminder", made["id"], {"repeat_unit": "week"}, "panel")
    after = stored(rsvc, made["id"])
    assert after.anchor_at == after.due_at == before.due_at
    assert after.notified_for == before.notified_for  # editing the rule does not re-fire
    assert reminders.due_occurrence(
        after, datetime(2027, 2, 8, 8, 1, tzinfo=CHICAGO), CHICAGO
    ) == after.due_at

    rsvc.update("reminder", made["id"], {"repeat_every": 3}, "panel")
    assert stored(rsvc, made["id"]).anchor_at == before.due_at


def test_a_done_reminder_cannot_be_edited(rsvc):
    made = rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-08T08:00"}, "panel")
    rsvc.complete_reminder(made["id"], "panel")
    with pytest.raises(InvalidInput):
        rsvc.update("reminder", made["id"], {"note": "Too late"}, "panel")


def test_complete_one_time_sets_done_at(rsvc, clock):
    made = rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-08T08:00"}, "panel")
    clock["now"] = datetime(2026, 12, 8, 9, 0, tzinfo=CHICAGO)
    done = rsvc.complete_reminder(made["id"], "panel")
    assert utc(datetime.fromisoformat(done["done_at"])) == utc(clock["now"])
    assert stored(rsvc, made["id"]).done_at == clock["now"]


def _weekly(rsvc):
    return rsvc.create(
        "reminder",
        {"person_id": "id1", "due_at": "2026-12-08T08:00", "repeat_every": 1, "repeat_unit": "week"},
        "panel",
    )["id"]


def test_complete_repeating_moves_to_the_next_future_date_even_when_far_behind(rsvc, clock):
    reminder_id = _weekly(rsvc)
    clock["now"] = datetime(2027, 2, 2, 9, 0, tzinfo=CHICAGO)  # nine weeks late
    done = rsvc.complete_reminder(reminder_id, "panel")
    saved = stored(rsvc, reminder_id)
    assert saved.done_at is None and done["done_at"] is None
    assert saved.due_at.astimezone(CHICAGO) == datetime(2027, 2, 9, 8, 0, tzinfo=CHICAGO)


def test_complete_repeating_before_it_is_due_moves_to_the_following_date(rsvc, clock):
    reminder_id = _weekly(rsvc)
    rsvc.complete_reminder(reminder_id, "panel")  # clock is 2026-12-01, a week early
    assert stored(rsvc, reminder_id).due_at.astimezone(CHICAGO) == datetime(
        2026, 12, 15, 8, 0, tzinfo=CHICAGO
    )


def test_complete_repeating_bumps_updated_at(rsvc):
    reminder_id = _weekly(rsvc)
    before = stored(rsvc, reminder_id).updated_at
    rsvc.complete_reminder(reminder_id, "panel")
    assert stored(rsvc, reminder_id).updated_at > before


def test_complete_missing_reminder_is_not_found(rsvc):
    with pytest.raises(NotFound):
        rsvc.complete_reminder("ghost", "panel")


def test_mark_reminder_notified_does_not_touch_updated_at(rsvc):
    made = rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-08T08:00"}, "panel")
    before = stored(rsvc, made["id"])
    occurrence = before.due_at
    rsvc.mark_reminder_notified(made["id"], occurrence)
    after = stored(rsvc, made["id"])
    assert after.notified_for == occurrence and after.updated_at == before.updated_at


def test_edit_notes_of_the_interaction_do_not_change_the_reminder(rsvc):
    interaction = rsvc.create(
        "interaction",
        {"summary": "Coffee", "date": "2026-12-01", "type": "Catch-up", "person_ids": ["id1"]},
        "panel",
    )
    made = rsvc.create(
        "reminder", {"person_id": "id1", "interaction_id": interaction["id"], "note": "Follow up"}, "panel"
    )
    before = stored(rsvc, made["id"])
    rsvc.update("interaction", interaction["id"], {"notes": "Changed my mind"}, "panel")
    assert stored(rsvc, made["id"]) == before


def test_snapshot_lists_reminders_in_the_homes_zone(rsvc):
    rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-08T21:30"}, "panel")
    row = rsvc.snapshot()["reminders"][0]
    assert (row["due_date"], row["due_time"], row["state"]) == ("2026-12-08", "21:30", "upcoming")


def test_reminder_row_for_a_saved_reminder(rsvc):
    made = rsvc.create("reminder", {"person_id": "id1", "due_at": "2026-12-01T08:00"}, "panel")
    row = rsvc.reminder_row(made["id"])
    assert row["state"] == "due_today" and "anchor_at" not in row
