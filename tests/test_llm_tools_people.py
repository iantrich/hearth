"""Claude's write tools for people, interactions and summaries (invented people only).

Every call goes through the real API instance, so the schema check, the caller's CRM lookup
and the error mapping are all exercised.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.core import Context
from homeassistant.helpers import llm
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.util import dt as dt_util

from custom_components.hearth_crm.const import LLM_API_ID, SIGNAL_CHANGED, TOOL_PREFIX
from custom_components.hearth_crm.llm_base import BACKUP, ToolError


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
    """Robin's CRM: a couple in a household, and a friend. Returns (user, ids, entry)."""
    user = await hass.auth.async_create_user("Robin Example", group_ids=[GROUP_ID_USER])
    entry = await add_crm(user)
    service = entry.runtime_data.service

    def build():
        ids = {}
        ids["cris"] = service.create("person", {
            "name": "Lorenzo Montana Ruiz", "how_i_know_them": "Climbing gym",
        }, "panel")["id"]
        ids["dana"] = service.create("person", {"name": "Dana Montana Ruiz"}, "panel")["id"]
        ids["house"] = service.create("household", {}, "panel")["id"]
        for who in ("cris", "dana"):
            service.update("person", ids[who], {"household_id": ids["house"]}, "panel")
        service.create("relationship", {
            "person_a_id": ids["cris"], "person_b_id": ids["dana"], "type": "Spouse",
        }, "panel")
        ids["wren"] = service.create("person", {
            "name": "Wren Friend", "relationship_summary": "We both like trail running.",
        }, "panel")["id"]
        return ids

    ids = await hass.async_add_executor_job(build)
    return user, ids, entry


async def people_named(hass, entry, name):
    snapshot = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    return [p for p in snapshot["people"] if p["name"] == name]


async def interactions_of(hass, entry):
    snapshot = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    return snapshot["interactions"]


async def test_create_person_refuses_a_near_duplicate_until_confirmed(hass, crm):
    user, ids, entry = crm
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_person", name="Lorenzo Mantana")
    message = str(err.value)
    assert message.startswith("Hearth already has people with similar names: ")
    assert f"Lorenzo Montana Ruiz (id {ids['cris']}, " in message
    assert message.endswith(
        "Ask the user whether this is one of them. "
        "If this really is a new person, call again with confirm_new=true."
    )
    assert await people_named(hass, entry, "Lorenzo Mantana") == []

    saved = await run(hass, user, "create_person", name="Lorenzo Mantana", confirm_new=True)
    assert saved["name"] == "Lorenzo Mantana"
    assert len(await people_named(hass, entry, "Lorenzo Mantana")) == 1


async def test_create_person_guard_names_household_and_how_i_know_them(hass, crm):
    user, ids, entry = crm
    snapshot = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    household = next(p for p in snapshot["people"] if p["id"] == ids["cris"])["household_name"]
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_person", name="Wren Frend")
    assert f"Wren Friend (id {ids['wren']}, no household, unknown)" in str(err.value)
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_person", name="Lorenzo Mantana")
    assert f"Lorenzo Montana Ruiz (id {ids['cris']}, {household}, Climbing gym)" in str(err.value)


async def test_create_person_guard_tells_an_unnamed_household_from_none(hass, crm):
    user, ids, entry = crm
    service = entry.runtime_data.service

    def lone_household():
        house = service.create("household", {}, "panel")["id"]
        service.update("person", ids["wren"], {"household_id": house}, "panel")

    await hass.async_add_executor_job(lone_household)
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_person", name="Wren Frend")
    assert f"Wren Friend (id {ids['wren']}, unnamed household, unknown)" in str(err.value)


async def test_create_person_hides_minors_with_a_known_year_only(hass, crm):
    user, _, _ = crm
    today = dt_util.now().date()
    kid = (today - timedelta(days=365 * 8)).isoformat()
    adult = (today - timedelta(days=365 * 30)).isoformat()
    minor = await run(hass, user, "create_person", name="Pip Youngster", birthday=kid)
    assert minor["hide_from_list"] is True and minor["hidden"] is True
    unknown = await run(hass, user, "create_person", name="Tam Noyear", birthday=kid[5:])
    assert unknown["hide_from_list"] is False
    grown = await run(hass, user, "create_person", name="Lou Grownup", birthday=adult)
    assert grown["hide_from_list"] is False
    shown = await run(hass, user, "create_person", name="Kit Shown", birthday=kid, hide_from_list=False)
    assert shown["hide_from_list"] is False
    hidden = await run(hass, user, "create_person", name="Bea Small", hide_from_list=True)
    assert hidden["hide_from_list"] is True


async def test_create_person_accepts_month_day_birthdays_as_year_unknown(hass, crm):
    user, _, entry = crm
    saved = await run(hass, user, "create_person", name="Leap Daybaby", birthday="02-29")
    assert saved["birthday"] == "2000-02-29" and saved["birth_year_unknown"] is True
    assert saved["age"] is None
    full = await run(hass, user, "create_person", name="Known Yearling", birthday="1990-07-04")
    assert full["birthday"] == "1990-07-04" and full["birth_year_unknown"] is False
    with pytest.raises(ToolError, match="Use YYYY-MM-DD, or MM-DD") as err:
        await run(hass, user, "create_person", name="Bad Dateperson", birthday="July 4")
    assert "Nothing was changed" in str(err.value)
    assert await people_named(hass, entry, "Bad Dateperson") == []


async def test_create_person_writes_address_as_free_text(hass, crm):
    user, _, _ = crm
    saved = await run(
        hass, user, "create_person", name="Addie Placed", address="12 Elm St, Springfield",
        school="Springfield High", phone="555-0100", how_i_know_them="Book club",
        close_friend=True, favorite=True,
    )
    assert saved["address"]["formatted"] == "12 Elm St, Springfield"
    assert saved["school"]["formatted"] == "Springfield High"
    assert saved["phone"] == "555-0100" and saved["how_i_know_them"] == "Book club"
    assert saved["close_friend"] is True and saved["favorite"] is True
    assert "household_name" in saved and saved["household_name"] is None
    for hidden in ("photo_hash", "google_contact_id", "google_synced_at", "google_photo_hash", "google_sync_error"):
        assert hidden not in saved


async def test_person_tools_take_no_google_or_photo_fields(hass, crm):
    user, ids, _ = crm
    with pytest.raises(ToolError, match="google_contact_id"):
        await run(hass, user, "create_person", name="Gee Sync", google_contact_id="x", confirm_new=True)
    with pytest.raises(ToolError, match="photo_hash"):
        await run(hass, user, "update_person", person_id=ids["wren"], photo_hash="abc")


async def test_update_person_renames_and_the_household_name_follows(hass, crm):
    user, ids, _ = crm
    before = await run(hass, user, "update_person", person_id=ids["cris"], occupation="Engineer")
    assert before["occupation"] == "Engineer" and before["how_i_know_them"] == "Climbing gym"
    renamed = await run(hass, user, "update_person", person_id=ids["cris"], name="Lorenzo Montana")
    assert renamed["name"] == "Lorenzo Montana"
    assert renamed["household_name"] != before["household_name"]
    assert renamed["household_name"] and renamed["occupation"] == "Engineer"  # only passed fields change
    with pytest.raises(ToolError) as err:
        await run(hass, user, "update_person", person_id="no-such-id", name="Ghost")
    assert str(err.value) == "There is no person with that id. It may have been deleted. Search again."


async def test_update_person_empty_string_clears_a_field(hass, crm):
    user, ids, _ = crm
    set_ = await run(
        hass, user, "update_person", person_id=ids["wren"], email="wren@example.com",
        birthday="03-14", address="1 Oak Rd",
    )
    assert set_["email"] == "wren@example.com" and set_["birth_year_unknown"] is True
    cleared = await run(
        hass, user, "update_person", person_id=ids["wren"], email="", birthday="", address="",
    )
    assert cleared["email"] is None and cleared["address"] is None
    assert cleared["birthday"] is None and cleared["birth_year_unknown"] is False
    with pytest.raises(ToolError, match="Nothing to change"):
        await run(hass, user, "update_person", person_id=ids["wren"])
    with pytest.raises(ToolError, match="^name: must not be blank"):
        await run(hass, user, "update_person", person_id=ids["wren"], name="")


async def test_log_interaction_returns_current_summaries_and_the_next_step(hass, crm):
    user, ids, entry = crm
    result = await run(
        hass, user, "log_interaction", person_ids=[ids["wren"], ids["cris"]],
        summary="Trail run", type="Trip", date="2026-10-01", notes="Ran the ridge loop together.",
    )
    assert result["summary"] == "Trail run" and result["type"] == "Trip"
    assert result["date"] == "2026-10-01" and result["notes"] == "Ran the ridge loop together."
    assert sorted(result["person_ids"]) == sorted([ids["wren"], ids["cris"]])
    people = {p["id"]: p for p in result["people"]}
    assert set(people) == {ids["wren"], ids["cris"]}
    wren = people[ids["wren"]]
    assert set(wren) == {"id", "name", "household_name", "relationship_summary", "summary_updated", "contact_status"}
    assert wren["relationship_summary"] == "We both like trail running."
    assert wren["contact_status"]["last_contacted"] == "2026-10-01"
    assert people[ids["cris"]]["household_name"]
    assert result["next_step"] == (
        "Rewrite each person's relationship summary with set_relationship_summary, "
        "folding in only what this interaction covered."
    )
    (saved,) = await interactions_of(hass, entry)
    assert saved["notes"] == "Ran the ridge loop together."


async def test_log_interaction_defaults_to_today_and_catch_up(hass, crm):
    user, ids, _ = crm
    result = await run(hass, user, "log_interaction", person_ids=[ids["wren"]], summary="Coffee")
    assert result["date"] == dt_util.now().date().isoformat()
    assert result["type"] == "Catch-up" and result["notes"] is None
    with pytest.raises(ToolError, match="^type: "):
        await run(hass, user, "log_interaction", person_ids=[ids["wren"]], summary="X", type="Party")


async def test_log_interaction_needs_at_least_one_person(hass, crm):
    user, ids, entry = crm
    with pytest.raises(ToolError, match="^person_ids: "):
        await run(hass, user, "log_interaction", person_ids=[], summary="Nobody")
    with pytest.raises(ToolError, match="^person_ids: person 'ghost' does not exist"):
        await run(hass, user, "log_interaction", person_ids=["ghost"], summary="Nobody")
    assert await interactions_of(hass, entry) == []


async def test_update_and_delete_interaction(hass, crm):
    user, ids, entry = crm
    logged = await run(
        hass, user, "log_interaction", person_ids=[ids["wren"]], summary="Coffee", notes="Talked shop",
    )
    updated = await run(
        hass, user, "update_interaction", interaction_id=logged["id"], summary="Long coffee",
        type="Milestone", date="2026-09-30", notes="",
    )
    assert updated["summary"] == "Long coffee" and updated["type"] == "Milestone"
    assert updated["date"] == "2026-09-30" and updated["notes"] is None
    assert updated["people"] == [{"id": ids["wren"], "name": "Wren Friend", "household_name": None}]
    with pytest.raises(ToolError, match="Nothing to change"):
        await run(hass, user, "update_interaction", interaction_id=logged["id"])

    removed = await run(hass, user, "delete_interaction", interaction_id=logged["id"])
    assert removed["deleted"]["id"] == logged["id"]
    assert removed["deleted"]["summary"] == "Long coffee" and removed["deleted"]["date"] == "2026-09-30"
    assert removed["deleted"]["people"] == [{"id": ids["wren"], "name": "Wren Friend", "household_name": None}]
    assert await interactions_of(hass, entry) == []
    with pytest.raises(ToolError) as err:
        await run(hass, user, "delete_interaction", interaction_id=logged["id"])
    assert str(err.value) == "There is no interaction with that id. It may have been deleted. Search again."
    with pytest.raises(ToolError, match="There is no interaction with that id"):
        await run(hass, user, "update_interaction", interaction_id=logged["id"], summary="Gone")


async def test_set_relationship_summary_stamps_the_date(hass, crm):
    user, ids, _ = crm
    result = await run(
        hass, user, "set_relationship_summary", person_id=ids["cris"],
        summary="Lorenzo and I both climb, and we swap book recommendations.",
    )
    assert result["relationship_summary"] == "Lorenzo and I both climb, and we swap book recommendations."
    assert result["summary_updated"] == dt_util.now().date().isoformat()
    assert result["household_name"] and result["id"] == ids["cris"]


async def test_writes_are_logged_as_claude_and_notify_listeners(hass, crm):
    user, ids, entry = crm
    seen = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(entry.entry_id), seen.append)
    created = await run(hass, user, "create_person", name="Nova Newperson")
    await run(hass, user, "update_person", person_id=created["id"], notes="Met at the market")
    logged = await run(hass, user, "log_interaction", person_ids=[created["id"]], summary="Hello")
    await run(hass, user, "update_interaction", interaction_id=logged["id"], summary="Hi")
    await run(hass, user, "set_relationship_summary", person_id=created["id"], summary="Neighbors.")
    await run(hass, user, "delete_interaction", interaction_id=logged["id"])
    await hass.async_block_till_done()
    assert [(n["source"], n["entity"], n["entity_id"], n["action"]) for n in seen] == [
        ("claude", "person", created["id"], "create"),
        ("claude", "person", created["id"], "update"),
        ("claude", "interaction", logged["id"], "create"),
        ("claude", "interaction", logged["id"], "update"),
        ("claude", "person", created["id"], "update"),
        ("claude", "interaction", logged["id"], "delete"),
    ]
    changes = await hass.async_add_executor_job(entry.runtime_data.repo.changes, 6)
    assert {c.source for c in changes} == {"claude"}


@pytest.mark.parametrize(
    ("tool", "args"),
    [
        ("create_person", {"name": "Bax Blocked", "confirm_new": True}),
        ("set_relationship_summary", {"person_id": "wren", "summary": "Changed."}),
        ("log_interaction", {"person_ids": ["wren"], "summary": "Blocked"}),
    ],
)
async def test_backup_in_progress_refuses_a_write_politely(hass, crm, tool, args):
    user, ids, entry = crm
    # "wren" in the parameters stands for Wren's id.
    args = {
        k: [ids[i] for i in v] if isinstance(v, list) else ids["wren"] if v == "wren" else v
        for k, v in args.items()
    }
    repo = entry.runtime_data.repo
    before = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    repo.write_timeout = 0.05
    await hass.async_add_executor_job(repo.begin_backup)
    try:
        with pytest.raises(ToolError) as err:
            await run(hass, user, tool, **args)
    finally:
        repo.end_backup()
    assert str(err.value) == BACKUP
    after = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    assert after["people"] == before["people"] and after["interactions"] == before["interactions"]
