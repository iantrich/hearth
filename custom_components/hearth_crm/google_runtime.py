"""When the Google Contacts sync runs, and what the panel and actions can ask of it.

One ``GoogleRuntime`` per loaded CRM. Automatic runs happen only on a connected entry with
the sync switched on and cutover confirmed: once shortly after setup, once after a burst of
edits settles, and in an hourly sweep. Every real run holds one lock, so two runs never
overlap (two overlapping runs could both create the same new person). Logs hold only
exception type names, never names, contact details or an exception's text.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HassJob, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError, OAuth2TokenRequestBaseError
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.event import async_call_later, async_track_time_interval
from homeassistant.util import dt as dt_util

from .changes import notify_change
from .const import (
    GOOGLE_DEBOUNCE_SECONDS,
    GOOGLE_STARTUP_DELAY_SECONDS,
    GOOGLE_SWEEP_INTERVAL,
    SIGNAL_CHANGED,
    SYNC_SOURCE,
)
from .google_client import PeopleClient
from .google_payload import ERROR_CONTACT_MISSING, eligibility, plan_for
from .google_sync import GoogleSyncer, SyncReport, report_to_dict
from .models import CRMData
from .service import GoogleSyncRefused

if TYPE_CHECKING:
    from . import HearthRuntime

_LOGGER = logging.getLogger(__name__)

NOT_CONNECTED = "Google Contacts is not connected"
NOT_ENABLED = "The Google sync is switched off"
NOT_CUT_OVER = "Cutover has not been confirmed"
STOPPING = "Hearth is stopping"
TOKEN_REFRESH_FAILED = "Hearth couldn't renew its Google access just now; it will try again."


class GoogleSyncFailed(HomeAssistantError):
    """A run ended with an unexpected error; the message is plain and holds no data."""


class GoogleRuntime:
    """Schedules one CRM's Google sync and answers for it."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, runtime: HearthRuntime) -> None:
        self._hass = hass
        self._entry = entry
        self._runtime = runtime
        photos = runtime.photos

        async def still_enabled() -> bool:
            # Checked before each person, so switching the sync off stops a run in progress.
            if not runtime.google.connected:
                return False
            return await hass.async_add_executor_job(runtime.service.google_sync_enabled)

        self._syncer = GoogleSyncer(
            runtime.service,
            PeopleClient(runtime.google.request),
            lambda photo_hash: photos.path(photo_hash).read_bytes(),
            dt_util.utcnow,
            executor=hass.async_add_executor_job,
            still_enabled=still_enabled,
        )
        # Held for the whole of every real run (dry runs write nothing and don't take it).
        self._lock = asyncio.Lock()
        self._unsubs: list[CALLBACK_TYPE] = []
        self._debounce: CALLBACK_TYPE | None = None
        self._tasks: set[asyncio.Task] = set()
        self._auto_task: asyncio.Task | None = None
        self._auto_again = False
        self._stopped = False
        self._last_run: dict | None = None
        self._last_error: str | None = None

    # -- lifecycle ------------------------------------------------------

    def start(self) -> None:
        """Schedule the automatic runs. Nothing is scheduled for an unconnected entry;
        connecting (or reconnecting) Google reloads the entry, which starts again."""
        if not self._runtime.google.connected:
            return
        self._unsubs.append(
            async_call_later(
                self._hass,
                GOOGLE_STARTUP_DELAY_SECONDS,
                HassJob(self._on_timer, cancel_on_shutdown=True),
            )
        )
        self._unsubs.append(
            async_track_time_interval(
                self._hass, self._on_timer, GOOGLE_SWEEP_INTERVAL, cancel_on_shutdown=True
            )
        )
        self._unsubs.append(
            async_dispatcher_connect(
                self._hass, SIGNAL_CHANGED.format(self._entry.entry_id), self._on_change
            )
        )

    async def stop(self) -> None:
        """Cancel the timers and any run in progress, and wait for it to end.

        A run cancelled mid-create leaves its write-ahead marker, so that person is
        blocked rather than created again.
        """
        self._stopped = True
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._cancel_debounce()
        tasks = list(self._tasks)
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                current = asyncio.current_task()
                if current is not None and current.cancelling():
                    raise  # stop() itself was cancelled
            except Exception:  # noqa: BLE001, S110 - the run logged it already
                pass

    # -- runs -----------------------------------------------------------

    async def sync_now(self, *, dry_run: bool = False) -> SyncReport:
        """Run the sync now, or with ``dry_run`` only report what it would do.

        A dry run is allowed any time and needs no connection: it makes no Google call and
        writes nothing. A real run needs a connection, the sync switched on and cutover
        confirmed, else ``GoogleSyncRefused``. Real runs are single-flight: a caller that
        arrives while one is in progress waits for it, then runs its own pass over the
        data as it is then (by which time the first run's writes are visible).
        Raises ``GoogleSyncFailed`` if the run ends with an unexpected error, and
        ``GoogleSyncRefused`` if Hearth stops while it runs.
        """
        if self._stopped:
            raise GoogleSyncRefused(STOPPING)
        if dry_run:
            try:
                return await self._syncer.run(dry_run=True)
            except Exception as err:
                self._log_failure(err)
                raise GoogleSyncFailed(_failure_message(err)) from None
        task = self._spawn(self._real_run())
        # A caller that gives up no longer looks at the task; retrieve its exception here
        # so asyncio doesn't log it as never retrieved (the run logged it already).
        task.add_done_callback(_retrieve_exception)
        # Waited on, not awaited: a caller that gives up (a closed websocket, say) is
        # cancelled alone and leaves the run going. Only stop() cancels the run itself.
        # (asyncio.shield would also keep it going, but logs a failed run whose caller left
        # as an "exception in shielded future".)
        await asyncio.wait((task,))
        if task.cancelled():
            raise GoogleSyncRefused(STOPPING)
        return task.result()

    async def _real_run(self, *, automatic: bool = False) -> SyncReport:
        async with self._lock:
            if automatic:
                # This pass reads the data now, so it covers every trigger until this moment.
                self._auto_again = False
            try:
                # Inside the try: a settings read that fails is a failed run, not one that
                # kills the automatic loop.
                await self._check_gate()
                report = await self._syncer.run()
            except GoogleSyncRefused:
                raise
            except Exception as err:
                self._log_failure(err)
                self._last_error = _failure_message(err)
                self._notify()  # writes may have landed before it failed
                raise GoogleSyncFailed(self._last_error) from None
            self._last_run = report_to_dict(report)
            self._last_error = None
            if report.stopped_reason == "auth":
                # Only a rejected or unrenewable token stops for "auth"; a token endpoint
                # that failed for a moment is a failed run, retried by the next sweep.
                self._entry.async_start_reauth(self._hass)  # once per run; HA dedupes flows
            if _changed_anything(report):
                self._notify()
            return report

    async def _check_gate(self) -> None:
        if not self._runtime.google.connected:
            raise GoogleSyncRefused(NOT_CONNECTED)
        settings = await self._hass.async_add_executor_job(
            self._runtime.service.get_google_settings
        )
        if not settings["cutover_confirmed"]:
            raise GoogleSyncRefused(NOT_CUT_OVER)
        if not settings["enabled"]:
            raise GoogleSyncRefused(NOT_ENABLED)

    @callback
    def _on_change(self, notice: dict) -> None:
        """A write somewhere in this CRM: run once the edits settle. Ignores the sync's own."""
        if notice.get("source") == SYNC_SOURCE or self._stopped:
            return
        self._cancel_debounce()
        self._debounce = async_call_later(
            self._hass,
            GOOGLE_DEBOUNCE_SECONDS,
            HassJob(self._on_debounced, cancel_on_shutdown=True),
        )

    @callback
    def _on_debounced(self, _now: datetime) -> None:
        self._debounce = None
        self._trigger()

    @callback
    def _on_timer(self, _now: datetime) -> None:
        self._trigger()

    @callback
    def _trigger(self) -> None:
        """Start an automatic run, or ask the one in progress for one more pass after it."""
        if self._stopped:
            return
        if self._auto_task is not None and not self._auto_task.done():
            self._auto_again = True
            return
        self._auto_task = self._spawn(self._auto_loop())

    async def _auto_loop(self) -> None:
        while True:
            try:
                await self._real_run(automatic=True)
            except GoogleSyncRefused:
                pass  # not connected, switched off or before cutover: nothing to do
            except GoogleSyncFailed:
                pass  # logged; the next sweep tries again
            if not self._auto_again:
                return

    def _spawn[T](self, coro: Any) -> asyncio.Task[T]:
        task = self._entry.async_create_background_task(
            self._hass, coro, f"hearth_crm google sync {self._entry.entry_id}"
        )
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return task

    def _cancel_debounce(self) -> None:
        if self._debounce is not None:
            self._debounce()
            self._debounce = None

    def _notify(self) -> None:
        notify_change(
            self._hass,
            self._entry,
            source=SYNC_SOURCE,
            entity="google",
            entity_id=None,
            action="sync",
        )

    @staticmethod
    def _log_failure(err: Exception) -> None:
        # Only the type name: an exception's text can hold contact details or request data.
        _LOGGER.error("The Google sync failed: %s", type(err).__name__)

    # -- status ---------------------------------------------------------

    async def status(self) -> dict:
        """Whether the sync can run, how its last run went, and where everyone stands."""
        service = self._runtime.service
        settings = await self._hass.async_add_executor_job(service.get_google_settings)
        data = await self._hass.async_add_executor_job(service.read_data)
        return {
            "connected": self._runtime.google.connected,
            "enabled": settings["enabled"],
            "cutover_confirmed": settings["cutover_confirmed"],
            "running": self._lock.locked(),
            "last_run": self._last_run,
            "last_error": self._last_error,
            "counts": count_people(data),
        }


def count_people(data: CRMData) -> dict[str, int]:
    """Each person counted once: missing, errors, skipped, pending or synced, in that order.

    ``missing`` is a contact deleted in Google; ``errors`` is any other stored error
    (including a create that may have landed); ``skipped`` is someone the sync leaves out;
    ``pending`` has work to do; ``synced`` is up to date.
    """
    counts = {"synced": 0, "pending": 0, "skipped": 0, "missing": 0, "errors": 0}
    households = {h.id: h for h in data.households}
    for person in data.people:
        household = households.get(person.household_id) if person.household_id else None
        if person.google_contact_id and person.google_sync_error == ERROR_CONTACT_MISSING:
            counts["missing"] += 1
        elif person.google_sync_error:
            counts["errors"] += 1
        elif not eligibility(person).eligible:
            counts["skipped"] += 1
        elif plan_for(person, household).kind == "none":
            counts["synced"] += 1
        else:
            counts["pending"] += 1
    return counts


def _retrieve_exception(task: asyncio.Task) -> None:
    if not task.cancelled():
        task.exception()


def _changed_anything(report: SyncReport) -> bool:
    return any(
        (report.created, report.updated, report.photos, report.skipped, report.missing,
         report.errors)
    )


def _failure_message(err: Exception) -> str:
    if isinstance(err, OAuth2TokenRequestBaseError):
        return TOKEN_REFRESH_FAILED
    return f"The Google sync failed unexpectedly ({type(err).__name__}); it will try again."

