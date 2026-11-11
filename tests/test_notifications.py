"""Tests for Hearth's phone notifications: the wording, the settings and the daily timers.

Invented people and numbers only. The Companion app is faked with a ``notify`` service.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, date, datetime, timedelta

import pytest
from homeassistant.core import ServiceCall
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.hearth_crm.models import Interaction, Person, Reminder
from custom_components.hearth_crm.notifications import (
    NO_PHONE,
    birthday_notifications,
    log_reminder,
    needs_log_reminder,
    reminder_notification,
    sample_notification,
    sms_uri,
)
from custom_components.hearth_crm.enums import InteractionType
from custom_components.hearth_crm.service import InvalidInput
from tests.conftest import T0, T1

TODAY = date(2026, 6, 15)


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


def person(pid: str, name: str, **kw) -> Person:
    return Person(id=pid, name=name, created_at=T0, updated_at=T1, **kw)


def interaction(when: date, created: datetime = T0) -> Interaction:
    return Interaction(
        id="i1", summary="Coffee", date=when, type=InteractionType.CATCH_UP,
        created_at=created, updated_at=created, person_ids=["p1"],
    )


# -- sms links ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("phone", "expected"),
    [
        ("(555) 010-0142", "sms:5550100142"),
        ("+1 555 010 0142", "sms:+15550100142"),
        ("555.010.0142", "sms:5550100142"),
        ("", None),
        (None, None),
        ("ext", None),
    ],
)
def test_sms_uri(phone, expected):
    assert sms_uri(phone) == expected


# -- birthdays ------------------------------------------------------------------


def test_birthday_says_the_age_and_a_tap_opens_a_text():
    people = [person("p1", "Roy Example", birthday=date(1983, 6, 15), phone="555-010-0142")]
    [note] = birthday_notifications(people, TODAY)
    assert note.title == "Birthday"
    assert note.message == "Today is Roy Example's birthday! They are turning 43 years old."
    assert note.data["url"] == note.data["clickAction"] == "sms:5550100142"
    assert note.data["tag"] == "hearth-birthday-p1"
    assert note.data["actions"] == [
        {"action": "URI", "title": "Open profile", "uri": "/hearth/person/p1"}
    ]


def test_birthday_without_a_known_year_leaves_the_age_out():
    people = [person("p1", "Roy Example", birthday=date(2000, 6, 15), birth_year_unknown=True)]
    [note] = birthday_notifications(people, TODAY)
    assert note.message == "Today is Roy Example's birthday!"


def test_a_first_birthday_is_one_year_old():
    [note] = birthday_notifications([person("p1", "Kit Example", birthday=date(2025, 6, 15))], TODAY)
    assert note.message.endswith("They are turning 1 year old.")


def test_without_a_phone_a_tap_opens_the_profile_and_there_is_no_button():
    [note] = birthday_notifications([person("p1", "Roy Example", birthday=date(1983, 6, 15))], TODAY)
    assert note.data["url"] == "/hearth/person/p1"
    assert "actions" not in note.data


def test_the_second_number_is_used_when_the_first_is_missing():
    people = [person("p1", "Roy Example", birthday=date(1983, 6, 15), phone2="555-010-0199")]
    [note] = birthday_notifications(people, TODAY)
    assert note.data["url"] == "sms:5550100199"


def test_only_todays_birthdays_get_one_notification_each():
    people = [
        person("p1", "Ann Example", birthday=date(1990, 6, 15)),
        person("p2", "Bob Example", birthday=date(1985, 6, 15)),
        person("p3", "Cy Example", birthday=date(1985, 6, 16)),
        person("p4", "Di Example"),
    ]
    notes = birthday_notifications(people, TODAY)
    assert [n.message.split("'")[0] for n in notes] == [
        "Today is Ann Example", "Today is Bob Example"
    ]
    assert len({n.data["tag"] for n in notes}) == 2


def test_a_person_id_with_odd_characters_is_encoded_in_the_profile_link():
    [note] = birthday_notifications([person("a b/c", "Roy Example", birthday=date(1983, 6, 15))], TODAY)
    assert note.data["url"] == "/hearth/person/a%20b%2Fc"


# -- the log reminder -------------------------------------------------------------


def test_reminder_is_due_when_nothing_was_logged_today():
    assert needs_log_reminder([], TODAY)
    assert needs_log_reminder([interaction(TODAY - timedelta(days=1))], TODAY)


def test_an_interaction_dated_today_counts():
    assert not needs_log_reminder([interaction(TODAY)], TODAY)


def test_an_interaction_created_today_counts_even_when_dated_earlier():
    created = datetime(2026, 6, 15, 19, 0, tzinfo=UTC)
    assert not needs_log_reminder([interaction(TODAY - timedelta(days=3), created)], dt_util.as_local(created).date())


def test_wording_of_the_reminder_and_the_test_notification():
    note = log_reminder()
    assert note.message == "You haven't logged any interactions today. Anyone you caught up with?"
    assert note.data["url"] == "/hearth/search"
    sample = sample_notification()
    assert sample.data["url"] == "sms:"
    assert [a["uri"] for a in sample.data["actions"]] == ["/hearth"]
    with_profile = sample_notification("p1")
    assert [(a["title"], a["uri"]) for a in with_profile.data["actions"]] == [
        ("Open a profile", "/hearth/person/p1"), ("Open Hearth", "/hearth"),
    ]


# -- the settings --------------------------------------------------------------------


@pytest.fixture
async def crm(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    return hass_admin_user, entry


async def test_settings_default_to_off_at_nine_and_eight(hass, crm):
    _, entry = crm
    settings = await hass.async_add_executor_job(entry.runtime_data.service.get_notification_settings)
    assert settings == {
        "birthdays": {"enabled": False, "time": "09:00"},
        "log_reminder": {"enabled": False, "time": "20:00"},
        "reminders": {"enabled": True},
    }


async def test_a_change_keeps_what_it_does_not_mention(hass, crm):
    _, entry = crm
    service = entry.runtime_data.service
    await hass.async_add_executor_job(
        service.set_notification_settings, {"birthdays": {"enabled": True}}, "panel"
    )
    settings = await hass.async_add_executor_job(
        service.set_notification_settings, {"birthdays": {"time": "07:30"}, "log_reminder": {"enabled": True}}, "panel"
    )
    assert settings == {
        "birthdays": {"enabled": True, "time": "07:30"},
        "log_reminder": {"enabled": True, "time": "20:00"},
        "reminders": {"enabled": True},
    }
    assert await hass.async_add_executor_job(service.get_notification_settings) == settings


@pytest.mark.parametrize(
    "changes",
    [
        {"weather": {"enabled": True}},
        {"birthdays": {"enabled": "yes"}},
        {"birthdays": {"enabled": 1}},
        {"birthdays": {"time": "25:00"}},
        {"birthdays": {"time": "9:00"}},
        {"birthdays": {"time": "09:60"}},
        {"birthdays": {"time": 900}},
        {"birthdays": {"colour": "red"}},
        {"birthdays": True},
        [],
    ],
)
async def test_bad_changes_are_refused_and_change_nothing(hass, crm, changes):
    _, entry = crm
    service = entry.runtime_data.service
    before = await hass.async_add_executor_job(service.get_notification_settings)
    with pytest.raises(InvalidInput):
        await hass.async_add_executor_job(service.set_notification_settings, changes, "panel")
    assert await hass.async_add_executor_job(service.get_notification_settings) == before


# -- delivery -----------------------------------------------------------------------------


def add_phone(hass, user_id: str, device_name: str, sent: list[ServiceCall]) -> None:
    """A Companion app device for ``user_id``, with its ``notify`` service."""
    MockConfigEntry(
        domain="mobile_app", data={"user_id": user_id, "device_name": device_name}
    ).add_to_hass(hass)

    async def handler(call: ServiceCall) -> None:
        sent.append(call)

    name = "mobile_app_" + device_name.lower().replace(" ", "_")
    hass.services.async_register("notify", name, handler)


async def test_only_the_owners_phones_are_targeted(hass, crm):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    add_phone(hass, "someone-else", "Other Phone", sent)
    assert entry.runtime_data.notifications.targets() == ["mobile_app_test_phone"]


async def test_a_device_without_a_notify_service_is_not_targeted(hass, crm):
    user, entry = crm
    MockConfigEntry(domain="mobile_app", data={"user_id": user.id, "device_name": "Gone"}).add_to_hass(hass)
    assert entry.runtime_data.notifications.targets() == []


async def test_the_test_notification_reaches_the_owners_phone(hass, crm):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    assert await entry.runtime_data.notifications.send_test() == 1
    [call] = sent
    assert call.data["title"] == "Hearth test"
    assert call.data["data"]["url"] == "sms:"
    assert [a["uri"] for a in call.data["data"]["actions"]] == ["/hearth"]  # no people yet: no profile button


async def test_the_test_notification_offers_a_real_profile_when_there_is_one(hass, crm):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    await hass.async_add_executor_job(service.create, "person", {"name": "Zed Example"}, "panel")
    first = await hass.async_add_executor_job(service.create, "person", {"name": "Ada Example"}, "panel")
    await entry.runtime_data.notifications.send_test()
    assert sent[-1].data["data"]["actions"][0] == {
        "action": "URI", "title": "Open a profile", "uri": f"/hearth/person/{first['id']}",
    }
    # "This is me" wins when it is set.
    zed = [p for p in (await hass.async_add_executor_job(service.read_data)).people if p.name == "Zed Example"][0]
    await hass.async_add_executor_job(service.set_settings, {"me_person_id": zed.id}, "panel")
    await entry.runtime_data.notifications.send_test()
    assert sent[-1].data["data"]["actions"][0]["uri"] == f"/hearth/person/{zed.id}"


async def test_a_failing_phone_is_logged_by_type_and_the_others_still_get_it(hass, crm, caplog):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Good Phone", sent)
    MockConfigEntry(domain="mobile_app", data={"user_id": user.id, "device_name": "Bad Phone"}).add_to_hass(hass)

    async def broken(call: ServiceCall) -> None:
        from homeassistant.exceptions import HomeAssistantError

        raise HomeAssistantError("the secret message text")

    hass.services.async_register("notify", "mobile_app_bad_phone", broken)
    assert await entry.runtime_data.notifications.send_test() == 1
    assert len(sent) == 1
    assert "HomeAssistantError" in caplog.text
    assert "the secret message text" not in caplog.text


async def at_local(hass, freezer, hour: int, minute: int = 0, *, day: date | None = None) -> None:
    """Move to this time today (or on ``day``), in Home Assistant's time zone, and let timers fire."""
    target = datetime.combine(day or dt_util.now().date(), datetime.min.time(), dt_util.DEFAULT_TIME_ZONE)
    freezer.move_to(target + timedelta(hours=hour, minutes=minute, seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done(wait_background_tasks=True)


async def test_birthday_notifications_fire_at_the_chosen_time_only_when_on(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    today = dt_util.now().date()
    service = entry.runtime_data.service
    await hass.async_add_executor_job(
        service.create, "person", {"name": "Roy Example", "birthday": today.replace(year=1983).isoformat()}, "panel"
    )
    freezer.move_to(datetime.combine(today, datetime.min.time(), dt_util.DEFAULT_TIME_ZONE) + timedelta(hours=5))

    # Off by default: the time passes and nothing is sent.
    await entry.runtime_data.notifications.async_reschedule()
    await at_local(hass, freezer, 9)
    assert sent == []

    await hass.async_add_executor_job(
        service.set_notification_settings, {"birthdays": {"enabled": True, "time": "09:30"}}, "panel"
    )
    await entry.runtime_data.notifications.async_reschedule()
    await at_local(hass, freezer, 9, 0)  # before the time
    assert sent == []
    await at_local(hass, freezer, 9, 30)
    assert [c.data["message"] for c in sent] == [
        f"Today is Roy Example's birthday! They are turning {today.year - 1983} years old."
    ]


async def test_the_reminder_is_sent_only_when_nothing_was_logged(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    today = dt_util.now().date()
    await hass.async_add_executor_job(
        service.set_notification_settings, {"log_reminder": {"enabled": True, "time": "20:00"}}, "panel"
    )
    # Freeze first: a timer set after 8 pm would otherwise wait for tomorrow.
    freezer.move_to(datetime.combine(today, datetime.min.time(), dt_util.DEFAULT_TIME_ZONE) + timedelta(hours=5))
    await entry.runtime_data.notifications.async_reschedule()

    await at_local(hass, freezer, 20)
    assert [c.data["title"] for c in sent] == ["Log your interactions"]

    sent.clear()
    person = await hass.async_add_executor_job(service.create, "person", {"name": "Roy Example"}, "panel")
    await hass.async_add_executor_job(
        service.create,
        "interaction",
        {"summary": "Coffee", "date": today.isoformat(), "type": "Catch-up", "person_ids": [person["id"]]},
        "panel",
    )
    await at_local(hass, freezer, 20, day=today + timedelta(days=1))  # the next day's reminder: nothing logged then
    assert len(sent) == 1
    sent.clear()
    freezer.move_to(datetime.combine(today, datetime.min.time(), dt_util.DEFAULT_TIME_ZONE) + timedelta(hours=5))
    await entry.runtime_data.notifications.async_reschedule()
    await at_local(hass, freezer, 20)
    assert sent == []  # something was logged today


async def test_switching_a_notification_off_cancels_its_timer(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    await hass.async_add_executor_job(
        service.set_notification_settings, {"log_reminder": {"enabled": True, "time": "20:00"}}, "panel"
    )
    await entry.runtime_data.notifications.async_reschedule()
    await hass.async_add_executor_job(
        service.set_notification_settings, {"log_reminder": {"enabled": False}}, "panel"
    )
    await entry.runtime_data.notifications.async_reschedule()
    await at_local(hass, freezer, 20)
    assert sent == []


async def test_no_phone_means_nothing_is_sent_and_the_status_says_so(hass, crm):
    _, entry = crm
    status = await entry.runtime_data.notifications.status()
    assert status["devices"] == 0
    assert await entry.runtime_data.notifications.send_test() == 0
    assert "Companion app" in NO_PHONE


async def test_unloading_stops_the_timers(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    await hass.async_add_executor_job(
        entry.runtime_data.service.set_notification_settings,
        {"log_reminder": {"enabled": True, "time": "20:00"}}, "panel",
    )
    await entry.runtime_data.notifications.async_reschedule()
    assert await hass.config_entries.async_unload(entry.entry_id)
    await at_local(hass, freezer, 20)
    assert sent == []


# -- reminders: wording ---------------------------------------------------------------


def a_reminder(**kw) -> Reminder:
    return Reminder(id="r1", person_id="p1", created_at=T0, updated_at=T1, **kw)


def test_reminder_notification_wording_and_taps():
    roy = person("p1", "Roy Example", phone="555-010-0142")
    note = reminder_notification(roy, a_reminder(note="Ask about the move"))
    assert note.title == "Follow up with Roy Example"
    assert note.message == "Ask about the move"
    assert note.data["tag"] == "hearth-reminder-r1"
    assert note.data["url"] == note.data["clickAction"] == "sms:5550100142"
    assert note.data["actions"] == [
        {"action": "URI", "title": "Open profile", "uri": "/hearth/person/p1"}
    ]

    plain = reminder_notification(roy, a_reminder())
    assert plain.message == "Time to check in with Roy Example."

    no_number = reminder_notification(person("p1", "Roy Example"), a_reminder())
    assert no_number.data["url"] == "/hearth/person/p1"
    assert "actions" not in no_number.data


async def test_reminder_settings_have_no_time(hass, crm):
    _, entry = crm
    service = entry.runtime_data.service
    assert (await hass.async_add_executor_job(service.get_notification_settings))["reminders"] == {
        "enabled": True
    }
    with pytest.raises(InvalidInput):
        await hass.async_add_executor_job(
            service.set_notification_settings, {"reminders": {"time": "09:00"}}, "panel"
        )
    settings = await hass.async_add_executor_job(
        service.set_notification_settings, {"reminders": {"enabled": False}}, "panel"
    )
    assert settings["reminders"] == {"enabled": False}


# -- reminders: delivery -----------------------------------------------------------------

BASE = datetime(2026, 6, 15, 12, 0, tzinfo=UTC)
MINUTE = timedelta(minutes=1)


def iso(when: datetime) -> str:
    return when.isoformat()


async def start_at(hass, freezer, entry, when: datetime = BASE) -> None:
    """Freeze the clock first, then start: the check timer is set from the frozen time."""
    freezer.move_to(when)
    await entry.runtime_data.notifications.async_start()
    await hass.async_block_till_done(wait_background_tasks=True)


async def tick(hass, freezer, when: datetime) -> None:
    freezer.move_to(when)
    async_fire_time_changed(hass, when)
    await hass.async_block_till_done(wait_background_tasks=True)


async def make_reminder(hass, entry, **fields) -> dict:
    service = entry.runtime_data.service
    who = await hass.async_add_executor_job(service.create, "person", {"name": "Roy Example"}, "panel")
    return await hass.async_add_executor_job(
        service.create, "reminder", {"person_id": who["id"]} | fields, "panel"
    )


async def stored_reminder(hass, entry, reminder_id: str) -> Reminder:
    data = await hass.async_add_executor_job(entry.runtime_data.service.read_data)
    return next(r for r in data.reminders if r.id == reminder_id)


async def test_a_due_reminder_is_sent_once_and_not_again(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    freezer.move_to(BASE)
    due = BASE + timedelta(seconds=90)
    made = await make_reminder(hass, entry, due_at=iso(due), note="Ask about the move")
    await start_at(hass, freezer, entry)
    assert sent == []  # not due yet
    await tick(hass, freezer, BASE + 2 * MINUTE)
    assert [c.data["message"] for c in sent] == ["Ask about the move"]
    assert (await stored_reminder(hass, entry, made["id"])).notified_for == due
    await tick(hass, freezer, BASE + 3 * MINUTE)
    assert len(sent) == 1


async def test_a_reminder_that_came_due_while_stopped_is_sent_at_start(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    freezer.move_to(BASE)
    await make_reminder(hass, entry, due_at=iso(BASE - timedelta(days=1)))
    await start_at(hass, freezer, entry)
    assert len(sent) == 1
    assert sent[0].data["title"] == "Follow up with Roy Example"


async def test_an_ignored_repeating_reminder_fires_at_each_scheduled_date(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    freezer.move_to(BASE)
    first = BASE + timedelta(hours=1)
    await make_reminder(hass, entry, due_at=iso(first), repeat_every=2, repeat_unit="week")
    await start_at(hass, freezer, entry)
    await tick(hass, freezer, first + MINUTE)
    assert len(sent) == 1
    await tick(hass, freezer, first + timedelta(weeks=1))
    assert len(sent) == 1
    await tick(hass, freezer, first + timedelta(weeks=2, minutes=1))
    assert len(sent) == 2


async def test_completing_a_repeating_reminder_stops_the_old_date_and_waits_for_the_next(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    freezer.move_to(BASE)
    first = BASE + timedelta(hours=1)
    made = await make_reminder(hass, entry, due_at=iso(first), repeat_every=2, repeat_unit="week")
    await start_at(hass, freezer, entry)
    await tick(hass, freezer, first + MINUTE)
    assert len(sent) == 1
    await hass.async_add_executor_job(
        entry.runtime_data.service.complete_reminder, made["id"], "panel"
    )
    await tick(hass, freezer, first + 2 * MINUTE)
    await tick(hass, freezer, first + timedelta(weeks=1))
    assert len(sent) == 1
    await tick(hass, freezer, first + timedelta(weeks=2, minutes=1))
    assert len(sent) == 2


async def test_no_phone_keeps_it_unfired_and_it_goes_out_when_a_phone_appears(hass, crm, freezer):
    user, entry = crm
    freezer.move_to(BASE)
    made = await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)))
    await start_at(hass, freezer, entry)
    assert (await stored_reminder(hass, entry, made["id"])).notified_for is None
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    await tick(hass, freezer, BASE + MINUTE)
    assert len(sent) == 1
    assert (await stored_reminder(hass, entry, made["id"])).notified_for is not None


async def test_every_send_failing_keeps_it_unfired_and_logs_only_the_type(hass, crm, freezer, caplog):
    user, entry = crm
    MockConfigEntry(domain="mobile_app", data={"user_id": user.id, "device_name": "Bad Phone"}).add_to_hass(hass)

    async def broken(call: ServiceCall) -> None:
        from homeassistant.exceptions import HomeAssistantError

        raise HomeAssistantError("the secret note text")

    hass.services.async_register("notify", "mobile_app_bad_phone", broken)
    freezer.move_to(BASE)
    made = await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)), note="the secret note text")
    await start_at(hass, freezer, entry)
    assert (await stored_reminder(hass, entry, made["id"])).notified_for is None
    assert "HomeAssistantError" in caplog.text
    assert "the secret note text" not in caplog.text
    assert "Roy Example" not in caplog.text

    def failures() -> int:
        return sum("HomeAssistantError" in r.getMessage() for r in caplog.records)

    assert failures() == 1
    await tick(hass, freezer, BASE + MINUTE)  # retried, but not logged again within the hour
    assert failures() == 1
    await tick(hass, freezer, BASE + timedelta(hours=1, minutes=1))
    assert failures() == 2


async def test_some_devices_failing_still_counts_as_sent(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Good Phone", sent)
    MockConfigEntry(domain="mobile_app", data={"user_id": user.id, "device_name": "Bad Phone"}).add_to_hass(hass)

    async def broken(call: ServiceCall) -> None:
        from homeassistant.exceptions import HomeAssistantError

        raise HomeAssistantError("down")

    hass.services.async_register("notify", "mobile_app_bad_phone", broken)
    freezer.move_to(BASE)
    made = await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)))
    await start_at(hass, freezer, entry)
    assert len(sent) == 1
    assert (await stored_reminder(hass, entry, made["id"])).notified_for is not None
    await tick(hass, freezer, BASE + MINUTE)
    assert len(sent) == 1


async def test_switch_off_marks_as_notified_without_sending_and_switching_on_does_not_release_them(
    hass, crm, freezer
):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    await hass.async_add_executor_job(
        service.set_notification_settings, {"reminders": {"enabled": False}}, "panel"
    )
    freezer.move_to(BASE)
    due = BASE - timedelta(hours=1)
    made = await make_reminder(hass, entry, due_at=iso(due))
    await start_at(hass, freezer, entry)
    assert sent == []
    assert (await stored_reminder(hass, entry, made["id"])).notified_for == due

    await hass.async_add_executor_job(
        service.set_notification_settings, {"reminders": {"enabled": True}}, "panel"
    )
    await tick(hass, freezer, BASE + MINUTE)
    assert sent == []  # the old one is not released
    await make_reminder(hass, entry, due_at=iso(BASE + 2 * MINUTE))
    await tick(hass, freezer, BASE + 3 * MINUTE)
    assert len(sent) == 1  # new ones still go out


async def test_someday_never_fires(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    freezer.move_to(BASE)
    made = await make_reminder(hass, entry, note="Whenever")
    await start_at(hass, freezer, entry)
    await tick(hass, freezer, BASE + timedelta(days=30))
    assert sent == []
    assert (await stored_reminder(hass, entry, made["id"])).notified_for is None


async def test_editing_the_due_time_after_it_fired_fires_again_at_the_new_time(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    freezer.move_to(BASE)
    made = await make_reminder(hass, entry, due_at=iso(BASE + MINUTE))
    await start_at(hass, freezer, entry)
    await tick(hass, freezer, BASE + 2 * MINUTE)
    assert len(sent) == 1
    new_due = BASE + timedelta(hours=2)
    await hass.async_add_executor_job(
        entry.runtime_data.service.update, "reminder", made["id"], {"due_at": iso(new_due)}, "panel"
    )
    await tick(hass, freezer, BASE + timedelta(hours=1))
    assert len(sent) == 1
    await tick(hass, freezer, new_due + MINUTE)
    assert len(sent) == 2


async def test_a_repeat_rule_change_after_completions_fires_at_the_shown_due_date(hass, crm, freezer):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    freezer.move_to(BASE)
    first = BASE + timedelta(hours=1)  # 15 Jun
    made = await make_reminder(hass, entry, due_at=iso(first), repeat_every=1, repeat_unit="month")
    await start_at(hass, freezer, entry)
    await tick(hass, freezer, first + MINUTE)
    assert len(sent) == 1
    await hass.async_add_executor_job(service.complete_reminder, made["id"], "panel")  # 15 Jul
    await hass.async_add_executor_job(service.complete_reminder, made["id"], "panel")  # 15 Aug
    await hass.async_add_executor_job(
        service.update, "reminder", made["id"], {"repeat_unit": "week"}, "panel"
    )
    shown = (await stored_reminder(hass, entry, made["id"])).due_at
    assert shown == datetime(2026, 8, 15, 13, 0, tzinfo=UTC)
    await tick(hass, freezer, shown - MINUTE)
    assert len(sent) == 1
    await tick(hass, freezer, shown + MINUTE)  # the old 15 Jun weekly grid would wait to 17 Aug
    assert len(sent) == 2
    await tick(hass, freezer, shown + 2 * MINUTE)
    assert len(sent) == 2


async def test_other_users_reminders_go_only_to_their_own_phones(
    hass, crm, freezer, add_crm, hass_read_only_user
):
    user, entry = crm
    other_entry = await add_crm(hass_read_only_user)
    mine: list[ServiceCall] = []
    theirs: list[ServiceCall] = []
    add_phone(hass, user.id, "My Phone", mine)
    add_phone(hass, hass_read_only_user.id, "Their Phone", theirs)
    freezer.move_to(BASE)
    await make_reminder(hass, other_entry, due_at=iso(BASE - timedelta(hours=1)))
    await start_at(hass, freezer, entry)
    await start_at(hass, freezer, other_entry)
    assert mine == []
    assert len(theirs) == 1


async def test_stopping_waits_for_a_check_that_is_mid_send_and_nothing_runs_after(hass, crm, freezer):
    user, entry = crm
    started = asyncio.Event()
    release = asyncio.Event()
    sent: list[ServiceCall] = []
    MockConfigEntry(domain="mobile_app", data={"user_id": user.id, "device_name": "Slow Phone"}).add_to_hass(hass)

    async def slow(call: ServiceCall) -> None:
        started.set()
        await release.wait()
        sent.append(call)

    hass.services.async_register("notify", "mobile_app_slow_phone", slow)
    freezer.move_to(BASE)
    await make_reminder(hass, entry, due_at=iso(BASE + MINUTE))
    runtime = entry.runtime_data
    calls: list[str] = []
    real_read, real_mark = runtime.service.read_data, runtime.service.mark_reminder_notified
    runtime.service.read_data = lambda: (calls.append("read"), real_read())[1]
    runtime.service.mark_reminder_notified = lambda *a: (calls.append("mark"), real_mark(*a))[1]

    await runtime.notifications.async_start()
    freezer.move_to(BASE + 2 * MINUTE)
    async_fire_time_changed(hass, BASE + 2 * MINUTE)  # an interval check gets stuck in the send
    await asyncio.wait_for(started.wait(), 5)
    stopping = hass.async_create_task(runtime.notifications.stop())
    await asyncio.sleep(0)
    assert not stopping.done()  # waits for the running check
    release.set()
    await asyncio.wait_for(stopping, 5)
    after = list(calls)
    await tick(hass, freezer, BASE + 10 * MINUTE)
    await runtime.notifications._check_reminders()
    assert calls == after  # nothing reads or writes once stop has returned


async def test_a_mark_refused_during_a_backup_is_not_resent_and_is_marked_after_it(hass, crm, freezer):
    from custom_components.hearth_crm.db import BackupInProgress

    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    freezer.move_to(BASE)
    blocked = await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)), note="Blocked")
    other = await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)), note="Other")
    backup = {"on": True}
    real_mark = service.mark_reminder_notified

    def mark(reminder_id, occurrence):
        if backup["on"] and reminder_id == blocked["id"]:
            raise BackupInProgress
        return real_mark(reminder_id, occurrence)

    service.mark_reminder_notified = mark
    await start_at(hass, freezer, entry)
    assert sorted(c.data["message"] for c in sent) == ["Blocked", "Other"]
    assert (await stored_reminder(hass, entry, blocked["id"])).notified_for is None
    assert (await stored_reminder(hass, entry, other["id"])).notified_for is not None

    await tick(hass, freezer, BASE + MINUTE)  # still backing up: the mark is retried, not the send
    await tick(hass, freezer, BASE + 2 * MINUTE)
    assert len(sent) == 2
    assert (await stored_reminder(hass, entry, blocked["id"])).notified_for is None

    backup["on"] = False
    await tick(hass, freezer, BASE + 3 * MINUTE)
    assert len(sent) == 2
    assert (await stored_reminder(hass, entry, blocked["id"])).notified_for == BASE - timedelta(hours=1)
    assert entry.runtime_data.notifications._unmarked == {}
    await tick(hass, freezer, BASE + 4 * MINUTE)
    assert len(sent) == 2


async def test_an_unmarked_send_is_forgotten_when_its_reminder_goes(hass, crm, freezer):
    from custom_components.hearth_crm.db import BackupInProgress

    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    freezer.move_to(BASE)
    made = await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)))

    def refuse(reminder_id, occurrence):
        raise BackupInProgress

    service.mark_reminder_notified = refuse
    await start_at(hass, freezer, entry)
    runtime = entry.runtime_data.notifications
    assert set(runtime._unmarked) == {made["id"]}
    await hass.async_add_executor_job(service.delete, "reminder", made["id"], "panel")
    await tick(hass, freezer, BASE + MINUTE)
    assert runtime._unmarked == {}
    assert len(sent) == 1


async def test_one_reminder_failing_unexpectedly_does_not_stop_the_others(hass, crm, freezer, caplog):
    user, entry = crm
    sent: list[ServiceCall] = []
    MockConfigEntry(domain="mobile_app", data={"user_id": user.id, "device_name": "Test Phone"}).add_to_hass(hass)
    broken = {"on": True}

    async def handler(call: ServiceCall) -> None:
        if broken["on"] and call.data["message"] == "the secret note text":
            raise RuntimeError("the secret note text")
        sent.append(call)

    hass.services.async_register("notify", "mobile_app_test_phone", handler)
    freezer.move_to(BASE)
    notes = ["First", "the secret note text", "Third", "Fourth", "Fifth"]
    made = [
        await make_reminder(hass, entry, due_at=iso(BASE - timedelta(minutes=10 - i)), note=note)
        for i, note in enumerate(notes)
    ]
    await start_at(hass, freezer, entry)
    assert sorted(c.data["message"] for c in sent) == ["Fifth", "First", "Fourth", "Third"]
    assert (await stored_reminder(hass, entry, made[1]["id"])).notified_for is None
    for good in (made[0], *made[2:]):
        assert (await stored_reminder(hass, entry, good["id"])).notified_for is not None

    def failures() -> int:
        return sum("RuntimeError" in r.getMessage() for r in caplog.records)

    assert failures() == 1
    assert "the secret note text" not in caplog.text
    assert "Roy Example" not in caplog.text

    await tick(hass, freezer, BASE + MINUTE)  # retried, not logged again within the hour
    assert len(sent) == 4 and failures() == 1

    broken["on"] = False  # the interval timer is still running and picks it up
    await tick(hass, freezer, BASE + 2 * MINUTE)
    assert len(sent) == 5
    assert (await stored_reminder(hass, entry, made[1]["id"])).notified_for is not None


async def test_a_check_that_fails_outright_is_logged_by_type_and_the_timer_keeps_going(
    hass, crm, freezer, caplog
):
    user, entry = crm
    sent: list[ServiceCall] = []
    add_phone(hass, user.id, "Test Phone", sent)
    service = entry.runtime_data.service
    freezer.move_to(BASE)
    await make_reminder(hass, entry, due_at=iso(BASE - timedelta(hours=1)), note="the secret note text")
    real_read = service.read_data
    failing = {"on": True}

    def read():
        if failing["on"]:
            raise RuntimeError("the secret note text")
        return real_read()

    service.read_data = read
    await start_at(hass, freezer, entry)
    assert sent == []
    assert "RuntimeError" in caplog.text and "the secret note text" not in caplog.text
    failing["on"] = False
    await tick(hass, freezer, BASE + MINUTE)
    assert len(sent) == 1
