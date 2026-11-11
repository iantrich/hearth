"""Claude's reminder tools, driven through the real API instance (invented people only)."""

from __future__ import annotations

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.core import Context
from homeassistant.helpers import llm
from homeassistant.util import dt as dt_util

from custom_components.hearth_crm.const import LLM_API_ID, TOOL_PREFIX
from custom_components.hearth_crm.llm_base import ToolError


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


def context_for(user_id):
    return llm.LLMContext(
        platform="test", context=Context(user_id=user_id), language="en",
        assistant="conversation", device_id=None,
    )


async def run(hass, user, tool, **args):
    api = await llm.async_get_api(hass, LLM_API_ID, context_for(user.id))
    result = await api.async_call_tool(llm.ToolInput(tool_name=f"{TOOL_PREFIX}{tool}", tool_args=args))
    return result.data


@pytest.fixture
async def crm(hass, add_crm):
    """Robin's CRM with two people. Returns (user, ids, service)."""
    user = await hass.auth.async_create_user("Robin Example", group_ids=[GROUP_ID_USER])
    entry = await add_crm(user)
    service = entry.runtime_data.service

    def build():
        return {
            "alex": service.create("person", {"name": "Alex Example"}, "panel")["id"],
            "sam": service.create("person", {"name": "Sam Sample"}, "panel")["id"],
        }

    return user, await hass.async_add_executor_job(build), service


async def test_create_reminder_date_only_means_eight_am(hass, crm):
    user, ids, _ = crm
    out = await run(hass, user, "create_reminder", person_id=ids["alex"], note="Follow up", due="2030-03-04")
    assert out["reminder"]["due_date"] == "2030-03-04"
    assert out["reminder"]["due_time"] == "08:00"
    assert out["reminder"]["state"] == "upcoming"
    assert out["person"]["id"] == ids["alex"]
    assert out["person"]["name"] == "Alex Example"


async def test_create_reminder_without_a_due_is_someday(hass, crm):
    user, ids, _ = crm
    out = await run(hass, user, "create_reminder", person_id=ids["alex"])
    assert out["reminder"]["state"] == "someday"
    assert out["reminder"]["due_date"] is None


async def test_create_reminder_with_time_and_repeat(hass, crm):
    user, ids, _ = crm
    out = await run(
        hass, user, "create_reminder", person_id=ids["alex"], due="2030-03-04T17:30",
        repeat_every=2, repeat_unit="week",
    )
    reminder = out["reminder"]
    assert (reminder["due_date"], reminder["due_time"]) == ("2030-03-04", "17:30")
    assert (reminder["repeat_every"], reminder["repeat_unit"]) == (2, "week")


async def test_create_without_a_person_is_refused_and_mentions_me_when_set(hass, crm):
    user, ids, service = crm
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_reminder", note="Renew passport")
    assert "needs a person" in str(err.value)
    assert "This is me" not in str(err.value)

    await hass.async_add_executor_job(
        lambda: service.set_settings({"me_person_id": ids["sam"]}, "panel")
    )
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_reminder", note="Renew passport")
    assert "needs a person" in str(err.value)
    assert "This is me" in str(err.value)
    assert ids["sam"] in str(err.value)
    assert await hass.async_add_executor_job(lambda: service.snapshot()["reminders"]) == []


async def test_create_with_an_unknown_person_is_a_tool_error(hass, crm):
    user, _, _ = crm
    with pytest.raises(ToolError, match="person"):
        await run(hass, user, "create_reminder", person_id="nobody", due="2030-03-04")


@pytest.mark.parametrize("due", ["tomorrow", "2030-13-01", "2030-03-04T25:00", "2030-03-04 08:00"])
async def test_a_bad_due_is_a_plain_error(hass, crm, due):
    user, ids, _ = crm
    with pytest.raises(ToolError, match="due"):
        await run(hass, user, "create_reminder", person_id=ids["alex"], due=due)


async def test_repeat_parts_must_come_together(hass, crm):
    user, ids, service = crm
    for extra in ({"repeat_every": 2}, {"repeat_unit": "week"}):
        with pytest.raises(ToolError, match="repeat_every and repeat_unit"):
            await run(hass, user, "create_reminder", person_id=ids["alex"], due="2030-03-04", **extra)
    with pytest.raises(ToolError, match="due date"):
        await run(hass, user, "create_reminder", person_id=ids["alex"], repeat_every=1, repeat_unit="day")
    assert await hass.async_add_executor_job(lambda: service.snapshot()["reminders"]) == []


async def test_list_reminders_default_hides_done_and_filters_by_person(hass, crm):
    user, ids, _ = crm
    await run(hass, user, "create_reminder", person_id=ids["alex"], note="Later", due="2030-05-01")
    await run(hass, user, "create_reminder", person_id=ids["alex"], note="Soon", due="2030-04-01")
    await run(hass, user, "create_reminder", person_id=ids["alex"], note="Maybe")
    await run(hass, user, "create_reminder", person_id=ids["sam"], note="Sam's", due="2030-04-15")
    finished = await run(hass, user, "create_reminder", person_id=ids["alex"], note="Done one", due="2030-04-02")
    await run(hass, user, "complete_reminder", reminder_id=finished["reminder"]["id"])

    everyone = await run(hass, user, "list_reminders")
    assert [r["note"] for r in everyone["reminders"]] == ["Soon", "Sam's", "Later", "Maybe"]
    assert all(r["state"] != "done" for r in everyone["reminders"])
    assert everyone["reminders"][0]["person"]["name"] == "Alex Example"

    alex = await run(hass, user, "list_reminders", person_id=ids["alex"])
    assert [r["note"] for r in alex["reminders"]] == ["Soon", "Later", "Maybe"]

    with_done = await run(hass, user, "list_reminders", person_id=ids["alex"], include_done=True)
    assert [r["note"] for r in with_done["reminders"]] == ["Soon", "Later", "Maybe", "Done one"]

    capped = await run(hass, user, "list_reminders", limit=2)
    assert len(capped["reminders"]) == 2 and capped["truncated"] is True


async def test_complete_reminder_moves_a_repeating_one_and_finishes_a_one_time_one(hass, crm):
    user, ids, _ = crm
    repeating = await run(
        hass, user, "create_reminder", person_id=ids["alex"], due="2020-01-01",
        repeat_every=1, repeat_unit="year",
    )
    moved = await run(hass, user, "complete_reminder", reminder_id=repeating["reminder"]["id"])
    assert moved["reminder"]["state"] in ("upcoming", "due_today")
    assert moved["reminder"]["due_date"] > dt_util.now().date().isoformat() or (
        moved["reminder"]["state"] == "due_today"
    )
    assert moved["reminder"]["due_date"][5:] == "01-01"
    assert moved["person"]["id"] == ids["alex"]

    once = await run(hass, user, "create_reminder", person_id=ids["alex"], due="2030-03-04")
    finished = await run(hass, user, "complete_reminder", reminder_id=once["reminder"]["id"])
    assert finished["reminder"]["state"] == "done"

    with pytest.raises(ToolError, match="already done"):
        await run(hass, user, "complete_reminder", reminder_id=once["reminder"]["id"])
    with pytest.raises(ToolError, match="reminder"):
        await run(hass, user, "complete_reminder", reminder_id="missing")


async def test_delete_reminder_returns_what_was_deleted(hass, crm):
    user, ids, service = crm
    made = await run(hass, user, "create_reminder", person_id=ids["alex"], note="Call", due="2030-03-04")
    out = await run(hass, user, "delete_reminder", reminder_id=made["reminder"]["id"])
    assert out["deleted"]["reminder"]["note"] == "Call"
    assert out["deleted"]["person"]["name"] == "Alex Example"
    assert await hass.async_add_executor_job(lambda: service.snapshot()["reminders"]) == []
    with pytest.raises(ToolError, match="reminder"):
        await run(hass, user, "delete_reminder", reminder_id=made["reminder"]["id"])


async def test_tools_only_touch_the_callers_own_crm(hass, crm, add_crm):
    user, ids, _ = crm
    other = await hass.auth.async_create_user("Bee Example", group_ids=[GROUP_ID_USER])
    await add_crm(other)
    made = await run(hass, user, "create_reminder", person_id=ids["alex"], note="Mine", due="2030-03-04")
    assert (await run(hass, other, "list_reminders"))["reminders"] == []
    with pytest.raises(ToolError, match="reminder"):
        await run(hass, other, "complete_reminder", reminder_id=made["reminder"]["id"])
    with pytest.raises(ToolError, match="reminder"):
        await run(hass, other, "delete_reminder", reminder_id=made["reminder"]["id"])
    with pytest.raises(ToolError, match="person"):
        await run(hass, other, "create_reminder", person_id=ids["alex"])
