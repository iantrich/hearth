"""Claude's read tools, driven through the real API instance (invented people only)."""

from __future__ import annotations

from datetime import timedelta

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
    """Robin's CRM: a family, friends, a group and interactions. Returns (user, ids, service)."""
    user = await hass.auth.async_create_user("Robin Example", group_ids=[GROUP_ID_USER])
    entry = await add_crm(user)
    service = entry.runtime_data.service
    today = dt_util.now().date()

    def create(kind, fields):
        return service.create(kind, fields, "panel")["id"]

    def build():
        ids = {}
        ids["phil"] = create("person", {"name": "Phil Parent", "how_i_know_them": "College roommate",
                                        "relationship_summary": "Dependable"})
        ids["josie"] = create("person", {"name": "Josie Parent", "birthday": "2015-01-01"})
        ids["ada"] = create("person", {"name": "Ada Friend", "close_friend": True})
        ids["dee"] = create("person", {"name": "Dee Quiet", "close_friend": True})
        ids["bo"] = create("person", {"name": "Bo Near",
                                      "birthday": (today + timedelta(days=3)).replace(year=2000).isoformat()})
        ids["cy"] = create("person", {"name": "Cy Soon", "birthday": (today + timedelta(days=5)).replace(year=1990).isoformat()})
        ids["house"] = create("household", {"notes": "Corner lot"})
        for who in ("phil", "josie"):
            service.update("person", ids[who], {"household_id": ids["house"]}, "panel")
        # Phil's row says Josie is his Child; Josie is Phil's Parent from her side.
        ids["rel"] = create("relationship", {"person_a_id": ids["phil"], "person_b_id": ids["josie"], "type": "Child"})
        ids["club"] = create("contact_group", {"name": "Book Club", "description": "Reads",
                                               "member_ids": [ids["phil"], ids["ada"], ids["cy"]]})
        for n in range(7):
            ids[f"i{n}"] = create("interaction", {
                "summary": f"Coffee {n}", "date": (today - timedelta(days=10 - n)).isoformat(),
                "type": "Catch-up", "person_ids": [ids["phil"], ids["ada"]] if n == 6 else [ids["phil"]],
                "notes": "Talked about trails" if n == 6 else None,
            })
        return ids

    ids = await hass.async_add_executor_job(build)
    return user, ids, service


async def test_search_people_caps_results_and_says_it_truncated(hass, crm):
    user, ids, service = crm

    def many():
        for n in range(30):
            service.create("person", {"name": f"Sam Crowd{n:02d}"}, "panel")

    await hass.async_add_executor_job(many)
    result = await run(hass, user, "search_people", query="", limit=10)
    assert result["total"] == 36 and result["returned"] == 10 and result["truncated"] is True
    assert len(result["people"]) == 10
    near = await run(hass, user, "search_people", query="near")
    assert [p["name"] for p in near["people"]] == ["Bo Near"]
    narrowed = await run(hass, user, "search_people", group="book", how_i_know_them="roommate")
    assert [p["id"] for p in narrowed["people"]] == [ids["phil"]]
    with pytest.raises(ToolError):
        await run(hass, user, "search_people", limit=101)


async def test_get_person_reads_relationships_from_this_persons_side(hass, crm):
    user, ids, _ = crm
    phil = await run(hass, user, "get_person", person_id=ids["phil"])
    josie = await run(hass, user, "get_person", person_id=ids["josie"])
    (phil_rel,) = phil["relationships"]
    (josie_rel,) = josie["relationships"]
    # Josie is Phil's Child; Phil is Josie's Parent.
    assert (phil_rel["other"]["id"], phil_rel["type"]) == (ids["josie"], "Child")
    assert (josie_rel["other"]["id"], josie_rel["type"]) == (ids["phil"], "Parent")
    assert phil_rel["relationship_id"] == josie_rel["relationship_id"] == ids["rel"]
    assert phil_rel["label"] == josie_rel["label"] == "Phil Parent → Josie Parent"
    assert phil_rel["other"]["household_name"] == "Phil Parent Family"
    assert phil_rel["notes"] is None  # carried, so a notes edit can read the text first


async def test_get_person_me_resolves_the_me_person_and_errors_when_unset(hass, crm):
    user, ids, service = crm
    with pytest.raises(ToolError, match='no "me" person'):
        await run(hass, user, "get_person", person_id="me")
    await hass.async_add_executor_job(
        lambda: service.set_settings({"me_person_id": ids["ada"]}, "panel")
    )
    result = await run(hass, user, "get_person", person_id="me")
    assert result["id"] == ids["ada"] and result["name"] == "Ada Friend"


async def test_get_person_includes_household_and_recent_interactions(hass, crm):
    user, ids, _ = crm
    result = await run(hass, user, "get_person", person_id=ids["phil"])
    assert result["household"]["id"] == ids["house"]
    assert result["household"]["name"] == result["household_name"] == "Phil Parent Family"
    assert result["household"]["name_status"]
    assert [m["id"] for m in result["household"]["members"]] == [ids["josie"], ids["phil"]]
    assert result["groups"] == [{"id": ids["club"], "name": "Book Club"}]
    assert result["contact_status"]["urgency"] and "age" in result and "days_until_birthday" in result
    for hidden in ("photo_hash", "google_contact_id", "google_synced_at", "google_photo_hash", "google_sync_error"):
        assert hidden not in result
    recent = result["recent_interactions"]
    assert [i["summary"] for i in recent] == [f"Coffee {n}" for n in (6, 5, 4, 3, 2)]
    assert recent[0]["notes"] == "Talked about trails"
    assert recent[0]["people"] == [
        {"id": ids["ada"], "name": "Ada Friend"},
        {"id": ids["phil"], "name": "Phil Parent"},
    ]
    assert recent[0]["people_count"] == 2
    two = await run(hass, user, "get_person", person_id=ids["phil"], interaction_limit=2)
    assert len(two["recent_interactions"]) == 2
    assert (await run(hass, user, "get_person", person_id=ids["cy"]))["household"] is None


async def test_get_household_and_group_include_member_briefs(hass, crm):
    user, ids, _ = crm
    house = await run(hass, user, "get_household", household_id=ids["house"])
    assert house["notes"] == "Corner lot" and house["name"] == "Phil Parent Family" and house["name_status"]
    assert [m["name"] for m in house["members"]] == ["Josie Parent", "Phil Parent"]
    assert all(m["household_name"] == "Phil Parent Family" for m in house["members"])
    group = await run(hass, user, "get_group", group_id=ids["club"])
    assert group["name"] == "Book Club" and group["description"] == "Reads"
    assert [m["name"] for m in group["members"]] == ["Ada Friend", "Cy Soon", "Phil Parent"]
    capped = await run(hass, user, "get_group", group_id=ids["club"], limit=2)
    assert (capped["total"], capped["returned"], capped["truncated"]) == (3, 2, True)


async def test_list_groups_finds_groups_by_name_with_member_counts(hass, crm):
    user, ids, service = crm

    def more():
        ids["choir"] = service.create("contact_group", {"name": "Église Choir"}, "panel")["id"]
        ids["team"] = service.create("contact_group", {"name": "Trail Team", "member_ids": [ids["ada"]]}, "panel")["id"]

    await hass.async_add_executor_job(more)
    everyone = await run(hass, user, "list_groups")
    assert [g["name"] for g in everyone["groups"]] == ["Book Club", "Église Choir", "Trail Team"]
    assert (everyone["total"], everyone["returned"], everyone["truncated"]) == (3, 3, False)
    assert everyone["groups"][0] == {"id": ids["club"], "name": "Book Club", "description": "Reads",
                                     "member_count": 3}
    # Accents and case are ignored, and an empty group is found.
    folded = await run(hass, user, "list_groups", query="EGLISE")
    assert [(g["id"], g["member_count"]) for g in folded["groups"]] == [(ids["choir"], 0)]
    assert (await run(hass, user, "list_groups", query=None))["total"] == 3
    assert (await run(hass, user, "list_groups", query="nothing like it"))["groups"] == []


async def test_list_groups_caps_results_and_says_it_truncated(hass, crm):
    user, _, service = crm

    def many():
        for n in range(30):
            service.create("contact_group", {"name": f"Circle {n:02d}"}, "panel")

    await hass.async_add_executor_job(many)
    result = await run(hass, user, "list_groups", query="circle", limit=10)
    assert (result["total"], result["returned"], result["truncated"]) == (30, 10, True)
    assert [g["name"] for g in result["groups"]] == [f"Circle {n:02d}" for n in range(10)]
    with pytest.raises(ToolError):
        await run(hass, user, "list_groups", limit=101)


async def test_who_to_reach_out_to_matches_the_panel_urgency(hass, crm):
    user, ids, service = crm
    result = await run(hass, user, "who_to_reach_out_to")
    snapshot = await hass.async_add_executor_job(service.snapshot)
    dee = next(p for p in snapshot["people"] if p["id"] == ids["dee"])
    assert dee["contact_status"]["urgency"] == "overdue"  # a close friend never contacted
    # Ada was contacted days ago and everyone else is not a close friend, so only Dee is listed.
    assert [p["id"] for p in result["overdue"]] == [ids["dee"]] and result["due_soon"] == []
    assert result["overdue"][0]["urgency"] == "overdue"
    assert result["total"] == 1 and result["truncated"] is False


async def test_upcoming_birthdays_respects_the_window(hass, crm):
    user, ids, _ = crm
    result = await run(hass, user, "upcoming_birthdays", within_days=30)
    assert [b["person"]["id"] for b in result["birthdays"]] == [ids["bo"], ids["cy"]]
    assert [b["days_until"] for b in result["birthdays"]] == [3, 5]
    narrow = await run(hass, user, "upcoming_birthdays", within_days=4)
    assert [b["person"]["id"] for b in narrow["birthdays"]] == [ids["bo"]]
    with pytest.raises(ToolError):
        await run(hass, user, "upcoming_birthdays", within_days=367)


@pytest.mark.parametrize(
    ("tool", "args", "kind"),
    [
        ("get_person", {"person_id": "nope"}, "person"),
        ("get_household", {"household_id": "nope"}, "household"),
        ("get_group", {"group_id": "nope"}, "group"),
    ],
)
async def test_unknown_ids_give_plain_errors(hass, crm, tool, args, kind):
    user, _, _ = crm
    with pytest.raises(ToolError, match=f"There is no {kind} with that id"):
        await run(hass, user, tool, **args)


async def test_get_person_interaction_attendees_are_light_and_bounded(hass, crm):
    user, ids, service = crm

    def party():
        crowd = [service.create("person", {"name": f"Guest {n:02d}"}, "panel")["id"] for n in range(40)]
        for n in range(3):
            service.create("interaction", {
                "summary": f"Party {n}", "date": "2099-01-01", "type": "Catch-up",
                "person_ids": [ids["phil"], *crowd],
            }, "panel")

    await hass.async_add_executor_job(party)
    result = await run(hass, user, "get_person", person_id=ids["phil"], interaction_limit=3)
    for interaction in result["recent_interactions"]:
        assert interaction["people_count"] == 41
        assert all(set(p) == {"id", "name"} for p in interaction["people"])
    assert len(str(result)) < 20000


async def test_get_person_with_a_dangling_household_has_no_household(hass, crm):
    user, ids, service = crm
    await hass.async_add_executor_job(lambda: service.snapshot())
    real = service.snapshot

    def dangling():
        snap = real()
        snap["households"] = []
        return snap

    service.snapshot = dangling
    result = await run(hass, user, "get_person", person_id=ids["phil"])
    assert result["household"] is None


@pytest.mark.parametrize("bad", [0, 26])
async def test_get_person_rejects_out_of_range_interaction_limit(hass, crm, bad):
    user, ids, _ = crm
    with pytest.raises(ToolError, match="interaction_limit"):
        await run(hass, user, "get_person", person_id=ids["phil"], interaction_limit=bad)
