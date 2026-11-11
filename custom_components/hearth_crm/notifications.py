"""Phone notifications from Hearth: birthdays, a nudge to log interactions, and reminders.

One ``NotificationRuntime`` per loaded CRM. Each daily notification that is switched on fires
once a day at its time (Home Assistant's time zone) and goes to the Home Assistant Companion
app devices registered to the CRM's owner, so nobody else's phone is ever told about this CRM.
A daily time that passes while Home Assistant is down is skipped, not sent late.

Reminders are different: a check runs at start and every minute, and sends each reminder whose
scheduled date has passed and was not yet notified, so none is lost while Home Assistant is
down. A date counts as notified only once a device accepted it (or the switch was off), so a
reminder with no phone, or whose sends all fail, is retried on the next check.

What is sent is built by pure functions (``birthday_notifications``, ``needs_log_reminder``)
so the wording and the tap targets are tested without Home Assistant. Logs hold only
exception type names, never a name, a number or a message.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.helpers.event import async_track_time_change, async_track_time_interval
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from . import reminders
from .const import PANEL_URL_PATH
from .derive import upcoming_birthdays
from .models import Interaction, Person, Reminder

if TYPE_CHECKING:
    from . import HearthRuntime

_LOGGER = logging.getLogger(__name__)

MOBILE_APP = "mobile_app"
NO_PHONE = (
    "No phone is set up for notifications. Install the Home Assistant Companion app and sign "
    "in as this user."
)
REMINDER_CHECK_EVERY = timedelta(seconds=60)
REMINDER_LOG_EVERY = timedelta(hours=1)
_WHOLE_CHECK = ""  # the throttle key for a check that failed before reaching any reminder


@dataclass(frozen=True)
class Notification:
    title: str
    message: str
    data: dict[str, Any] = field(default_factory=dict)


def _panel_path(*parts: str) -> str:
    return "/".join(["", PANEL_URL_PATH, *(quote(p, safe="") for p in parts)])


def sms_uri(phone: str | None) -> str | None:
    """An ``sms:`` link for a phone number, or None when it holds no digits."""
    text = (phone or "").strip()
    digits = re.sub(r"\D", "", text)
    if not digits:
        return None
    return f"sms:{'+' if text.startswith('+') else ''}{digits}"


def _tap_data(person: Person, tag: str) -> dict[str, Any]:
    """A tap texts the person's first number (with a profile button), else opens the profile."""
    profile = _panel_path("person", person.id)
    text = sms_uri(person.phone) or sms_uri(person.phone2)
    if text:
        return _tapping(text, buttons=[("Open profile", profile)], tag=tag)
    return _tapping(profile, tag=tag)


def _tapping(url: str, *, buttons: list[tuple[str, str]] | None = None, tag: str) -> dict[str, Any]:
    """Companion app options: what a tap opens (iOS reads ``url``, Android ``clickAction``)."""
    data: dict[str, Any] = {"tag": tag, "url": url, "clickAction": url}
    if buttons:
        data["actions"] = [
            {"action": "URI", "title": title, "uri": uri} for title, uri in buttons
        ]
    return data


def birthday_notifications(people: list[Person], today: date) -> list[Notification]:
    """One notification per person whose birthday is today.

    A tap opens a text to the person's first phone number; with no number it opens their
    profile in Hearth. When a text is what a tap does, a button opens the profile instead.
    """
    by_id = {p.id: p for p in people}
    notes = []
    for birthday in upcoming_birthdays(people, today, within_days=0):
        person = by_id[birthday.person_id]
        message = f"Today is {birthday.name}'s birthday!"
        if birthday.turning is not None:
            years = "year" if birthday.turning == 1 else "years"
            message += f" They are turning {birthday.turning} {years} old."
        notes.append(Notification("Birthday", message, _tap_data(person, f"hearth-birthday-{person.id}")))
    return notes


def reminder_notification(person: Person, reminder: Reminder) -> Notification:
    """A due reminder; a tap behaves as it does for a birthday."""
    return Notification(
        f"Follow up with {person.name}",
        reminder.note or f"Time to check in with {person.name}.",
        _tap_data(person, f"hearth-reminder-{reminder.id}"),
    )


def needs_log_reminder(interactions: list[Interaction], today: date) -> bool:
    """True when nothing was logged today: nothing dated today and nothing created today."""
    for interaction in interactions:
        if interaction.date == today or dt_util.as_local(interaction.created_at).date() == today:
            return False
    return True


def log_reminder() -> Notification:
    """The nudge; a tap opens Hearth's search, where you pick who you caught up with."""
    return Notification(
        "Log your interactions",
        "You haven't logged any interactions today. Anyone you caught up with?",
        _tapping(_panel_path("search"), tag="hearth-log-reminder"),
    )


def sample_notification(person_id: str | None = None) -> Notification:
    """Checks the tap behaviours: the tap should open Messages, one button should open one
    person's profile (when there is one to open) and the other should open Hearth."""
    buttons = [("Open Hearth", _panel_path())]
    message = "Tap this and Messages should open. The button opens Hearth."
    if person_id is not None:
        buttons.insert(0, ("Open a profile", _panel_path("person", person_id)))
        message = (
            "Tap this and Messages should open. One button opens a person's profile in "
            "Hearth; the other opens Hearth."
        )
    return Notification("Hearth test", message, _tapping("sms:", buttons=buttons, tag="hearth-test"))


class NotificationRuntime:
    """Schedules one CRM's notifications and sends them."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, runtime: HearthRuntime) -> None:
        self._hass = hass
        self._entry = entry
        self._runtime = runtime
        self._unsubs: list[CALLBACK_TYPE] = []
        self._unsub_check: CALLBACK_TYPE | None = None
        self._check_lock = asyncio.Lock()
        self._start_check: asyncio.Task | None = None
        self._stopped = False
        self._last_failure_log: dict[str, datetime] = {}
        # Sends a phone accepted whose notified date is not saved yet (say, a backup held the
        # database): later checks retry only the save, so the phone is not told twice.
        self._unmarked: dict[str, datetime] = {}

    async def async_start(self) -> None:
        self._stopped = False
        await self.async_reschedule()
        self._cancel_check()
        self._unsub_check = async_track_time_interval(
            self._hass, self._check_reminders, REMINDER_CHECK_EVERY
        )
        # In the background, so a slow phone cannot hold up setting up the integration.
        self._start_check = self._hass.async_create_background_task(
            self._check_reminders(), f"hearth_crm reminders {self._entry.entry_id}"
        )

    async def stop(self) -> None:
        """Cancel the timers and wait for a check that is running, so nothing touches the
        database (which closes right after) once this returns."""
        self._stopped = True
        self._cancel()
        self._cancel_check()
        task, self._start_check = self._start_check, None
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        async with self._check_lock:
            pass

    def _cancel_check(self) -> None:
        if self._unsub_check is not None:
            self._unsub_check()
            self._unsub_check = None

    def _cancel(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []

    async def _settings(self) -> dict:
        return await self._hass.async_add_executor_job(
            self._runtime.service.get_notification_settings
        )

    async def async_reschedule(self) -> None:
        """Set the daily timers from the stored settings (after setup and every change)."""
        settings = await self._settings()
        self._cancel()
        for kind, action in (("birthdays", self._send_birthdays), ("log_reminder", self._send_reminder)):
            if not settings[kind]["enabled"]:
                continue
            hour, minute = (int(part) for part in settings[kind]["time"].split(":"))
            self._unsubs.append(
                async_track_time_change(self._hass, action, hour=hour, minute=minute, second=0)
            )

    def targets(self) -> list[str]:
        """The ``notify`` services of the owner's Companion app devices."""
        names = []
        for entry in self._hass.config_entries.async_entries(MOBILE_APP):
            if entry.data.get("user_id") != self._runtime.owner_user_id:
                continue
            name = f"{MOBILE_APP}_{slugify(entry.data.get('device_name') or '')}"
            if self._hass.services.has_service("notify", name):
                names.append(name)
        return names

    async def status(self) -> dict:
        return {"settings": await self._settings(), "devices": len(self.targets())}

    async def send_test(self) -> int:
        """Send the test notification; resolves to how many devices took it."""
        data = await self._hass.async_add_executor_job(self._runtime.service.read_data)
        me = await self._hass.async_add_executor_job(self._runtime.service.get_settings)
        known = {p.id for p in data.people}
        person_id = me["me_person_id"] if me["me_person_id"] in known else None
        if person_id is None and data.people:
            person_id = min(data.people, key=lambda p: p.name.casefold()).id
        return await self._send([sample_notification(person_id)])

    async def _send_birthdays(self, now: datetime) -> None:
        if not (await self._settings())["birthdays"]["enabled"]:
            return
        data = await self._hass.async_add_executor_job(self._runtime.service.read_data)
        await self._send(birthday_notifications(data.people, dt_util.now().date()))

    async def _send_reminder(self, now: datetime) -> None:
        if not (await self._settings())["log_reminder"]["enabled"]:
            return
        data = await self._hass.async_add_executor_job(self._runtime.service.read_data)
        if needs_log_reminder(data.interactions, dt_util.now().date()):
            await self._send([log_reminder()])

    async def _check_reminders(self, now: datetime | None = None) -> None:
        """Send each due, not yet notified reminder (``now`` is the timer's, and in UTC, so the
        zone and the instant come from Home Assistant instead).

        Each reminder is tried on its own: one that fails, for any reason, is logged by type
        (about once an hour) and retried on the next check, and the others still go out.
        """
        async with self._check_lock:
            if self._stopped:
                return
            instant = dt_util.utcnow()
            try:
                await self._check_reminders_at(instant)
            except Exception as err:  # the next check tries again
                self._log_reminder_failure(_WHOLE_CHECK, [type(err).__name__], instant)

    async def _check_reminders_at(self, instant: datetime) -> None:
        service = self._runtime.service
        tz = dt_util.get_default_time_zone()
        data = await self._hass.async_add_executor_job(service.read_data)
        due: dict[str, tuple[Reminder, datetime]] = {}
        for r in data.reminders:
            try:
                occurrence = reminders.due_occurrence(r, instant, tz)
            except Exception as err:  # a bad row must not stop the others
                self._log_reminder_failure(r.id, [type(err).__name__], instant)
                continue
            if occurrence is not None:
                due[r.id] = (r, occurrence)
        # Forget sends whose reminder is gone, or whose due date moved on (done, edited).
        self._unmarked = {
            rid: occ
            for rid, occ in self._unmarked.items()
            if rid in due and due[rid][1] == occ
        }
        if not due:
            return
        enabled = (await self._settings())["reminders"]["enabled"]
        people = {p.id: p for p in data.people}
        for reminder, occurrence in due.values():
            try:
                await self._notify_reminder(reminder, occurrence, people, enabled, instant)
            except Exception as err:  # the next check tries again
                self._log_reminder_failure(reminder.id, [type(err).__name__], instant)

    async def _notify_reminder(
        self,
        reminder: Reminder,
        occurrence: datetime,
        people: dict[str, Person],
        enabled: bool,
        instant: datetime,
    ) -> None:
        """Send one due reminder (unless it already went out) and save its notified date."""
        if self._unmarked.get(reminder.id) != occurrence:
            if enabled:
                if reminder.person_id not in people:
                    return
                errors: list[str] = []
                note = reminder_notification(people[reminder.person_id], reminder)
                if not await self._send([note], errors=errors):
                    self._log_reminder_failure(reminder.id, errors, instant)
                    return
            self._unmarked[reminder.id] = occurrence
        await self._hass.async_add_executor_job(
            self._runtime.service.mark_reminder_notified, reminder.id, occurrence
        )
        self._unmarked.pop(reminder.id, None)

    def _log_reminder_failure(self, reminder_id: str, errors: list[str], instant: datetime) -> None:
        """Log why a reminder could not be sent, by type only and about once an hour."""
        if not errors:
            return  # no phone: the status says so, and the next check tries again
        last = self._last_failure_log.get(reminder_id)
        if last is not None and instant - last < REMINDER_LOG_EVERY:
            return
        self._last_failure_log[reminder_id] = instant
        _LOGGER.warning("A Hearth reminder could not be sent (%s)", ", ".join(sorted(set(errors))))

    async def _send(self, notes: list[Notification], *, errors: list[str] | None = None) -> int:
        """Send to every owner device; resolves to how many sends were accepted. With
        ``errors``, failures are collected there (as type names) instead of being logged."""
        sent = 0
        for target in self.targets():
            for note in notes:
                try:
                    await self._hass.services.async_call(
                        "notify",
                        target,
                        {"title": note.title, "message": note.message, "data": note.data},
                        blocking=True,
                    )
                    sent += 1
                except Exception as err:  # a broken notify service is one failed device
                    if errors is None:
                        _LOGGER.warning(
                            "A Hearth notification could not be sent (%s)", type(err).__name__
                        )
                    else:
                        errors.append(type(err).__name__)
        return sent
