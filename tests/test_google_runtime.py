"""Tests for when the Google sync runs and the controls around it, on a real Home Assistant.

Most tests swap the engine for a fake syncer, so no Google call can happen; the dry-run
tests use the real engine to show a preview needs no connection. Invented people only.
"""

from __future__ import annotations

import asyncio
import gc
import logging
import time
from dataclasses import dataclass, field
from datetime import timedelta
from functools import partial
from unittest.mock import patch

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.core import Context
from homeassistant.exceptions import (
    OAuth2TokenRequestTransientError,
    ServiceValidationError,
    Unauthorized,
)
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.hearth_crm import google_runtime
from custom_components.hearth_crm.changes import notify_change
from custom_components.hearth_crm.const import (
    CONF_GOOGLE_ACCOUNT_ID,
    DOMAIN,
    GOOGLE_SCOPE,
    SIGNAL_CHANGED,
)
from custom_components.hearth_crm.db import META_GOOGLE_SYNC
from custom_components.hearth_crm.google_payload import (
    ERROR_CONTACT_MISSING,
    ERROR_CREATE_UNCERTAIN,
)
from custom_components.hearth_crm.google_runtime import GoogleSyncFailed, count_people
from custom_components.hearth_crm.google_sync import SyncReport
from custom_components.hearth_crm.models import CRMData, Person
from custom_components.hearth_crm.service import GoogleSyncRefused, StorageError
from tests.conftest import T0, T1, sample_data

INVENTED_PHONE = "555-0142"


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


# -- a fake engine ----------------------------------------------------------


@dataclass
class FakeState:
    """What every fake syncer built during a test shares."""

    calls: list[bool] = field(default_factory=list)  # dry_run of each run
    active: int = 0
    max_active: int = 0
    cancelled: int = 0
    gate: asyncio.Event | None = None
    error: Exception | None = None
    report: dict = field(default_factory=dict)


class FakeSyncer:
    def __init__(self, state: FakeState) -> None:
        self._state = state

    async def run(self, *, dry_run: bool = False, limit: int | None = None) -> SyncReport:
        state = self._state
        state.calls.append(dry_run)
        state.active += 1
        state.max_active = max(state.max_active, state.active)
        try:
            if state.gate is not None:
                await state.gate.wait()
            if state.error is not None:
                raise state.error
            return SyncReport(dry_run=dry_run, started_at=dt_util.utcnow(), **state.report)
        except asyncio.CancelledError:
            state.cancelled += 1
            raise
        finally:
            state.active -= 1


@pytest.fixture
def fake(monkeypatch) -> FakeState:
    """Every GoogleRuntime built from now on runs the fake syncer."""
    state = FakeState()
    monkeypatch.setattr(google_runtime, "GoogleSyncer", lambda *a, **kw: FakeSyncer(state))
    return state


# -- helpers ----------------------------------------------------------------


async def connect(hass, entry) -> None:
    """Store a Google token on the entry directly and reload it, as connecting does."""
    token = {
        "access_token": "invented-access",
        "refresh_token": "invented-refresh-token",
        "token_type": "Bearer",
        "expires_in": 3599,
        "expires_at": time.time() + 3599,
        "scope": GOOGLE_SCOPE,
    }
    hass.config_entries.async_update_entry(
        entry,
        data={
            **entry.data,
            "auth_implementation": DOMAIN,
            "token": token,
            CONF_GOOGLE_ACCOUNT_ID: "people/c1001",
        },
    )
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()


async def cut_over_and_enable(hass, entry) -> None:
    runtime = entry.runtime_data
    await hass.async_add_executor_job(runtime.repo.set_cutover_confirmed)
    await hass.async_add_executor_job(runtime.service.set_google_sync_enabled, True, "panel")


async def ready_crm(hass, user, add_crm):
    """A CRM connected to Google, switched on and cut over."""
    entry = await add_crm(user)
    await connect(hass, entry)
    await cut_over_and_enable(hass, entry)
    return entry


async def advance(hass, freezer, seconds: float) -> None:
    """Move time on and wait for what it set off, runs included (they are background tasks)."""
    freezer.tick(timedelta(seconds=seconds))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)


def panel_edit(hass, entry) -> None:
    notify_change(hass, entry, source="panel", entity="person", entity_id="p1", action="update")


async def settle() -> None:
    for _ in range(5):
        await asyncio.sleep(0)


def person(pid: str, name: str, **kw) -> Person:
    return Person(id=pid, name=name, created_at=T0, updated_at=T1, **kw)


# -- when it runs -----------------------------------------------------------


async def test_nothing_runs_when_google_is_not_connected(
    hass, hass_admin_user, add_crm, fake, freezer
):
    entry = await add_crm(hass_admin_user)
    await cut_over_and_enable(hass, entry)
    await advance(hass, freezer, 31)
    panel_edit(hass, entry)
    await advance(hass, freezer, 61)
    await advance(hass, freezer, 3600)
    assert fake.calls == []
    with pytest.raises(GoogleSyncRefused, match="not connected"):
        await entry.runtime_data.google_sync.sync_now()
    assert fake.calls == []


async def test_nothing_runs_before_cutover_even_if_enabled(
    hass, hass_admin_user, add_crm, fake, freezer
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry)
    # The service refuses to switch it on before cutover; plant the flag directly.
    await hass.async_add_executor_job(
        entry.runtime_data.repo.set_meta, META_GOOGLE_SYNC, "1", "panel"
    )
    await advance(hass, freezer, 31)
    panel_edit(hass, entry)
    await advance(hass, freezer, 61)
    await advance(hass, freezer, 3600)
    assert fake.calls == []
    with pytest.raises(GoogleSyncRefused, match="Cutover"):
        await entry.runtime_data.google_sync.sync_now()
    assert fake.calls == []


async def test_nothing_runs_when_switched_off(hass, hass_admin_user, add_crm, fake, freezer):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    await hass.async_add_executor_job(
        entry.runtime_data.service.set_google_sync_enabled, False, "panel"
    )
    await advance(hass, freezer, 3600)
    assert fake.calls == []
    with pytest.raises(GoogleSyncRefused, match="switched off"):
        await entry.runtime_data.google_sync.sync_now()


async def test_a_dry_run_works_without_a_google_connection(
    hass, hass_admin_user, add_crm, aioclient_mock
):
    entry = await add_crm(hass_admin_user)
    runtime = entry.runtime_data
    data = sample_data()
    data.people.append(person("p5", "Ezra Example", phone="555-0105"))
    await hass.async_add_executor_job(runtime.repo.replace_all, data, "import")
    before = await hass.async_add_executor_job(runtime.repo.snapshot)

    report = await runtime.google_sync.sync_now(dry_run=True)

    assert report.dry_run
    assert report.would_create == ["Ezra Example"]
    assert aioclient_mock.call_count == 0
    assert await hass.async_add_executor_job(runtime.repo.snapshot) == before
    status = await runtime.google_sync.status()
    assert status["last_run"] is None  # a preview is not a run


async def test_a_burst_of_edits_makes_one_debounced_run(
    hass, hass_admin_user, add_crm, fake, freezer
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    await advance(hass, freezer, 31)
    assert fake.calls == [False]  # the run shortly after setup
    fake.calls.clear()

    for _ in range(5):
        panel_edit(hass, entry)
        await advance(hass, freezer, 10)
    assert fake.calls == []  # still settling
    await advance(hass, freezer, 61)
    assert fake.calls == [False]
    await advance(hass, freezer, 120)
    assert fake.calls == [False]


async def test_the_runtimes_own_notices_do_not_retrigger_it(
    hass, hass_admin_user, add_crm, fake, freezer
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    notices: list[dict] = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(entry.entry_id), notices.append)
    fake.report = {"created": 1}

    await advance(hass, freezer, 31)
    assert fake.calls == [False]
    assert notices == [
        {"source": "sync", "entity": "google", "entity_id": None, "action": "sync"}
    ]
    await advance(hass, freezer, 120)
    notify_change(hass, entry, source="sync", entity="google", entity_id=None, action="sync")
    await advance(hass, freezer, 120)
    assert fake.calls == [False]


async def test_a_run_that_changed_nothing_sends_no_notice(
    hass, hass_admin_user, add_crm, fake
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    notices: list[dict] = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(entry.entry_id), notices.append)
    await entry.runtime_data.google_sync.sync_now()
    assert notices == []


async def test_the_hourly_sweep_runs_when_connected_enabled_and_after_cutover(
    hass, hass_admin_user, add_crm, fake, freezer
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    await advance(hass, freezer, 31)
    assert fake.calls == [False]
    await advance(hass, freezer, 3600)
    assert fake.calls == [False, False]
    await advance(hass, freezer, 3600)
    assert fake.calls == [False, False, False]
    status = await entry.runtime_data.google_sync.status()
    assert status["last_run"]["dry_run"] is False


async def test_overlapping_runs_are_single_flight(
    hass, hass_admin_user, add_crm, fake, freezer
):
    """A second caller waits for the run in progress, then makes its own pass."""
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    fake.gate = asyncio.Event()

    first = asyncio.create_task(sync.sync_now())
    second = asyncio.create_task(sync.sync_now())
    await settle()
    # Two sweeps while it runs queue one automatic pass, not two.
    freezer.tick(timedelta(seconds=3600))
    async_fire_time_changed(hass)
    freezer.tick(timedelta(seconds=3600))
    async_fire_time_changed(hass)
    await settle()
    assert fake.active == 1
    assert (await sync.status())["running"] is True

    fake.gate.set()
    await asyncio.gather(first, second)
    await hass.async_block_till_done(wait_background_tasks=True)
    for _ in range(3):
        await settle()
    assert fake.max_active == 1
    assert fake.calls == [False, False, False]
    assert (await sync.status())["running"] is False


async def test_a_preview_does_not_wait_for_a_run(hass, hass_admin_user, add_crm, fake):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    fake.gate = asyncio.Event()
    run = asyncio.create_task(sync.sync_now())
    await settle()
    preview = asyncio.create_task(sync.sync_now(dry_run=True))
    await settle()
    assert fake.calls == [False, True]
    fake.gate.set()
    assert (await preview).dry_run
    await run


async def test_a_run_asks_before_each_person_whether_the_sync_is_still_on(
    hass, hass_admin_user, add_crm, monkeypatch
):
    built: list[dict] = []
    real = google_runtime.GoogleSyncer
    monkeypatch.setattr(
        google_runtime,
        "GoogleSyncer",
        lambda *a, **kw: built.append(kw) or real(*a, **kw),
    )
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    still_enabled = built[-1]["still_enabled"]

    assert await still_enabled() is True
    await hass.async_add_executor_job(
        entry.runtime_data.service.set_google_sync_enabled, False, "panel"
    )
    assert await still_enabled() is False

    await hass.async_add_executor_job(
        entry.runtime_data.service.set_google_sync_enabled, True, "panel"
    )
    data = {k: v for k, v in entry.data.items() if k != "token"}
    hass.config_entries.async_update_entry(entry, data=data)
    assert await still_enabled() is False


async def test_an_auth_failure_starts_reauth(hass, hass_admin_user, add_crm, fake):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    fake.report = {"stopped_reason": "auth", "pending": 3}
    with patch.object(ConfigEntry, "async_start_reauth") as start_reauth:
        report = await entry.runtime_data.google_sync.sync_now()
    assert report.stopped_reason == "auth"
    start_reauth.assert_called_once_with(hass)

    fake.report = {"stopped_reason": "rate_limited", "pending": 3}
    with patch.object(ConfigEntry, "async_start_reauth") as start_reauth:
        await entry.runtime_data.google_sync.sync_now()
    start_reauth.assert_not_called()


async def test_a_transient_token_failure_is_a_plain_failure_without_reauth(
    hass, hass_admin_user, add_crm, fake
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    fake.error = OAuth2TokenRequestTransientError(request_info=None, status=503, domain=DOMAIN)
    sync = entry.runtime_data.google_sync

    with patch.object(ConfigEntry, "async_start_reauth") as start_reauth:
        with pytest.raises(GoogleSyncFailed) as err:
            await sync.sync_now()

    start_reauth.assert_not_called()
    assert str(err.value) == google_runtime.TOKEN_REFRESH_FAILED
    assert (await sync.status())["last_error"] == google_runtime.TOKEN_REFRESH_FAILED
    assert entry.state is ConfigEntryState.LOADED


async def test_a_failed_run_is_logged_by_type_and_later_runs_still_happen(
    hass, hass_admin_user, add_crm, fake, freezer, caplog
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    fake.error = StorageError(f"could not save Ezra Example {INVENTED_PHONE}")
    caplog.set_level(logging.DEBUG, logger="custom_components.hearth_crm")

    with pytest.raises(GoogleSyncFailed, match="StorageError"):
        await sync.sync_now()
    status = await sync.status()
    assert "StorageError" in status["last_error"]
    assert status["running"] is False
    assert "StorageError" in caplog.text
    assert INVENTED_PHONE not in caplog.text
    assert "Ezra" not in caplog.text
    assert "Traceback" not in caplog.text

    # An automatic run that fails keeps the runtime alive for the next one.
    await advance(hass, freezer, 31)
    assert fake.calls == [False, False]
    fake.error = None
    await advance(hass, freezer, 3600)
    assert fake.calls == [False, False, False]
    assert (await sync.status())["last_error"] is None


async def test_stopping_cancels_the_timers_and_a_running_sync(
    hass, hass_admin_user, add_crm, fake
):
    # No freezer here: the timeout below needs the loop's clock to run.
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    fake.gate = asyncio.Event()  # never set: the run would go on for ever
    running = asyncio.create_task(sync.sync_now())
    await settle()
    assert fake.active == 1
    panel_edit(hass, entry)
    assert sync._debounce is not None
    assert sync._unsubs

    async with asyncio.timeout(5):  # a stop that didn't cancel the run would never return
        assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.NOT_LOADED
    assert fake.cancelled == 1
    assert fake.active == 0
    assert sync._unsubs == []
    assert sync._debounce is None
    # The caller wasn't cancelled itself, so it hears why the run ended.
    with pytest.raises(GoogleSyncRefused, match="stopping"):
        await running

    panel_edit(hass, entry)
    for seconds in (31, 61, 3601):
        async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=seconds))
        await hass.async_block_till_done(wait_background_tasks=True)
    assert fake.calls == [False]
    with pytest.raises(GoogleSyncRefused):
        await sync.sync_now()


async def test_a_cancelled_caller_leaves_the_run_going(hass, hass_admin_user, add_crm, fake):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    fake.gate = asyncio.Event()
    caller = asyncio.create_task(sync.sync_now())
    await settle()
    assert fake.active == 1

    caller.cancel()
    with pytest.raises(asyncio.CancelledError):
        await caller
    await settle()
    assert fake.active == 1
    assert fake.cancelled == 0

    fake.gate.set()
    await hass.async_block_till_done(wait_background_tasks=True)
    assert fake.active == 0
    assert fake.cancelled == 0
    status = await sync.status()
    assert status["last_run"]["dry_run"] is False
    assert status["running"] is False


async def test_a_failed_run_whose_caller_left_logs_no_stray_asyncio_error(
    hass, hass_admin_user, add_crm, fake
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    fake.gate = asyncio.Event()
    fake.error = StorageError("could not save")
    caller = asyncio.create_task(sync.sync_now())
    await settle()
    [task] = sync._tasks
    stray: list[dict] = []
    previous = hass.loop.get_exception_handler()
    hass.loop.set_exception_handler(lambda _loop, context: stray.append(context))
    try:
        caller.cancel()
        with pytest.raises(asyncio.CancelledError):
            await caller
        fake.gate.set()
        await hass.async_block_till_done(wait_background_tasks=True)
        assert task.done() and not task.cancelled()
        del task, caller
        gc.collect()
        await settle()
    finally:
        hass.loop.set_exception_handler(previous)
    assert [str(c.get("message")) for c in stray] == []
    assert (await sync.status())["last_error"] is not None


async def test_a_settings_read_error_is_a_failed_run_not_a_dead_loop(
    hass, hass_admin_user, add_crm, fake, freezer, caplog
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    sync = entry.runtime_data.google_sync
    service = entry.runtime_data.service
    real_settings = service.get_google_settings
    failures = 0

    def failing_settings() -> dict:
        nonlocal failures
        if failures == 0:
            failures += 1
            sync._auto_again = True  # a trigger that arrives during the failed pass
            raise StorageError(f"could not read Ezra Example {INVENTED_PHONE}")
        return real_settings()

    service.get_google_settings = failing_settings  # type: ignore[method-assign]
    caplog.set_level(logging.DEBUG, logger="custom_components.hearth_crm")

    # The automatic run's gate fails; the loop survives and makes its pending pass.
    await advance(hass, freezer, 31)
    for _ in range(3):
        await settle()
    assert failures == 1
    assert fake.calls == [False]
    assert sync._auto_task is not None and sync._auto_task.done()
    assert sync._auto_task.exception() is None

    # A manual run whose gate fails gets the plain failure.
    failures = 0
    with pytest.raises(GoogleSyncFailed, match="StorageError"):
        await sync.sync_now()
    assert "StorageError" in caplog.text
    assert INVENTED_PHONE not in caplog.text
    assert "Ezra" not in caplog.text
    assert "Traceback" not in caplog.text


# -- status -----------------------------------------------------------------


def test_status_counts_each_person_once():
    people = [
        person("p1", "Alex Example", phone="555-0101", google_contact_id="people/c1",
               google_synced_at=T1),
        person("p2", "Blair Example", phone="555-0102"),
        person("p3", "Casey Example"),
        person("p4", "Drew Example"),
        person("p5", "Ezra Example", phone="555-0105", google_contact_id="people/c5",
               google_synced_at=T0, google_sync_error=ERROR_CONTACT_MISSING),
        person("p6", "Finn Example", phone="555-0106",
               google_sync_error=ERROR_CREATE_UNCERTAIN),
        person("p7", "Gale Example", phone="555-0107", google_contact_id="people/c7",
               google_synced_at=T0, google_sync_error="network error"),
    ]
    assert count_people(CRMData(people=people)) == {
        "synced": 1, "pending": 1, "skipped": 2, "missing": 1, "errors": 2,
    }


async def test_status_works_when_google_is_not_linked(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    assert await entry.runtime_data.google_sync.status() == {
        "connected": False,
        "enabled": False,
        "cutover_confirmed": False,
        "running": False,
        "last_run": None,
        "last_error": None,
        "counts": {"synced": 0, "pending": 0, "skipped": 0, "missing": 0, "errors": 0},
    }


# -- websocket --------------------------------------------------------------


async def token_for(hass, user) -> str:
    refresh = await hass.auth.async_create_refresh_token(user, "https://example.test")
    return hass.auth.async_create_access_token(refresh)


@pytest.fixture
async def two_crms(hass, hass_admin_user, add_crm):
    """User A (admin) and user B (plain), each with a CRM; A's holds the sample data."""
    user_b = await hass.auth.async_create_user("Bee Example", group_ids=[GROUP_ID_USER])
    entry_a, entry_b = await add_crm(hass_admin_user), await add_crm(user_b)
    await hass.async_add_executor_job(entry_a.runtime_data.repo.replace_all, sample_data(), "import")
    return hass_admin_user, user_b, entry_a, entry_b


async def ws_call(ws, command, **data):
    await ws.send_json_auto_id({"type": f"hearth_crm/google/{command}", **data})
    return await ws.receive_json()


async def ws_ok(ws, command, **data):
    reply = await ws_call(ws, command, **data)
    assert reply["success"], reply
    return reply["result"]


def people_of(hass, entry):
    return hass.async_add_executor_job(lambda: entry.runtime_data.repo.snapshot().people)


async def test_websocket_status_enable_preview_and_clear_only_touch_the_callers_own_crm(
    hass, hass_ws_client, two_crms, aioclient_mock
):
    user_a, user_b, entry_a, entry_b = two_crms
    ws_a = await hass_ws_client(hass, await token_for(hass, user_a))
    ws_b = await hass_ws_client(hass, await token_for(hass, user_b))

    status_a = await ws_ok(ws_a, "status")
    assert status_a["connected"] is False
    assert status_a["counts"]["pending"] == 1  # Alex: has an id, photo never sent
    assert status_a["counts"]["skipped"] == 3

    await hass.async_add_executor_job(entry_a.runtime_data.repo.set_cutover_confirmed)
    assert (await ws_ok(ws_a, "set_enabled", enabled=True))["enabled"] is True
    status_b = await ws_ok(ws_b, "status")
    assert status_b["enabled"] is False
    assert status_b["cutover_confirmed"] is False
    assert status_b["counts"] == {
        "synced": 0, "pending": 0, "skipped": 0, "missing": 0, "errors": 0,
    }

    # A linked person the sync isn't blocked on keeps their link.
    reply = await ws_call(ws_a, "clear_contact", entity_id="p1")
    assert reply["error"]["code"] == "not_blocked"
    assert (await people_of(hass, entry_a))[0].google_contact_id == "g-1"
    await hass.async_add_executor_job(
        partial(
            entry_a.runtime_data.service.record_google_sync, "p1", error=ERROR_CONTACT_MISSING
        )
    )

    # B can't clear A's person: the id is looked up in B's own CRM only.
    reply = await ws_call(ws_b, "clear_contact", entity_id="p1")
    assert reply["error"]["code"] == "not_found"
    assert (await people_of(hass, entry_a))[0].google_contact_id == "g-1"
    assert (await ws_ok(ws_b, "preview"))["would_create"] == []

    await ws_ok(ws_a, "clear_contact", entity_id="p1")
    assert (await people_of(hass, entry_a))[0].google_contact_id is None
    preview = await ws_ok(ws_a, "preview")
    assert preview["dry_run"] is True
    assert preview["would_create"] == ["Alex Example"]
    assert isinstance(preview["started_at"], str)
    assert aioclient_mock.call_count == 0

    reply = await ws_call(ws_a, "sync_now")
    assert reply["error"]["code"] == "sync_refused"
    assert "not connected" in reply["error"]["message"]


async def test_websocket_sync_now_returns_the_report(
    hass, hass_ws_client, hass_admin_user, add_crm, fake
):
    entry = await ready_crm(hass, hass_admin_user, add_crm)
    ws = await hass_ws_client(hass, await token_for(hass, hass_admin_user))
    fake.report = {"created": 2, "stopped_reason": "rate_limited", "pending": 4}
    result = await ws_ok(ws, "sync_now")
    assert result["created"] == 2
    assert result["stopped_reason"] == "rate_limited"
    assert result["dry_run"] is False
    status = await ws_ok(ws, "status")
    assert status["connected"] is True
    assert status["last_run"] == result

    fake.error = StorageError("could not save")
    reply = await ws_call(ws, "sync_now")
    assert reply["error"]["code"] == "sync_failed"
    assert (await ws_ok(ws, "status"))["last_error"] == reply["error"]["message"]
    assert entry.state is ConfigEntryState.LOADED


async def test_enabling_before_cutover_returns_a_plain_error_code(
    hass, hass_ws_client, two_crms
):
    user_a, _, entry_a, _ = two_crms
    ws_a = await hass_ws_client(hass, await token_for(hass, user_a))
    reply = await ws_call(ws_a, "set_enabled", enabled=True)
    assert reply["success"] is False
    assert reply["error"]["code"] == "cutover_not_confirmed"
    assert "cutover" in reply["error"]["message"].lower()
    assert (await ws_ok(ws_a, "status"))["enabled"] is False
    # Switching it off is always allowed.
    assert (await ws_ok(ws_a, "set_enabled", enabled=False))["enabled"] is False


# -- the action -------------------------------------------------------------


def google_sync(hass, entry, user, **data):
    return hass.services.async_call(
        DOMAIN, "google_sync", {"config_entry_id": entry.entry_id, **data},
        blocking=True, return_response=True,
        context=Context(user_id=user.id if user else None),
    )


async def test_the_action_returns_the_report_and_is_owner_or_admin_only(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    entry = await add_crm(hass_read_only_user)  # owned by a plain user
    data = CRMData(people=[person("p1", "Ezra Example", phone="555-0105")])
    await hass.async_add_executor_job(entry.runtime_data.repo.replace_all, data, "import")
    stranger = await hass.auth.async_create_user("Cy Example", group_ids=[GROUP_ID_USER])

    for user in (hass_read_only_user, hass_admin_user):
        report = await google_sync(hass, entry, user, dry_run=True)
        assert report["dry_run"] is True
        assert report["would_create"] == ["Ezra Example"]
    for user in (stranger, None):
        with pytest.raises(Unauthorized):
            await google_sync(hass, entry, user, dry_run=True)
    with pytest.raises(ServiceValidationError, match="not connected"):
        await google_sync(hass, entry, hass_read_only_user)
