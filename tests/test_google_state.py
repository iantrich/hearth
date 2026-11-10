"""Tests for the Google sync state on HearthService (invented people only)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from itertools import count
from pathlib import Path

import pytest

from custom_components.hearth_crm.bundle import read_bundle, write_bundle
from custom_components.hearth_crm.db import CRMRepository, open_database
from custom_components.hearth_crm.google_payload import (
    ERROR_CONTACT_MISSING,
    ERROR_CREATE_UNCERTAIN,
    plan_for,
)
from custom_components.hearth_crm.photos import PhotoStore
from custom_components.hearth_crm.service import (
    UNSET,
    GoogleSyncRefused,
    HearthService,
    InvalidInput,
    NotBlocked,
    NotFound,
)

SYNCED = datetime(2026, 3, 2, 9, 0, tzinfo=UTC)
SYNCED_2 = datetime(2026, 3, 3, 9, 0, tzinfo=UTC)
GOOGLE_FIELDS = {"google_contact_id", "google_synced_at", "google_photo_hash", "google_sync_error"}


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
def person_id(svc) -> str:
    return svc.create("person", {"name": "Alex Example", "phone": "555-0101"}, "panel")["id"]


def _person(svc, person_id):
    return svc.read_data().people[0] if svc.read_data().people[0].id == person_id else None


def _last_log(svc):
    return svc._repo.changes(1)[0]


def test_read_data_returns_the_snapshot(svc, person_id):
    assert [p.id for p in svc.read_data().people] == [person_id]


def test_record_google_sync_does_not_bump_updated_at(svc, person_id):
    before = _person(svc, person_id)
    svc.record_google_sync(person_id, synced_at=SYNCED, contact_id="g-1", photo_hash="h1")
    after = _person(svc, person_id)
    assert after.updated_at == before.updated_at
    assert after.google_contact_id == "g-1"
    assert after.google_synced_at == SYNCED
    assert after.google_photo_hash == "h1"
    assert after.google_sync_error is None


def test_record_google_sync_is_logged_as_sync_and_changes_only_google_fields(svc, person_id):
    before = _person(svc, person_id)
    svc.record_google_sync(person_id, synced_at=SYNCED, contact_id="g-1")
    after = _person(svc, person_id)
    entry = _last_log(svc)
    assert (entry.source, entry.entity, entry.action) == ("sync", "person", "update")
    assert entry.entity_id == person_id
    assert set(entry.before) == GOOGLE_FIELDS
    assert set(entry.after) == GOOGLE_FIELDS
    assert entry.after["google_contact_id"] == "g-1"
    # Nothing outside the google fields moved.
    for name in ("name", "phone", "email", "updated_at", "created_at", "photo_hash"):
        assert getattr(after, name) == getattr(before, name)


def test_unset_leaves_fields_alone_and_none_clears_them(svc, person_id):
    svc.record_google_sync(person_id, synced_at=SYNCED, contact_id="g-1", photo_hash="h1")
    svc.record_google_sync(person_id, synced_at=SYNCED_2)  # contact_id, photo_hash unset
    p = _person(svc, person_id)
    assert (p.google_contact_id, p.google_photo_hash) == ("g-1", "h1")
    assert p.google_synced_at == SYNCED_2
    svc.record_google_sync(person_id, synced_at=SYNCED_2, contact_id=None, photo_hash=None)
    p = _person(svc, person_id)
    assert (p.google_contact_id, p.google_photo_hash) == (None, None)


def test_record_google_sync_without_synced_at_leaves_the_synced_time(svc, person_id):
    svc.record_google_sync(person_id, synced_at=SYNCED, contact_id="g-1", photo_hash="h1")
    svc.record_google_sync(person_id, error=ERROR_CONTACT_MISSING)
    p = _person(svc, person_id)
    assert p.google_synced_at == SYNCED
    assert p.google_sync_error == ERROR_CONTACT_MISSING
    assert p.google_contact_id == "g-1"

    svc.record_google_sync(person_id, photo_hash="h2")
    p = _person(svc, person_id)
    assert p.google_synced_at == SYNCED
    assert p.google_photo_hash == "h2"
    assert p.google_sync_error is None  # error is always written


def test_synced_at_none_clears_the_synced_time(svc, person_id):
    svc.record_google_sync(person_id, synced_at=SYNCED)
    svc.record_google_sync(person_id, synced_at=None)
    assert _person(svc, person_id).google_synced_at is None


def test_unset_is_a_distinct_sentinel():
    assert UNSET is not None
    assert repr(UNSET) == "UNSET"


def test_record_google_sync_for_a_deleted_person_raises_not_found(svc, person_id):
    svc.delete("person", person_id, "panel")
    with pytest.raises(NotFound):
        svc.record_google_sync(person_id, synced_at=SYNCED, contact_id="g-1")


def test_clearing_a_google_contact_makes_the_person_look_new(svc, person_id):
    svc.record_google_sync(
        person_id, synced_at=SYNCED, contact_id="g-1", photo_hash="h1", error=ERROR_CONTACT_MISSING
    )
    assert plan_for(_person(svc, person_id), None).kind == "blocked"

    svc.clear_google_contact(person_id, "panel")

    p = _person(svc, person_id)
    assert (p.google_contact_id, p.google_synced_at, p.google_photo_hash, p.google_sync_error) == (
        None, None, None, None,
    )
    assert plan_for(p, None).kind == "create"
    entry = _last_log(svc)
    assert (entry.source, entry.entity, entry.action) == ("panel", "person", "update")


def test_clearing_an_uncertain_create_is_allowed(svc, person_id):
    svc.record_google_sync(person_id, error=ERROR_CREATE_UNCERTAIN)
    svc.clear_google_contact(person_id, "panel")
    assert _person(svc, person_id).google_sync_error is None


@pytest.mark.parametrize(
    ("contact_id", "error"),
    [
        ("g-1", None),  # linked and working
        ("g-1", "HTTP 400 FAILED_PRECONDITION"),  # another error: retried, not blocked
        ("g-1", ERROR_CREATE_UNCERTAIN),  # not the blocked combination
        (None, None),  # never linked
        (None, ERROR_CONTACT_MISSING),  # not the blocked combination
    ],
)
def test_clearing_is_refused_unless_the_sync_is_blocked_on_the_person(
    svc, person_id, contact_id, error
):
    svc.record_google_sync(person_id, synced_at=SYNCED, contact_id=contact_id, error=error)
    log_before = len(svc._repo.changes(1000))

    with pytest.raises(NotBlocked):
        svc.clear_google_contact(person_id, "panel")

    p = _person(svc, person_id)
    assert (p.google_contact_id, p.google_synced_at, p.google_sync_error) == (
        contact_id, SYNCED, error,
    )
    assert len(svc._repo.changes(1000)) == log_before


def test_clearing_for_a_deleted_person_raises_not_found(svc, person_id):
    svc.delete("person", person_id, "panel")
    with pytest.raises(NotFound):
        svc.clear_google_contact(person_id, "panel")


def test_enabling_the_sync_is_refused_before_cutover_and_allowed_after(svc):
    assert svc.get_google_settings() == {"enabled": False, "cutover_confirmed": False}
    with pytest.raises(GoogleSyncRefused, match="cutover has not been confirmed"):
        svc.set_google_sync_enabled(True, "panel")
    assert svc.get_google_settings()["enabled"] is False

    svc._repo.set_cutover_confirmed()
    svc.set_google_sync_enabled(True, "panel")
    assert svc.get_google_settings() == {"enabled": True, "cutover_confirmed": True}
    entry = _last_log(svc)
    assert (entry.source, entry.entity, entry.entity_id) == ("panel", "setting", "google_sync_enabled")


def test_disabling_the_sync_always_works(svc):
    svc.set_google_sync_enabled(False, "panel")  # never enabled, no cutover
    assert svc.get_google_settings()["enabled"] is False

    svc._repo.set_cutover_confirmed()
    svc.set_google_sync_enabled(True, "panel")
    svc.set_google_sync_enabled(False, "panel")
    assert svc.get_google_settings()["enabled"] is False


def test_a_normal_person_edit_still_cannot_set_google_fields(svc, person_id):
    for name in GOOGLE_FIELDS:
        with pytest.raises(InvalidInput):
            svc.update("person", person_id, {name: "x"}, "panel")


def test_the_verified_google_link_is_not_carried_by_a_bundle(svc, person_id, tmp_path):
    svc.mark_google_link_verified()
    data, me = svc._repo.export_state()
    path = tmp_path / "out.zip"
    write_bundle(path, data, lambda h: b"", me_person_id=me)

    repo = CRMRepository(open_database(tmp_path / "other.db"))
    try:
        other = HearthService(repo, PhotoStore(tmp_path / "other"), today=lambda: date(2026, 3, 1))
        other.import_data(read_bundle(path), replace_existing=False)
        assert other.google_link_verified() is False
    finally:
        repo.close()
    # Like the other google settings, an import into this CRM leaves it alone.
    svc.import_data(read_bundle(path), replace_existing=True)
    assert svc.google_link_verified() is True
    entry = _last_log(svc)
    assert entry.source == "import"


def test_google_sync_state_survives_a_bundle_round_trip(svc, person_id, tmp_path):
    svc.record_google_sync(
        person_id, synced_at=SYNCED, contact_id="g-1", photo_hash="h1", error="boom"
    )
    data, me = svc._repo.export_state()
    path = tmp_path / "out.zip"
    write_bundle(path, data, lambda h: b"", me_person_id=me)
    restored = read_bundle(path).data.people[0]
    assert restored.google_contact_id == "g-1"
    assert restored.google_synced_at == SYNCED
    assert restored.google_photo_hash == "h1"
    assert restored.google_sync_error == "boom"
