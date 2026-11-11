"""Phone notifications from Hearth: birthdays, and a nudge to log interactions.

One ``NotificationRuntime`` per loaded CRM. Each notification that is switched on fires once a
day at its time (Home Assistant's time zone) and goes to the Home Assistant Companion app
devices registered to the CRM's owner, so nobody else's phone is ever told about this CRM. A
time that passes while Home Assistant is down is skipped, not sent late.

What is sent is built by pure functions (``birthday_notifications``, ``needs_log_reminder``)
so the wording and the tap targets are tested without Home Assistant. Logs hold only
exception type names, never a name, a number or a message.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_time_change
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from .const import PANEL_URL_PATH
from .derive import upcoming_birthdays
from .models import Interaction, Person

if TYPE_CHECKING:
    from . import HearthRuntime

_LOGGER = logging.getLogger(__name__)

MOBILE_APP = "mobile_app"
NO_PHONE = (
    "No phone is set up for notifications. Install the Home Assistant Companion app and sign "
    "in as this user."
)


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
        profile = _panel_path("person", person.id)
        text = sms_uri(person.phone) or sms_uri(person.phone2)
        tag = f"hearth-birthday-{person.id}"
        data = (
            _tapping(text, buttons=[("Open profile", profile)], tag=tag)
            if text
            else _tapping(profile, tag=tag)
        )
        notes.append(Notification("Birthday", message, data))
    return notes


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

    async def async_start(self) -> None:
        await self.async_reschedule()

    def stop(self) -> None:
        self._cancel()

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

    async def _send(self, notes: list[Notification]) -> int:
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
                except HomeAssistantError as err:
                    _LOGGER.warning("A Hearth notification could not be sent (%s)", type(err).__name__)
        return sent
