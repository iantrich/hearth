"""The Google Contacts sync engine: one run over a CRM's people.

A run reads the CRM once, plans every person with ``plan_for`` and acts on the plan through
the ``PeopleClient``. Everyone it writes is marked synced as of when the run read the data,
so an edit made mid-run is picked up next time. Nothing here deletes a Google contact or
looks one up by phone, email or name. Logs hold only person ids and exception type names:
never names, contact details, request data or an exception's text.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, field
from datetime import datetime
from functools import partial
from typing import Any, Literal

import aiohttp
from homeassistant.exceptions import (
    OAuth2TokenRequestBaseError,
    OAuth2TokenRequestReauthError,
)

from .db import BackupInProgress
from .google_client import (
    AccessRefused,
    ContactMissing,
    CreateUncertain,
    GoogleError,
    PeopleClient,
    RateLimited,
)
from .google_link import GoogleAuthError
from .google_payload import (
    ERROR_CONTACT_MISSING,
    ERROR_CREATE_UNCERTAIN,
    Work,
    person_body,
    plan_for,
)
from .models import Household, Person
from .service import UNSET, HearthService, NotFound, StorageError, Unset

_LOGGER = logging.getLogger(__name__)

MAX_PROBLEMS = 50
MAX_WOULD_CREATE = 200
# If this many people with a stored id in a row are all missing in Google before any is
# found, the connected account is most likely not the one they were synced to.
MISMATCH_PROBE = 5
NETWORK_ERROR = "network error"
PHOTO_UNREADABLE = "photo file could not be read"
# A new contact's id that the database won't take (a backup running, or another write
# holding the write gate) is retried this many times, this many seconds apart, before it
# is kept in memory for the next run.
STORE_RETRIES = 2
STORE_RETRY_DELAY = 2.0

Executor = Callable[..., Awaitable[Any]]
# What the database raises when it can't take a write just now (db._write_txn's gate).
_DB_REFUSED = (BackupInProgress, StorageError, TimeoutError)
StopReason = Literal[
    "rate_limited", "auth", "account_mismatch", "disabled", "api_disabled"
]


@dataclass
class SyncOutcome:
    person_id: str
    name: str
    kind: Literal["created", "updated", "photo", "skipped", "missing", "error"]
    message: str | None


@dataclass
class SyncReport:
    dry_run: bool
    started_at: datetime
    created: int = 0
    updated: int = 0
    photos: int = 0
    skipped: int = 0
    missing: int = 0
    errors: int = 0
    pending: int = 0
    stopped_reason: StopReason | None = None
    problems: list[SyncOutcome] = field(default_factory=list)  # errors and missing, capped
    would_create: list[str] = field(default_factory=list)  # dry run only: names, capped
    would_update: int = 0


def report_to_dict(report: SyncReport) -> dict:
    """The report as plain JSON-ready data, with its lists capped."""
    out = asdict(report)
    out["started_at"] = report.started_at.isoformat()
    out["problems"] = out["problems"][:MAX_PROBLEMS]
    out["would_create"] = out["would_create"][:MAX_WOULD_CREATE]
    return out


class _Stop(Exception):
    """Ends the run: Google won't take more right now, or Hearth can't act for the owner."""

    def __init__(self, reason: StopReason) -> None:
        super().__init__(reason)
        self.reason = reason
        # Set when the person's contact write landed before the stop (only the photo was
        # refused): they count as created or updated, so not as pending too.
        self.contact_written = False


@dataclass
class _MismatchProbe:
    """Until the link is verified, watches a run's people with a stored id.

    The link is verified (a setting in the CRM's database) the first time Google accepts
    an update or create through it; after that the probe starts settled and a missing
    contact is stored as usual.

    Their "contact missing" results are held back in ``held`` rather than stored. If
    ``MISMATCH_PROBE`` of them are missing, the run stops with nothing stored on them: a
    wrong Google account would otherwise mark everyone missing. Only a contact written in
    Google (an update or create that succeeded) settles the probe; a network error, any
    other Google error or a photo-only upload proves nothing. Once settled (or when the run
    ends first) the held results are stored.
    """

    held: list[Person] = field(default_factory=list)
    settled: bool = False
    verified: bool = False


async def _inline(func: Callable[..., Any], *args: Any) -> Any:
    return func(*args)


class GoogleSyncer:
    """Runs the sync for one CRM's service through one Google link's client.

    ``executor`` runs the service's blocking reads and writes and ``photo_bytes`` off the
    event loop (``hass.async_add_executor_job``); by default they run inline.
    ``still_enabled``, when given, is asked before each person of a real run; once it
    answers ``False`` (the sync was switched off or Google disconnected) the run stops.
    """

    def __init__(
        self,
        service: HearthService,
        client: PeopleClient,
        photo_bytes: Callable[[str], bytes],
        now: Callable[[], datetime],
        *,
        executor: Executor | None = None,
        still_enabled: Callable[[], Awaitable[bool]] | None = None,
        sleep: Callable[[float], Awaitable[Any]] = asyncio.sleep,
    ) -> None:
        self._service = service
        self._client = client
        self._photo_bytes = photo_bytes
        self._now = now
        self._executor = executor or _inline
        self._still_enabled = still_enabled
        self._sleep = sleep
        # People a mismatch stop held, tried after everyone else while the link is
        # unverified, so a run isn't stopped by the same deleted contacts every time.
        self._mismatch_suspects: set[str] = set()
        # Contacts created in Google whose id the database refused: person id -> resource
        # name. Their create marker stays, so they are never created again; the next real
        # run stores the id.
        self._unsaved_ids: dict[str, str] = {}

    async def run(self, *, dry_run: bool = False, limit: int | None = None) -> SyncReport:
        """Sync every person with work, or with ``dry_run`` only count what would happen.

        ``limit`` bounds how many people with work (anything but "none" and "blocked")
        are processed; the rest count as ``pending``.
        """
        # The clock is read with the data, under the service's write lock: an edit that
        # lands between the two would otherwise be stamped earlier than the run yet be
        # missing from its snapshot, and so be marked synced without being sent.
        data, started_at = await self._executor(self._service.read_data_with_clock, self._now)
        report = SyncReport(dry_run=dry_run, started_at=started_at)
        if not dry_run and self._unsaved_ids:
            await self._store_unsaved_ids(data.people)
        households = {h.id: h for h in data.households}
        plans: list[tuple[Person, Household | None, Work]] = []
        for person in data.people:
            household = households.get(person.household_id) if person.household_id else None
            work = plan_for(person, household)
            if work.kind not in ("none", "blocked"):
                plans.append((person, household, work))

        verified = (not dry_run) and await self._executor(self._service.google_link_verified)
        probe = _MismatchProbe(settled=verified, verified=verified)
        if verified:
            self._mismatch_suspects.clear()
        elif self._mismatch_suspects:
            suspects = self._mismatch_suspects
            plans.sort(key=lambda plan: plan[0].id in suspects)  # stable: suspects last
        for index, (person, household, work) in enumerate(plans):
            # Held people aren't stored yet, so a run ending early leaves them to do.
            held_before = len(probe.held)
            if limit is not None and index >= limit:
                report.pending = len(plans) - index + held_before
                break
            if dry_run:
                _count_dry(report, person, work)
                continue
            if self._still_enabled is not None and not await self._still_enabled():
                report.stopped_reason = "disabled"
                report.pending = len(plans) - index + held_before
                break
            try:
                await self._sync_person(report, person, household, work, probe)
            except _Stop as stop:
                report.stopped_reason = stop.reason
                if stop.reason == "account_mismatch":
                    self._mismatch_suspects.update(p.id for p in probe.held)
                report.pending = (
                    len(plans) - index - (1 if stop.contact_written else 0) + held_before
                )
                break
        else:
            await self._settle(report, probe)

        _LOGGER.debug(
            "Google sync %s: %s created, %s updated, %s photos, %s skipped, %s missing, "
            "%s errors, %s pending, stopped: %s",
            "dry run" if dry_run else "run",
            report.created,
            report.updated,
            report.photos,
            report.skipped,
            report.missing,
            report.errors,
            report.pending,
            report.stopped_reason,
        )
        return report

    async def _sync_person(
        self,
        report: SyncReport,
        person: Person,
        household: Household | None,
        work: Work,
        probe: _MismatchProbe,
    ) -> None:
        """Do one person's work and record it. Raises ``_Stop`` to end the run.

        Until ``probe`` is settled, a missing contact is held there instead of stored.
        """
        started_at = report.started_at
        if work.kind == "skip":
            if await self._record(person, synced_at=started_at, error=None):
                report.skipped += 1
            return

        contact_id = person.google_contact_id
        marker_set = False
        try:
            if work.kind == "create":
                # Built first, so a failure here can't leave the marker with nothing sent.
                body = person_body(person, household)
                # Write-ahead: if the run dies once the POST may have been sent, the person
                # stays blocked rather than being created again by the next sweep.
                if not await self._record(person, error=ERROR_CREATE_UNCERTAIN):
                    return
                marker_set = True
                created = await self._client.create_contact(body)
                marker_set = False
                contact_id = created.resource_name
                stored = await self._store_new_id(person, contact_id, started_at)
                if stored is None:
                    return
                report.created += 1
                await self._written(report, probe)
                if not stored:
                    return  # no photo for a contact Hearth can't record yet
            elif work.kind == "update":
                assert contact_id is not None
                etag = await self._client.get_etag(contact_id)
                await self._client.update_contact(contact_id, etag, person_body(person, household))
                if not await self._record(person, synced_at=started_at, error=None):
                    return
                report.updated += 1
                await self._written(report, probe)
        except Exception as err:  # noqa: BLE001 - _failed re-raises what it doesn't handle
            await self._failed(report, person, err, clear_marker=marker_set, probe=probe)
            return

        if work.photo and contact_id:
            try:
                await self._sync_photo(report, person, contact_id, probe)
            except _Stop as stop:
                stop.contact_written = work.kind in ("create", "update")
                raise

    async def _store_new_id(
        self, person: Person, contact_id: str, synced_at: datetime
    ) -> bool | None:
        """Store a just-created contact's id, retrying a database that refuses for a moment.

        ``True`` once stored and ``None`` if the person was deleted. ``False`` if the
        database kept refusing: the id is kept in memory for the next run and the create
        marker stays, so the person is never created twice.
        """
        attempt = 0
        while True:
            try:
                recorded = await self._record(
                    person, contact_id=contact_id, synced_at=synced_at, error=None
                )
            except _DB_REFUSED as err:
                # Caught here, not in _failed: a TimeoutError from the write gate must not
                # replace the create marker with "network error".
                if attempt < STORE_RETRIES:
                    attempt += 1
                    await self._sleep(STORE_RETRY_DELAY)
                    continue
                self._log(person, err)
                self._unsaved_ids[person.id] = contact_id
                return False
            return True if recorded else None

    async def _store_unsaved_ids(self, people: list[Person]) -> None:
        """Store the ids an earlier run couldn't, on the people still waiting for them.

        Each stored person is updated in ``people`` too, so this run plans them as an
        update (``google_synced_at`` is still unset) rather than as blocked.
        """
        by_id = {p.id: p for p in people}
        for person_id, contact_id in list(self._unsaved_ids.items()):
            person = by_id.get(person_id)
            waiting = (
                person is not None
                and person.google_contact_id is None
                and person.google_sync_error == ERROR_CREATE_UNCERTAIN
            )
            if not waiting:
                del self._unsaved_ids[person_id]  # deleted, or the panel changed it since
                continue
            assert person is not None
            try:
                recorded = await self._record(person, contact_id=contact_id, error=None)
            except _DB_REFUSED as err:
                self._log(person, err)
                continue
            del self._unsaved_ids[person_id]
            if recorded:
                person.google_contact_id = contact_id
                person.google_sync_error = None

    async def _sync_photo(
        self,
        report: SyncReport,
        person: Person,
        contact_id: str,
        probe: _MismatchProbe,
    ) -> None:
        photo_hash = person.photo_hash
        assert photo_hash is not None
        try:
            jpeg = await self._executor(self._photo_bytes, photo_hash)
        except OSError as err:
            self._log(person, err)
            await self._problem(report, person, "error", PHOTO_UNREADABLE, PHOTO_UNREADABLE)
            return
        try:
            await self._client.update_photo(contact_id, jpeg)
        except Exception as err:  # noqa: BLE001 - _failed re-raises what it doesn't handle
            await self._failed(report, person, err, clear_marker=False, probe=probe)
            return
        if await self._record(person, photo_hash=photo_hash, error=None):
            report.photos += 1

    async def _failed(
        self,
        report: SyncReport,
        person: Person,
        err: Exception,
        *,
        clear_marker: bool,
        probe: _MismatchProbe | None = None,
    ) -> None:
        """Record one person's failure, or raise ``_Stop`` for one that ends the run.

        ``clear_marker`` takes back the write-ahead create marker for a failure that
        means nothing was created. A missing contact goes to ``probe`` while it is unsettled.
        Anything unexpected propagates, leaving the marker.
        """
        self._log(person, err)
        if isinstance(err, ContactMissing) and probe is not None and not probe.settled:
            probe.held.append(person)
            if len(probe.held) >= MISMATCH_PROBE:
                raise _Stop("account_mismatch") from None
            return
        # Order matters: CreateUncertain, ContactMissing, RateLimited and AccessRefused are
        # GoogleErrors, and the token errors are aiohttp.ClientErrors.
        if isinstance(err, (CreateUncertain, ContactMissing)):
            kind = "missing" if isinstance(err, ContactMissing) else "error"
            await self._problem(report, person, kind, err.stored_error, err.reason)
        elif isinstance(err, RateLimited):
            if clear_marker:
                await self._record(person, error=None)
            raise _Stop("rate_limited") from None
        elif isinstance(err, AccessRefused):
            # The API is off or the scope missing: the same for everyone, so stop.
            if clear_marker:
                await self._record(person, error=None)
            raise _Stop("api_disabled") from None
        elif isinstance(err, GoogleError):
            await self._problem(report, person, "error", err.reason, err.reason)
        elif isinstance(err, (GoogleAuthError, OAuth2TokenRequestReauthError)):
            # Not the person's fault: record nothing against them. Only these mean the
            # owner must sign in again.
            if clear_marker:
                await self._record(person, error=None)
            raise _Stop("auth") from None
        elif isinstance(err, OAuth2TokenRequestBaseError):
            # Google's token endpoint failed for a moment: the token refresh, before
            # anything was sent. The run fails plainly and the next sweep tries again.
            if clear_marker:
                await self._record(person, error=None)
            raise err
        elif isinstance(err, (aiohttp.ClientError, TimeoutError)):
            await self._problem(report, person, "error", NETWORK_ERROR, NETWORK_ERROR)
        else:
            raise err

    async def _written(self, report: SyncReport, probe: _MismatchProbe) -> None:
        """Google accepted a contact write: the link works. Verify it once, and settle."""
        if not probe.verified:
            try:
                await self._executor(self._service.mark_google_link_verified)
            except _DB_REFUSED as err:
                # Not stored this time; the next accepted write tries again.
                _LOGGER.warning(
                    "Could not record the verified Google link: %s", type(err).__name__
                )
            else:
                probe.verified = True
                self._mismatch_suspects.clear()
        await self._settle(report, probe)

    async def _settle(self, report: SyncReport, probe: _MismatchProbe) -> None:
        """End the probe (a contact was written, or the run ended): store what it held."""
        if probe.settled:
            return
        probe.settled = True
        held, probe.held = probe.held, []
        for person in held:
            await self._problem(
                report, person, "missing", ERROR_CONTACT_MISSING, ERROR_CONTACT_MISSING
            )

    async def _problem(
        self,
        report: SyncReport,
        person: Person,
        kind: Literal["missing", "error"],
        stored: str | None,
        message: str,
    ) -> None:
        """Store the error (``synced_at`` unchanged, so it is retried unless blocked)."""
        if not await self._record(person, error=stored):
            return
        if kind == "missing":
            report.missing += 1
        else:
            report.errors += 1
        if len(report.problems) < MAX_PROBLEMS:
            report.problems.append(SyncOutcome(person.id, person.name, kind, message))

    async def _record(
        self,
        person: Person,
        *,
        synced_at: datetime | None | Unset = UNSET,
        contact_id: str | None | Unset = UNSET,
        photo_hash: str | None | Unset = UNSET,
        error: str | None,
    ) -> bool:
        """Write the person's sync state; ``False`` if they were deleted meanwhile."""
        try:
            await self._executor(
                partial(
                    self._service.record_google_sync,
                    person.id,
                    synced_at=synced_at,
                    contact_id=contact_id,
                    photo_hash=photo_hash,
                    error=error,
                )
            )
        except NotFound:
            _LOGGER.debug("Person %s was deleted during the Google sync", person.id)
            return False
        return True

    @staticmethod
    def _log(person: Person, err: BaseException) -> None:
        # Only the type name: an exception's text or request_info can hold contact
        # details or the bearer token.
        _LOGGER.warning("Google sync of person %s failed: %s", person.id, type(err).__name__)


def _count_dry(report: SyncReport, person: Person, work: Work) -> None:
    if work.kind == "skip":
        report.skipped += 1
        return
    if work.kind == "create":
        report.created += 1
        if len(report.would_create) < MAX_WOULD_CREATE:
            report.would_create.append(person.name)
    elif work.kind == "update":
        report.updated += 1
        report.would_update += 1
    if work.photo:
        report.photos += 1
