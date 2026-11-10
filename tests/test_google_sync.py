"""Tests for the Google sync engine (invented people only).

A real ``HearthService`` over a temporary database, and a fake ``PeopleClient`` that
exposes only the four calls the sync may make, so no test talks to Google.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import threading
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from itertools import count
from pathlib import Path
from typing import Any

import aiohttp
import pytest
from homeassistant.exceptions import (
    OAuth2TokenRequestConnectionError,
    OAuth2TokenRequestReauthError,
    OAuth2TokenRequestTransientError,
)
from PIL import Image

from custom_components.hearth_crm.const import DOMAIN
from custom_components.hearth_crm.db import BackupInProgress, CRMRepository, open_database
from custom_components.hearth_crm.google_client import (
    API_DISABLED_MESSAGE,
    AccessRefused,
    ContactMissing,
    Created,
    CreateUncertain,
    GoogleError,
    InvalidResourceName,
    RateLimited,
)
from custom_components.hearth_crm.google_link import GoogleAuthError
from custom_components.hearth_crm.google_payload import (
    ERROR_CONTACT_MISSING,
    ERROR_CREATE_UNCERTAIN,
)
from custom_components.hearth_crm.google_sync import (
    MAX_PROBLEMS,
    MAX_WOULD_CREATE,
    MISMATCH_PROBE,
    STORE_RETRIES,
    STORE_RETRY_DELAY,
    GoogleSyncer,
    SyncOutcome,
    SyncReport,
    report_to_dict,
)
from custom_components.hearth_crm.photos import PhotoStore
from custom_components.hearth_crm.service import HearthService, StorageError

LONG_AGO = datetime(2020, 1, 1, tzinfo=UTC)


class FakeClient:
    """Only create, get_etag, update and photo: nothing else exists to be called.

    ``fail`` maps a call (``"create"``, ``"get_etag"``, ``"update"``, ``"photo"``) to a
    function of its key (the given name for create, the resource name otherwise) that
    returns an exception to raise, or ``None``. ``during`` runs before a call answers.
    """

    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []
        self.fail: dict[str, Callable[[str], BaseException | None]] = {}
        self.during: dict[str, Callable[[str], Any]] = {}
        self._ids = count(1001)

    async def _maybe(self, call: str, key: str) -> None:
        hook = self.during.get(call)
        if hook is not None:
            hook(key)
        make = self.fail.get(call)
        err = make(key) if make else None
        if err is not None:
            raise err

    async def create_contact(self, body: dict) -> Created:
        given = body["names"][0]["givenName"]
        self.calls.append(("create", body))
        await self._maybe("create", given)
        return Created(resource_name=f"people/c{next(self._ids)}", etag="e0")

    async def get_etag(self, resource_name: str) -> str:
        self.calls.append(("get_etag", resource_name))
        await self._maybe("get_etag", resource_name)
        return f"etag-{resource_name}"

    async def update_contact(self, resource_name: str, etag: str, body: dict) -> None:
        self.calls.append(("update", (resource_name, etag, body)))
        await self._maybe("update", resource_name)

    async def update_photo(self, resource_name: str, jpeg: bytes) -> None:
        self.calls.append(("photo", (resource_name, jpeg)))
        await self._maybe("photo", resource_name)

    def kinds(self) -> list[str]:
        return [kind for kind, _ in self.calls]


@pytest.fixture
def photos(tmp_path: Path) -> PhotoStore:
    return PhotoStore(tmp_path / "photos")


@pytest.fixture
def svc(tmp_path: Path, photos: PhotoStore) -> HearthService:
    repo = CRMRepository(open_database(tmp_path / "crm.db"))
    ids = count(1)
    service = HearthService(
        repo, photos, today=lambda: date(2026, 3, 1), new_id=lambda: f"id{next(ids)}"
    )
    yield service
    repo.close()


@pytest.fixture
def client() -> FakeClient:
    return FakeClient()


def _syncer(svc: HearthService, client: FakeClient, photos: PhotoStore, **kw) -> GoogleSyncer:
    return GoogleSyncer(
        svc,
        client,
        photo_bytes=kw.pop("photo_bytes", lambda h: photos.path(h).read_bytes()),
        now=kw.pop("now", lambda: datetime.now(UTC)),
        **kw,
    )


def _add(svc: HearthService, name: str, **fields) -> str:
    return svc.create("person", {"name": name, **fields}, "panel")["id"]


def _person(svc: HearthService, person_id: str):
    return next(p for p in svc.read_data().people if p.id == person_id)


def _png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (40, 40), (30, 120, 200)).save(out, format="PNG")
    return out.getvalue()


def _linked(svc: HearthService, name: str, contact_id: str, **fields) -> str:
    """A person already linked to a Google contact and synced long ago."""
    pid = _add(svc, name, **fields)
    svc.record_google_sync(pid, contact_id=contact_id, synced_at=LONG_AGO)
    return pid


def _fresh(svc: HearthService, pid: str) -> None:
    """Mark the person synced now, so they have no work."""
    svc.record_google_sync(pid, synced_at=datetime.now(UTC) + timedelta(days=1))


# -- Review Focus 1 ---------------------------------------------------------


async def test_a_person_with_a_stored_id_is_updated_and_never_created(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    # Very stale: synced years ago, edited since.
    svc.update("person", pid, {"notes": "edited"}, "panel")

    report = await _syncer(svc, client, photos).run()

    assert "create" not in client.kinds()
    assert client.kinds() == ["get_etag", "update"]
    assert client.calls[1][1][0] == "people/c77"
    assert (report.created, report.updated) == (0, 1)
    after = _person(svc, pid)
    assert after.google_contact_id == "people/c77"
    assert after.google_synced_at == report.started_at


async def test_dry_run_makes_no_google_call_and_writes_nothing(svc, client, photos):
    new_a = _add(svc, "Avery Newcomb", phone="402-555-0121")
    _add(svc, "Blake Newcomb", email="blake@example.invalid")
    _linked(svc, "Casey Linked", "people/c5", phone="402-555-0123")
    _add(svc, "Quiet Person")
    before = svc.read_data()
    log_before = len(svc._repo.changes(1000))
    read: list[str] = []

    report = await _syncer(
        svc, client, photos, photo_bytes=lambda h: read.append(h) or b""
    ).run(dry_run=True)

    assert client.calls == []
    assert read == []
    assert svc.read_data() == before
    assert len(svc._repo.changes(1000)) == log_before
    assert report.dry_run is True
    assert report.would_create == ["Avery Newcomb", "Blake Newcomb"]
    assert report.would_update == 1
    assert report.skipped == 1
    assert _person(svc, new_a).google_synced_at is None


# -- the basic paths --------------------------------------------------------


async def test_create_writes_the_id_back_and_marks_synced(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121", email="avery@example.invalid")

    report = await _syncer(svc, client, photos).run()

    assert client.kinds() == ["create"]
    body = client.calls[0][1]
    assert body["names"] == [{"givenName": "Avery", "familyName": "Newcomb"}]
    assert body["phoneNumbers"] == [{"value": "402-555-0121", "type": "mobile"}]
    after = _person(svc, pid)
    assert after.google_contact_id == "people/c1001"
    assert after.google_synced_at == report.started_at
    assert after.google_sync_error is None
    assert report.created == 1
    assert report.errors == 0


def _refuse_id_writes(svc: HearthService, times: int, err: Exception) -> list[int]:
    """Make the next ``times`` writes that store a contact id raise ``err``."""
    refused = [0]
    real = svc.record_google_sync

    def record(person_id, **kw):
        if isinstance(kw.get("contact_id"), str) and refused[0] < times:
            refused[0] += 1
            raise err
        return real(person_id, **kw)

    svc.record_google_sync = record  # type: ignore[method-assign]
    return refused


@pytest.mark.parametrize(
    "err",
    [
        BackupInProgress(),
        StorageError("could not save"),
        TimeoutError("Hearth's database is busy (another write is running)"),
    ],
    ids=["backup", "storage", "write-gate-timeout"],
)
async def test_a_new_id_the_database_refuses_for_a_moment_is_retried(svc, client, photos, err):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    refused = _refuse_id_writes(svc, STORE_RETRIES, err)
    slept: list[float] = []

    async def sleep(seconds: float) -> None:
        slept.append(seconds)

    report = await _syncer(svc, client, photos, sleep=sleep).run()

    assert refused == [STORE_RETRIES]
    assert slept == [STORE_RETRY_DELAY] * STORE_RETRIES
    assert report.created == 1
    after = _person(svc, pid)
    assert (after.google_contact_id, after.google_sync_error) == ("people/c1001", None)


async def test_a_new_id_the_database_keeps_refusing_is_stored_next_run(
    svc, client, photos, caplog
):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    svc.set_photo("person", pid, _png(), "panel")
    _refuse_id_writes(svc, STORE_RETRIES + 1, StorageError("could not save Avery"))

    async def sleep(_seconds: float) -> None:
        return None

    syncer = _syncer(svc, client, photos, sleep=sleep)
    with caplog.at_level(logging.WARNING):
        report = await syncer.run()

    assert client.kinds() == ["create"]
    assert report.created == 1
    after = _person(svc, pid)
    # The marker stays, so no later run creates a second contact.
    assert (after.google_contact_id, after.google_sync_error) == (None, ERROR_CREATE_UNCERTAIN)
    assert "StorageError" in caplog.text
    assert "Avery" not in caplog.text

    client.calls.clear()
    second = await syncer.run()

    assert "create" not in client.kinds()
    assert client.kinds() == ["get_etag", "update", "photo"]
    assert client.calls[0][1] == "people/c1001"
    assert (second.updated, second.photos) == (1, 1)
    after = _person(svc, pid)
    assert (after.google_contact_id, after.google_sync_error) == ("people/c1001", None)
    assert after.google_synced_at == second.started_at


async def test_a_write_gate_timeout_never_turns_the_create_marker_into_a_network_error(
    svc, client, photos
):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    _refuse_id_writes(svc, STORE_RETRIES + 1, TimeoutError("database is busy"))

    async def sleep(_seconds: float) -> None:
        return None

    report = await _syncer(svc, client, photos, sleep=sleep).run()

    assert (report.created, report.errors, report.problems) == (1, 0, [])
    after = _person(svc, pid)
    assert (after.google_contact_id, after.google_sync_error) == (None, ERROR_CREATE_UNCERTAIN)


async def test_an_unsaved_id_is_dropped_if_the_person_was_deleted_meanwhile(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    _refuse_id_writes(svc, STORE_RETRIES + 1, StorageError("could not save"))

    async def sleep(_seconds: float) -> None:
        return None

    syncer = _syncer(svc, client, photos, sleep=sleep)
    await syncer.run()
    svc.delete("person", pid, "panel")

    client.calls.clear()
    second = await syncer.run()

    assert client.calls == []
    assert syncer._unsaved_ids == {}
    assert second.errors == 0


async def test_the_create_marker_is_written_before_the_create_is_sent(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    seen: list[tuple[str | None, str | None]] = []
    client.during["create"] = lambda _k: seen.append(
        (_person(svc, pid).google_sync_error, _person(svc, pid).google_contact_id)
    )

    await _syncer(svc, client, photos).run()

    assert seen == [(ERROR_CREATE_UNCERTAIN, None)]
    assert _person(svc, pid).google_sync_error is None


async def test_a_cancelled_create_leaves_the_person_blocked(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["create"] = lambda _k: asyncio.CancelledError()

    with pytest.raises(asyncio.CancelledError):
        await _syncer(svc, client, photos).run()

    after = _person(svc, pid)
    assert after.google_sync_error == ERROR_CREATE_UNCERTAIN
    assert after.google_contact_id is None
    assert after.google_synced_at is None
    # The next sweep does not create it again.
    client.fail.clear()
    client.calls.clear()
    report = await _syncer(svc, client, photos).run()
    assert client.calls == []
    assert report.created == 0


async def test_an_uncertain_create_stores_its_error_and_is_not_retried(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["create"] = lambda _k: CreateUncertain(503)

    report = await _syncer(svc, client, photos).run()

    after = _person(svc, pid)
    assert after.google_sync_error == ERROR_CREATE_UNCERTAIN
    assert after.google_synced_at is None
    assert report.errors == 1
    assert report.problems[0].kind == "error"
    client.calls.clear()
    await _syncer(svc, client, photos).run()
    assert client.calls == []


async def test_a_refused_create_stores_a_short_reason_and_is_retried(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["create"] = lambda _k: GoogleError(400, "HTTP 400 INVALID_ARGUMENT")

    report = await _syncer(svc, client, photos).run()

    assert _person(svc, pid).google_sync_error == "HTTP 400 INVALID_ARGUMENT"
    assert report.errors == 1
    client.fail.clear()
    await _syncer(svc, client, photos).run()
    assert _person(svc, pid).google_contact_id is not None
    assert _person(svc, pid).google_sync_error is None


async def test_update_fetches_the_etag_then_patches(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")

    report = await _syncer(svc, client, photos).run()

    assert client.calls[0] == ("get_etag", "people/c77")
    kind, (resource, etag, body) = client.calls[1]
    assert (kind, resource, etag) == ("update", "people/c77", "etag-people/c77")
    assert body["phoneNumbers"] == [{"value": "402-555-0111", "type": "mobile"}]
    assert "etag" not in body
    assert _person(svc, pid).google_synced_at == report.started_at
    assert report.updated == 1


async def test_skipped_people_are_marked_synced_and_not_sent(svc, client, photos):
    nameless_contact = _add(svc, "Second Quiet Person")
    contactless = _add(svc, "Quiet Person")
    report = await _syncer(svc, client, photos).run()

    assert client.calls == []
    assert report.skipped == 2
    for pid in (nameless_contact, contactless):
        after = _person(svc, pid)
        assert after.google_synced_at == report.started_at
        assert after.google_sync_error is None
        assert after.google_contact_id is None
    # Nothing to do next time.
    report = await _syncer(svc, client, photos).run()
    assert report.skipped == 0


async def test_a_nameless_person_is_skipped(svc, client, photos):
    pid = _add(svc, "Placeholder", phone="402-555-0132")
    # A blank name can't be saved through the service; plant one in storage.
    person = _person(svc, pid)
    person.name = "  "
    svc._repo.update("person", person, "panel")

    report = await _syncer(svc, client, photos).run()

    assert client.calls == []
    assert report.skipped == 1


async def test_a_photo_is_uploaded_when_its_hash_differs_and_recorded(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    photo_hash = svc.set_photo("person", pid, _png(), "panel")

    report = await _syncer(svc, client, photos).run()

    assert client.kinds() == ["get_etag", "update", "photo"]
    assert client.calls[2][1] == ("people/c77", photos.path(photo_hash).read_bytes())
    after = _person(svc, pid)
    assert after.google_photo_hash == photo_hash
    assert report.photos == 1

    # Unchanged since: nothing to send.
    client.calls.clear()
    await _syncer(svc, client, photos).run()
    assert client.calls == []


async def test_a_new_person_with_a_photo_is_created_then_given_it(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    photo_hash = svc.set_photo("person", pid, _png(), "panel")

    report = await _syncer(svc, client, photos).run()

    assert client.kinds() == ["create", "photo"]
    assert client.calls[1][1][0] == "people/c1001"
    assert _person(svc, pid).google_photo_hash == photo_hash
    assert (report.created, report.photos) == (1, 1)


async def test_a_photo_only_change_keeps_synced_at(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    photo_hash = svc.set_photo("person", pid, _png(), "panel")
    _fresh(svc, pid)
    synced = _person(svc, pid).google_synced_at

    report = await _syncer(svc, client, photos).run()

    assert client.kinds() == ["photo"]
    after = _person(svc, pid)
    assert after.google_photo_hash == photo_hash
    assert after.google_synced_at == synced
    assert (report.updated, report.photos) == (0, 1)


async def test_a_photo_failure_keeps_the_contact_write(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    svc.set_photo("person", pid, _png(), "panel")
    client.fail["photo"] = lambda _k: GoogleError(400, "HTTP 400 INVALID_ARGUMENT")

    report = await _syncer(svc, client, photos).run()

    after = _person(svc, pid)
    assert after.google_synced_at == report.started_at
    assert after.google_photo_hash is None
    assert after.google_sync_error == "HTTP 400 INVALID_ARGUMENT"
    assert (report.updated, report.photos, report.errors) == (1, 0, 1)
    # The next run retries only the photo.
    client.fail.clear()
    client.calls.clear()
    await _syncer(svc, client, photos).run()
    assert client.kinds() == ["photo"]
    assert _person(svc, pid).google_sync_error is None


async def test_an_unreadable_photo_file_is_recorded_per_person(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    svc.set_photo("person", pid, _png(), "panel")

    def gone(_h: str) -> bytes:
        raise FileNotFoundError("/secret/path")

    report = await _syncer(svc, client, photos, photo_bytes=gone).run()

    assert client.kinds() == ["get_etag", "update"]
    assert _person(svc, pid).google_sync_error == "photo file could not be read"
    assert report.errors == 1


# -- Review Focus 2 ---------------------------------------------------------


async def test_a_missing_contact_is_flagged_once_and_not_retried(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    client.fail["get_etag"] = lambda _k: ContactMissing()

    report = await _syncer(svc, client, photos).run()

    after = _person(svc, pid)
    assert after.google_sync_error == ERROR_CONTACT_MISSING
    assert after.google_synced_at == LONG_AGO
    assert after.google_contact_id == "people/c77"
    assert report.missing == 1
    assert report.problems == [
        SyncOutcome(pid, "Rowan Testwood", "missing", ERROR_CONTACT_MISSING)
    ]

    client.calls.clear()
    second = await _syncer(svc, client, photos).run()
    assert client.calls == []
    assert second.missing == 0

    # Clearing the contact in the panel makes the next run create a fresh one.
    svc.clear_google_contact(pid, "panel")
    await _syncer(svc, client, photos).run()
    assert client.kinds() == ["create"]
    assert _person(svc, pid).google_contact_id == "people/c1001"


def _linked_many(svc: HearthService, n: int) -> list[str]:
    return [
        _linked(svc, f"Rowan Test{i}", f"people/c{100 + i}", phone=f"402-555-01{10 + i:02d}")
        for i in range(n)
    ]


async def test_a_wrong_google_account_stops_the_run_and_stores_nothing(svc, client, photos):
    pids = _linked_many(svc, MISMATCH_PROBE + 2)
    client.fail["get_etag"] = lambda _k: ContactMissing()

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "account_mismatch"
    assert client.kinds() == ["get_etag"] * MISMATCH_PROBE
    assert (report.missing, report.errors, report.problems) == (0, 0, [])
    assert report.pending == len(pids)
    for pid in pids:
        after = _person(svc, pid)
        assert after.google_sync_error is None
        assert after.google_synced_at == LONG_AGO
        assert after.google_contact_id is not None
    assert report_to_dict(report)["stopped_reason"] == "account_mismatch"


async def test_missing_contacts_are_stored_once_another_contact_is_found(svc, client, photos):
    pids = _linked_many(svc, MISMATCH_PROBE)
    found = pids[-1]
    client.fail["get_etag"] = lambda k: None if k == "people/c104" else ContactMissing()

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason is None
    assert (report.missing, report.updated, report.pending) == (MISMATCH_PROBE - 1, 1, 0)
    for pid in pids[:-1]:
        assert _person(svc, pid).google_sync_error == ERROR_CONTACT_MISSING
    assert _person(svc, found).google_sync_error is None
    assert [p.kind for p in report.problems] == ["missing"] * (MISMATCH_PROBE - 1)


async def test_a_short_run_of_missing_contacts_is_stored_at_the_end(svc, client, photos):
    pids = _linked_many(svc, MISMATCH_PROBE - 1)
    client.fail["get_etag"] = lambda _k: ContactMissing()

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason is None
    assert report.missing == MISMATCH_PROBE - 1
    for pid in pids:
        assert _person(svc, pid).google_sync_error == ERROR_CONTACT_MISSING


async def test_missing_contacts_held_when_a_run_stops_early_stay_pending(svc, client, photos):
    pids = _linked_many(svc, 3)
    client.fail["get_etag"] = lambda k: (
        RateLimited(429, "HTTP 429") if k == "people/c102" else ContactMissing()
    )

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "rate_limited"
    assert (report.missing, report.pending) == (0, 3)
    for pid in pids:
        assert _person(svc, pid).google_sync_error is None


async def test_the_mismatch_probe_ends_with_the_first_contact_found(svc, client, photos):
    first = _linked(svc, "Sage Testwood", "people/c90", phone="402-555-0190")
    pids = _linked_many(svc, MISMATCH_PROBE + 1)
    client.fail["get_etag"] = lambda k: None if k == "people/c90" else ContactMissing()

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason is None
    assert (report.updated, report.missing) == (1, len(pids))
    assert _person(svc, first).google_sync_error is None


def _network(svc, client, photos, pid):
    client.fail["get_etag"] = lambda k: (
        aiohttp.ClientConnectionError() if k == "people/c104" else ContactMissing()
    )


def _server_error(svc, client, photos, pid):
    client.fail["get_etag"] = lambda k: (
        GoogleError(503, "HTTP 503 UNAVAILABLE") if k == "people/c104" else ContactMissing()
    )


def _bad_id(svc, client, photos, pid):
    client.fail["get_etag"] = lambda k: (
        InvalidResourceName() if k == "people/c104" else ContactMissing()
    )


def _photo_only(svc, client, photos, pid):
    svc.set_photo("person", pid, _png(), "panel")
    _fresh(svc, pid)
    client.fail["get_etag"] = lambda _k: ContactMissing()


def _deleted_mid_run(svc, client, photos, pid):
    client.fail["get_etag"] = lambda k: None if k == "people/c104" else ContactMissing()
    client.during["update"] = lambda _k: svc.delete("person", pid, "panel")


@pytest.mark.parametrize(
    "outcome",
    [_network, _server_error, _bad_id, _photo_only, _deleted_mid_run],
    ids=["network", "5xx", "bad-id", "photo-only", "deleted-mid-run"],
)
async def test_only_a_written_contact_settles_the_mismatch_probe(svc, client, photos, outcome):
    pids = _linked_many(svc, MISMATCH_PROBE + 1)
    outcome(svc, client, photos, pids[4])

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "account_mismatch"
    assert report.missing == 0
    for pid in pids[:4] + pids[5:]:
        assert _person(svc, pid).google_sync_error is None


async def test_stored_synced_times_alone_do_not_verify_the_link(svc, client, photos):
    # Linked people synced long ago (as by an earlier tool) still get the breaker's
    # protection: only Google accepting a write through this link verifies it.
    pids = _linked_many(svc, MISMATCH_PROBE)
    client.fail["get_etag"] = lambda _k: ContactMissing()

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "account_mismatch"
    assert svc.google_link_verified() is False
    assert all(_person(svc, pid).google_sync_error is None for pid in pids)


@pytest.mark.parametrize("first_write", ["update", "create"])
async def test_once_the_link_is_verified_missing_contacts_are_stored(
    svc, client, photos, first_write
):
    if first_write == "update":
        _linked(svc, "Sage Testwood", "people/c90", phone="402-555-0190")
    else:
        _add(svc, "Avery Newcomb", phone="402-555-0121")
    await _syncer(svc, client, photos).run()
    assert svc.google_link_verified() is True

    pids = _linked_many(svc, MISMATCH_PROBE + 2)
    client.fail["get_etag"] = lambda _k: ContactMissing()
    client.calls.clear()
    # A new engine (as after a restart) reads the setting from the database.
    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason is None
    assert report.missing == len(pids)
    assert client.kinds() == ["get_etag"] * len(pids)
    for pid in pids:
        assert _person(svc, pid).google_sync_error == ERROR_CONTACT_MISSING


async def test_the_verified_link_survives_reopening_the_database(svc, client, photos, tmp_path):
    _linked(svc, "Sage Testwood", "people/c90", phone="402-555-0190")
    await _syncer(svc, client, photos).run()
    svc._repo.close()

    repo = CRMRepository(open_database(tmp_path / "crm.db"))
    try:
        reopened = HearthService(repo, photos, today=lambda: date(2026, 3, 1))
        assert reopened.google_link_verified() is True
    finally:
        repo.close()


async def test_marking_the_link_verified_does_not_bump_updated_at(svc, client, photos):
    pid = _linked(svc, "Sage Testwood", "people/c90", phone="402-555-0190")
    before = _person(svc, pid).updated_at

    await _syncer(svc, client, photos).run()

    assert _person(svc, pid).updated_at == before
    entry = svc._repo.changes(1)[0]
    assert (entry.source, entry.entity_id) == ("sync", "google_link_verified")


async def test_a_run_after_a_mismatch_stop_tries_other_people_first(svc, client, photos):
    pids = _linked_many(svc, MISMATCH_PROBE + 1)
    deleted = {f"people/c{100 + i}" for i in range(MISMATCH_PROBE)}
    client.fail["get_etag"] = lambda k: ContactMissing() if k in deleted else None
    syncer = _syncer(svc, client, photos)

    first = await syncer.run()
    assert first.stopped_reason == "account_mismatch"

    client.calls.clear()
    second = await syncer.run()

    # The person not tried last time goes first, is found, and verifies the link; the
    # really deleted contacts are then stored as missing, so the panel can offer new ones.
    assert client.calls[0] == ("get_etag", f"people/c{100 + MISMATCH_PROBE}")
    assert second.stopped_reason is None
    assert (second.updated, second.missing) == (1, MISMATCH_PROBE)
    assert svc.google_link_verified() is True
    for pid in pids[:MISMATCH_PROBE]:
        assert _person(svc, pid).google_sync_error == ERROR_CONTACT_MISSING


async def test_another_google_error_is_recorded_and_retried_next_run(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    other = _linked(svc, "Sage Testwood", "people/c78", phone="402-555-0112")
    client.fail["update"] = lambda k: (
        GoogleError(400, "HTTP 400 FAILED_PRECONDITION") if k == "people/c77" else None
    )

    report = await _syncer(svc, client, photos).run()

    failed = _person(svc, pid)
    assert failed.google_sync_error == "HTTP 400 FAILED_PRECONDITION"
    assert failed.google_synced_at == LONG_AGO
    assert _person(svc, other).google_synced_at == report.started_at
    assert (report.updated, report.errors) == (1, 1)
    assert report.problems[0].message == "HTTP 400 FAILED_PRECONDITION"

    client.fail.clear()
    client.calls.clear()
    second = await _syncer(svc, client, photos).run()
    assert client.kinds() == ["get_etag", "update"]
    assert _person(svc, pid).google_sync_error is None
    assert second.updated == 1


async def test_network_and_bad_id_errors_are_recorded_per_person(svc, client, photos):
    bad = _linked(svc, "Bad Id", "not-a-resource", phone="402-555-0113")
    flaky = _linked(svc, "Flaky Line", "people/c79", phone="402-555-0114")
    fine = _linked(svc, "Fine Line", "people/c80", phone="402-555-0115")

    def fail(key: str) -> BaseException | None:
        if key == "not-a-resource":
            return InvalidResourceName()
        if key == "people/c79":
            return aiohttp.ClientConnectionError("boom")
        return None

    client.fail["get_etag"] = fail

    report = await _syncer(svc, client, photos).run()

    assert _person(svc, bad).google_sync_error == "not a People API contact resource name"
    assert _person(svc, flaky).google_sync_error == "network error"
    assert _person(svc, fine).google_synced_at == report.started_at
    assert (report.updated, report.errors, report.stopped_reason) == (1, 2, None)


async def test_a_timeout_is_recorded_per_person(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    client.fail["update"] = lambda _k: TimeoutError()

    report = await _syncer(svc, client, photos).run()

    assert _person(svc, pid).google_sync_error == "network error"
    assert report.errors == 1


# -- Review Focus 3 ---------------------------------------------------------


async def test_a_run_stopped_by_rate_limiting_resumes_where_it_stopped(svc, client, photos):
    ids = [_add(svc, f"Person{n} Example", phone=f"402-555-01{n:02d}") for n in range(1, 6)]
    created = 0

    def limit(_k: str) -> BaseException | None:
        nonlocal created
        created += 1
        return RateLimited(429, "HTTP 429") if created == 3 else None

    client.fail["create"] = limit

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "rate_limited"
    assert (report.created, report.pending, report.errors) == (2, 3, 0)
    assert report.problems == []
    done = [_person(svc, pid) for pid in ids[:2]]
    assert all(p.google_contact_id and p.google_synced_at == report.started_at for p in done)
    refused = _person(svc, ids[2])
    # Google refused before doing anything, so the create marker was taken back.
    assert refused.google_sync_error is None
    assert refused.google_contact_id is None

    client.fail.clear()
    client.calls.clear()
    second = await _syncer(svc, client, photos).run()
    assert [c[1]["names"][0]["givenName"] for c in client.calls] == [
        "Person3",
        "Person4",
        "Person5",
    ]
    assert (second.created, second.pending, second.stopped_reason) == (3, 0, None)


async def test_a_rate_limited_update_stops_the_run(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["update"] = lambda _k: RateLimited(429, "HTTP 429")

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "rate_limited"
    assert report.pending == 2
    assert "create" not in client.kinds()
    after = _person(svc, pid)
    assert after.google_synced_at == LONG_AGO
    assert after.google_sync_error is None


async def test_switching_the_sync_off_stops_a_run_before_the_next_person(svc, client, photos):
    svc._repo.set_cutover_confirmed()
    svc.set_google_sync_enabled(True, "panel")
    pids = [_add(svc, f"Avery Newcomb{i}", phone=f"402-555-012{i}") for i in range(3)]
    asked = 0

    async def still_enabled() -> bool:
        nonlocal asked
        asked += 1
        return svc.google_sync_enabled()

    client.during["create"] = lambda _k: svc.set_google_sync_enabled(False, "panel")

    report = await _syncer(svc, client, photos, still_enabled=still_enabled).run()

    assert report.stopped_reason == "disabled"
    assert client.kinds() == ["create"]
    assert (report.created, report.pending) == (1, 2)
    assert asked == 2
    assert _person(svc, pids[0]).google_contact_id == "people/c1001"
    for pid in pids[1:]:
        after = _person(svc, pid)
        assert (after.google_contact_id, after.google_sync_error) == (None, None)
    assert report_to_dict(report)["stopped_reason"] == "disabled"


async def test_a_dry_run_does_not_ask_whether_the_sync_is_on(svc, client, photos):
    _add(svc, "Avery Newcomb", phone="402-555-0121")

    async def still_enabled() -> bool:
        raise AssertionError("a dry run must not ask")

    report = await _syncer(svc, client, photos, still_enabled=still_enabled).run(dry_run=True)

    assert report.created == 1 and report.stopped_reason is None


async def test_a_disabled_api_stops_the_run_without_blaming_people(svc, client, photos):
    first = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    second = _linked(svc, "Sage Testwood", "people/c78", phone="402-555-0112")
    client.fail["get_etag"] = lambda _k: AccessRefused(403, API_DISABLED_MESSAGE)

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "api_disabled"
    assert (report.errors, report.problems, report.pending) == (0, [], 2)
    assert client.kinds() == ["get_etag"]
    for pid in (first, second):
        after = _person(svc, pid)
        assert (after.google_sync_error, after.google_synced_at) == (None, LONG_AGO)
    assert report_to_dict(report)["stopped_reason"] == "api_disabled"


async def test_a_create_refused_as_api_disabled_clears_its_marker(svc, client, photos):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["create"] = lambda _k: AccessRefused(403, API_DISABLED_MESSAGE)

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "api_disabled"
    after = _person(svc, pid)
    assert (after.google_contact_id, after.google_sync_error) == (None, None)


async def test_an_auth_error_stops_the_run_without_blaming_people(svc, client, photos):
    first = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    second = _linked(svc, "Sage Testwood", "people/c78", phone="402-555-0112")
    client.fail["get_etag"] = lambda _k: GoogleAuthError("reconnect")

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "auth"
    assert (report.errors, report.problems, report.pending) == (0, [], 2)
    assert client.kinds() == ["get_etag"]
    for pid in (first, second):
        after = _person(svc, pid)
        assert after.google_sync_error is None
        assert after.google_synced_at == LONG_AGO


@pytest.mark.parametrize(
    "err",
    [
        GoogleAuthError("reconnect"),
        OAuth2TokenRequestReauthError(request_info=None, status=400, domain=DOMAIN),
    ],
    ids=["auth", "token-reauth"],
)
async def test_a_create_refused_for_auth_clears_its_marker(svc, client, photos, err):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["create"] = lambda _k: err

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "auth"
    after = _person(svc, pid)
    assert after.google_sync_error is None
    assert after.google_contact_id is None
    assert report.problems == []


TRANSIENT_TOKEN_ERRORS = pytest.mark.parametrize(
    "err",
    [
        OAuth2TokenRequestTransientError(request_info=None, status=503, domain=DOMAIN),
        OAuth2TokenRequestConnectionError(domain=DOMAIN),
    ],
    ids=["token-transient", "token-connection"],
)


@TRANSIENT_TOKEN_ERRORS
async def test_a_transient_token_failure_during_a_create_fails_the_run_and_clears_its_marker(
    svc, client, photos, err
):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")
    client.fail["create"] = lambda _k: err

    with pytest.raises(type(err)):
        await _syncer(svc, client, photos).run()

    after = _person(svc, pid)
    assert (after.google_sync_error, after.google_contact_id) == (None, None)


@TRANSIENT_TOKEN_ERRORS
async def test_a_transient_token_failure_during_an_update_fails_the_run(
    svc, client, photos, err
):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    client.fail["get_etag"] = lambda _k: err

    with pytest.raises(type(err)):
        await _syncer(svc, client, photos).run()

    after = _person(svc, pid)
    assert (after.google_sync_error, after.google_synced_at) == (None, LONG_AGO)


# -- Review Focus 4 ---------------------------------------------------------


async def test_an_edit_made_during_a_run_is_synced_on_the_next_run(svc, client, photos):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    edited = False

    def edit(_k: str) -> None:
        nonlocal edited
        if not edited:
            edited = True
            svc.update("person", pid, {"phone": "402-555-0199"}, "panel")

    client.during["update"] = edit
    started = datetime.now(UTC) - timedelta(seconds=1)
    ticks = count()

    def advancing() -> datetime:
        # A later time on every call, so the engine calling now() per write would show.
        return started + timedelta(milliseconds=next(ticks))

    report = await _syncer(svc, client, photos, now=advancing).run()

    assert report.started_at == started
    after = _person(svc, pid)
    assert after.google_synced_at == started
    assert after.updated_at > started

    client.calls.clear()
    await _syncer(svc, client, photos).run()
    assert client.kinds() == ["get_etag", "update"]
    assert client.calls[1][1][2]["phoneNumbers"][0]["value"] == "402-555-0199"


async def test_an_edit_committed_between_the_read_and_the_clock_is_not_lost(
    svc, client, photos
):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    editor: threading.Thread | None = None

    def clock() -> datetime:
        # Another thread edits the person while the run reads the clock. If the clock were
        # read outside the service's write lock, the edit would commit now: stamped before
        # started_at yet missing from the snapshot, so marked synced and never sent.
        nonlocal editor
        editor = threading.Thread(
            target=svc.update, args=("person", pid, {"phone": "402-555-0199"}, "panel")
        )
        editor.start()
        editor.join(timeout=0.5)
        return datetime.now(UTC)

    report = await _syncer(svc, client, photos, now=clock).run()
    assert editor is not None
    editor.join(timeout=5)
    assert not editor.is_alive()

    after = _person(svc, pid)
    assert after.phone == "402-555-0199"
    assert after.updated_at > report.started_at

    client.calls.clear()
    await _syncer(svc, client, photos).run()
    assert client.kinds() == ["get_etag", "update"]
    assert client.calls[1][1][2]["phoneNumbers"][0]["value"] == "402-555-0199"


async def test_a_person_deleted_mid_run_is_skipped(svc, client, photos):
    gone = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    newbie = _add(svc, "Avery Newcomb", phone="402-555-0121")
    stays = _linked(svc, "Sage Testwood", "people/c78", phone="402-555-0112")
    client.during["update"] = lambda k: (
        svc.delete("person", gone, "panel") if k == "people/c77" else None
    )
    client.during["create"] = lambda _k: svc.delete("person", newbie, "panel")

    report = await _syncer(svc, client, photos).run()

    assert report.errors == 0
    assert report.stopped_reason is None
    assert _person(svc, stays).google_synced_at == report.started_at
    assert {p.id for p in svc.read_data().people} == {stays}


async def test_a_person_deleted_before_the_create_is_not_created(svc, client, photos):
    newbie = _add(svc, "Avery Newcomb", phone="402-555-0121")
    original = svc.record_google_sync

    def record(person_id, **kw):
        if person_id == newbie:
            svc.delete("person", newbie, "panel")
        return original(person_id, **kw)

    svc.record_google_sync = record  # type: ignore[method-assign]

    report = await _syncer(svc, client, photos).run()

    assert client.calls == []
    assert report.created == 0


async def test_nobody_is_ever_deleted_or_looked_up_by_phone_email_or_name(svc, client, photos):
    _add(svc, "Avery Newcomb", phone="402-555-0121")
    pid = _linked(svc, "Rowan Testwood", "people/c77", email="rowan@example.invalid")
    svc.set_photo("person", pid, _png(), "panel")
    helpers = {"calls", "fail", "during", "kinds"}
    public = {n for n in dir(client) if not n.startswith("_")} - helpers
    assert public == {"create_contact", "get_etag", "update_contact", "update_photo"}

    await _syncer(svc, client, photos).run()

    assert set(client.kinds()) <= {"create", "get_etag", "update", "photo"}
    # get_etag is only ever asked for a stored resource name.
    assert [c[1] for c in client.calls if c[0] == "get_etag"] == ["people/c77"]


# -- limit, household, report ---------------------------------------------


async def test_limit_bounds_how_many_people_with_work_are_processed(svc, client, photos):
    for n in range(1, 5):
        _add(svc, f"Person{n} Example", phone=f"402-555-01{n:02d}")
    done = _add(svc, "Done Example", phone="402-555-0150")
    svc.record_google_sync(done, contact_id="people/c9")
    _fresh(svc, done)

    report = await _syncer(svc, client, photos).run(limit=2)

    assert report.created == 2
    assert report.pending == 2
    assert len(client.calls) == 2


async def test_a_household_address_is_sent_for_a_member_without_one(svc, client, photos):
    hh = svc.create(
        "household", {"address": {"formatted": "1 Example Way, Springfield NE"}}, "panel"
    )["id"]
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121", household_id=hh)

    await _syncer(svc, client, photos).run()

    assert client.calls[0][1]["addresses"] == [{"formattedValue": "1 Example Way, Springfield NE"}]
    assert _person(svc, pid).google_contact_id


async def test_the_engine_caps_problems(svc, client, photos):
    for n in range(MAX_PROBLEMS + 5):
        _add(svc, f"Person{n} Example", phone="402-555-0160")
    client.fail["create"] = lambda _k: GoogleError(400, "HTTP 400")

    report = await _syncer(svc, client, photos).run()

    assert report.errors == MAX_PROBLEMS + 5
    assert len(report.problems) == MAX_PROBLEMS


async def test_the_engine_caps_would_create_in_a_dry_run(svc, client, photos):
    for n in range(MAX_WOULD_CREATE + 3):
        _add(svc, f"Person{n} Example", phone="402-555-0160")

    dry = await _syncer(svc, client, photos).run(dry_run=True)

    assert dry.created == MAX_WOULD_CREATE + 3
    assert len(dry.would_create) == MAX_WOULD_CREATE
    assert dry.would_create[0] == "Person0 Example"


async def test_report_to_dict_is_plain_json():
    started = datetime(2026, 3, 2, 9, 0, tzinfo=UTC)
    report = SyncReport(
        dry_run=False,
        started_at=started,
        created=1,
        updated=2,
        photos=0,
        skipped=3,
        missing=1,
        errors=0,
        pending=0,
        stopped_reason=None,
        problems=[SyncOutcome("id1", "Rowan Testwood", "missing", ERROR_CONTACT_MISSING)],
        would_create=[],
        would_update=0,
    )

    out = report_to_dict(report)

    assert json.loads(json.dumps(out)) == out
    assert out["started_at"] == started.isoformat()
    assert out["problems"] == [
        {
            "person_id": "id1",
            "name": "Rowan Testwood",
            "kind": "missing",
            "message": ERROR_CONTACT_MISSING,
        }
    ]
    assert out["created"] == 1 and out["stopped_reason"] is None


async def test_report_to_dict_caps_its_lists():
    report = SyncReport(
        dry_run=True,
        started_at=datetime(2026, 3, 2, tzinfo=UTC),
        created=0,
        updated=0,
        photos=0,
        skipped=0,
        missing=0,
        errors=0,
        pending=0,
        stopped_reason=None,
        problems=[SyncOutcome(f"id{n}", "X Y", "error", "e") for n in range(MAX_PROBLEMS + 3)],
        would_create=[f"P{n}" for n in range(MAX_WOULD_CREATE + 3)],
        would_update=0,
    )

    out = report_to_dict(report)

    assert len(out["problems"]) == MAX_PROBLEMS
    assert len(out["would_create"]) == MAX_WOULD_CREATE


async def test_failures_are_logged_without_contact_details_or_request_data(
    svc, client, photos, caplog
):
    pid = _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    client.fail["get_etag"] = lambda _k: aiohttp.ClientConnectionError("Bearer ya29.secret")

    with caplog.at_level(logging.DEBUG, logger="custom_components.hearth_crm.google_sync"):
        await _syncer(svc, client, photos).run()

    text = caplog.text
    assert pid in text
    assert "ClientConnectionError" in text
    for secret in ("Rowan", "Testwood", "402-555-0111", "ya29", "Bearer"):
        assert secret not in text


async def test_blocking_work_goes_through_the_executor(svc, client, photos):
    newbie = _add(svc, "Avery Newcomb", phone="402-555-0121")
    svc.set_photo("person", newbie, _png(), "panel")
    _linked(svc, "Rowan Testwood", "people/c77", phone="402-555-0111")
    inside = False
    executed = 0
    direct: list[str] = []
    counts = {
        "read_data_with_clock": 0,
        "google_link_verified": 0,
        "mark_google_link_verified": 0,
        "record_google_sync": 0,
        "photo_bytes": 0,
    }

    def watched(name: str, func):
        def call(*args, **kw):
            counts[name] += 1
            if not inside:
                direct.append(name)
            return func(*args, **kw)

        return call

    svc.read_data_with_clock = watched(  # type: ignore[method-assign]
        "read_data_with_clock", svc.read_data_with_clock
    )
    svc.record_google_sync = watched(  # type: ignore[method-assign]
        "record_google_sync", svc.record_google_sync
    )
    for name in ("google_link_verified", "mark_google_link_verified"):
        setattr(svc, name, watched(name, getattr(svc, name)))
    photo_bytes = watched("photo_bytes", lambda h: photos.path(h).read_bytes())

    async def executor(func, *args):
        nonlocal inside, executed
        executed += 1
        inside = True
        try:
            return func(*args)
        finally:
            inside = False

    report = await _syncer(
        svc, client, photos, photo_bytes=photo_bytes, executor=executor
    ).run()

    assert (report.created, report.updated, report.photos) == (1, 1, 1)
    assert direct == []
    # One read; the create marker, its result and the photo hash; the update's result.
    # The verified-link setting: read once, written on the first accepted write.
    assert counts == {
        "read_data_with_clock": 1,
        "google_link_verified": 1,
        "mark_google_link_verified": 1,
        "record_google_sync": 4,
        "photo_bytes": 1,
    }
    assert executed == sum(counts.values())


async def test_a_body_that_cannot_be_built_leaves_no_create_marker(
    svc, client, photos, monkeypatch
):
    pid = _add(svc, "Avery Newcomb", phone="402-555-0121")

    def broken(_person, _household):
        raise ValueError("cannot build")

    monkeypatch.setattr("custom_components.hearth_crm.google_sync.person_body", broken)

    with pytest.raises(ValueError):
        await _syncer(svc, client, photos).run()

    assert client.calls == []
    after = _person(svc, pid)
    assert after.google_sync_error is None
    assert after.google_contact_id is None


async def test_a_rate_limited_photo_after_the_write_is_not_pending(svc, client, photos):
    first = _add(svc, "Avery Newcomb", phone="402-555-0121")
    svc.set_photo("person", first, _png(), "panel")
    _add(svc, "Blake Newcomb", phone="402-555-0122")
    client.fail["photo"] = lambda _k: RateLimited(429, "HTTP 429")

    report = await _syncer(svc, client, photos).run()

    assert report.stopped_reason == "rate_limited"
    assert client.kinds() == ["create", "photo"]
    # Avery's contact landed (created), only Blake is still to do.
    assert (report.created, report.photos, report.pending) == (1, 0, 1)
    assert _person(svc, first).google_contact_id == "people/c1001"
    assert _person(svc, first).google_photo_hash is None
