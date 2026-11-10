"""Claude's write tools for relationships, households and groups (invented people only).

Every call goes through the real API instance, so the schema check, the caller's CRM lookup
and the error mapping are all exercised.
"""

from __future__ import annotations

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.core import Context
from homeassistant.helpers import llm
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from custom_components.hearth_crm.const import LLM_API_ID, SIGNAL_CHANGED, TOOL_PREFIX
from custom_components.hearth_crm.llm_base import BACKUP, ToolError

NEEDS_NAME = "Ask the user to name this household"
NOT_A_HOUSEHOLD = "Only one adult and no children remain. Tell the user; do not delete it"


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
    """Robin's CRM: Phil and Mae, a married couple in a household; Phil's daughter Josie, with
    no household yet; Lena and Omar, a married couple with none; and a friend, Wren.
    Returns (user, ids, entry)."""
    user = await hass.auth.async_create_user("Robin Example", group_ids=[GROUP_ID_USER])
    entry = await add_crm(user)
    service = entry.runtime_data.service

    def build():
        ids = {}
        for key, name in (
            ("phil", "Phil Example"), ("mae", "Mae Example"), ("josie", "Josie Example"),
            ("lena", "Lena Sample"), ("omar", "Omar Sample"), ("wren", "Wren Friend"),
        ):
            ids[key] = service.create("person", {"name": name}, "panel")["id"]
        ids["house"] = service.create("household", {}, "panel")["id"]
        for who in ("phil", "mae"):
            service.update("person", ids[who], {"household_id": ids["house"]}, "panel")
        for a, b in (("phil", "mae"), ("lena", "omar")):
            service.create(
                "relationship", {"person_a_id": ids[a], "person_b_id": ids[b], "type": "Spouse"},
                "panel",
            )
        return ids

    ids = await hass.async_add_executor_job(build)
    return user, ids, entry


async def snapshot_of(hass, entry):
    return await hass.async_add_executor_job(entry.runtime_data.service.snapshot)


def links_between(snapshot, x, y):
    return [r for r in snapshot["relationships"] if {r["person_a_id"], r["person_b_id"]} == {x, y}]


def record_updates(monkeypatch, entry):
    """Record every ``service.update`` call as (kind, id, changes), still doing the update."""
    service = entry.runtime_data.service
    calls = []
    real = service.update

    def update(kind, entity_id, changes, source):
        calls.append((kind, entity_id, dict(changes)))
        return real(kind, entity_id, changes, source)

    monkeypatch.setattr(service, "update", update)
    return calls


# -- relationships -----------------------------------------------------------------------


async def test_add_relationship_stores_the_other_person_as_the_type_of_person_id(hass, crm):
    user, ids, entry = crm
    result = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    rows = links_between(await snapshot_of(hass, entry), ids["phil"], ids["josie"])
    assert [(r["person_a_id"], r["person_b_id"], r["type"]) for r in rows] == [
        (ids["phil"], ids["josie"], "Child")
    ]
    assert result["relationship_id"] == rows[0]["id"]
    assert result["label"] == rows[0]["label"] == "Phil Example → Josie Example"
    assert result["person"]["id"] == ids["phil"] and result["other"]["id"] == ids["josie"]
    assert result["type"] == "Child" and result["already_existed"] is False

    josie = await run(hass, user, "get_person", person_id=ids["josie"])
    assert [(r["other"]["id"], r["type"]) for r in josie["relationships"]] == [(ids["phil"], "Parent")]


async def test_adding_the_same_link_from_the_other_side_is_reported_as_already_existing(hass, crm):
    user, ids, entry = crm
    first = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    again = await run(
        hass, user, "add_relationship", person_id=ids["josie"], other_person_id=ids["phil"],
        type="Parent",
    )
    assert again["already_existed"] is True
    assert again["relationship_id"] == first["relationship_id"]
    assert again["person"]["id"] == ids["josie"] and again["type"] == "Parent"
    same = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    assert same["already_existed"] is True
    # A symmetric type is the same link from either side too.
    spouse = await run(
        hass, user, "add_relationship", person_id=ids["mae"], other_person_id=ids["phil"],
        type="Spouse",
    )
    assert spouse["already_existed"] is True
    snapshot = await snapshot_of(hass, entry)
    assert len(links_between(snapshot, ids["phil"], ids["josie"])) == 1
    assert len(links_between(snapshot, ids["phil"], ids["mae"])) == 1


async def test_add_relationship_refuses_self_links_with_a_plain_error(hass, crm):
    user, ids, entry = crm
    before = await snapshot_of(hass, entry)
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "add_relationship", person_id=ids["wren"], other_person_id=ids["wren"],
            type="Friend",
        )
    assert str(err.value) == (
        "other_person_id: a person cannot be related to themselves. Nothing was changed."
    )
    assert (await snapshot_of(hass, entry))["relationships"] == before["relationships"]


async def test_add_relationship_refuses_an_unknown_type(hass, crm):
    user, ids, _ = crm
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
            type="Niece",
        )
    assert str(err.value).startswith("type: ")


async def test_update_relationship_from_the_other_side_keeps_the_meaning(hass, crm):
    user, ids, entry = crm
    added = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child", notes="First kid",
    )
    # From Josie's side: Phil is her Grandparent (a correction).
    result = await run(
        hass, user, "update_relationship", relationship_id=added["relationship_id"],
        person_id=ids["josie"], type="Grandparent",
    )
    assert result["person"]["id"] == ids["josie"] and result["other"]["id"] == ids["phil"]
    assert result["type"] == "Grandparent" and result["notes"] == "First kid"
    row = links_between(await snapshot_of(hass, entry), ids["phil"], ids["josie"])[0]
    assert (row["person_a_id"], row["person_b_id"], row["type"]) == (
        ids["josie"], ids["phil"], "Grandparent"
    )
    assert result["label"] == row["label"] == "Josie Example → Phil Example"
    phil = await run(hass, user, "get_person", person_id=ids["phil"])
    assert (ids["josie"], "Grandchild") in [(r["other"]["id"], r["type"]) for r in phil["relationships"]]


async def test_update_relationship_can_change_the_other_person(hass, crm):
    user, ids, entry = crm
    added = await run(
        hass, user, "add_relationship", person_id=ids["josie"], other_person_id=ids["phil"],
        type="Parent",
    )
    result = await run(
        hass, user, "update_relationship", relationship_id=added["relationship_id"],
        person_id=ids["josie"], other_person_id=ids["mae"],
    )
    assert result["other"]["id"] == ids["mae"] and result["type"] == "Parent"
    snapshot = await snapshot_of(hass, entry)
    assert links_between(snapshot, ids["josie"], ids["phil"]) == []
    assert len(links_between(snapshot, ids["josie"], ids["mae"])) == 1


async def test_update_relationship_notes_only_sends_notes(hass, crm, monkeypatch):
    user, ids, entry = crm
    added = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    calls = record_updates(monkeypatch, entry)
    result = await run(
        hass, user, "update_relationship", relationship_id=added["relationship_id"],
        person_id=ids["josie"], notes="Born in spring",
    )
    assert calls == [("relationship", added["relationship_id"], {"notes": "Born in spring"})]
    assert result["notes"] == "Born in spring" and result["type"] == "Parent"
    row = links_between(await snapshot_of(hass, entry), ids["phil"], ids["josie"])[0]
    assert (row["person_a_id"], row["person_b_id"], row["type"]) == (ids["phil"], ids["josie"], "Child")


async def test_update_relationship_needs_the_viewer_to_be_one_end(hass, crm):
    user, ids, _ = crm
    added = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "update_relationship", relationship_id=added["relationship_id"],
            person_id=ids["wren"], type="Friend",
        )
    assert "not one end of this relationship" in str(err.value)


async def test_update_relationship_refuses_to_duplicate_another_link(hass, crm):
    user, ids, entry = crm
    added = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "update_relationship", relationship_id=added["relationship_id"],
            person_id=ids["phil"], other_person_id=ids["mae"], type="Spouse",
        )
    assert "already exists" in str(err.value)
    assert len(links_between(await snapshot_of(hass, entry), ids["phil"], ids["josie"])) == 1


async def test_remove_relationship_echoes_what_it_removed(hass, crm):
    user, ids, entry = crm
    added = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    result = await run(hass, user, "remove_relationship", relationship_id=added["relationship_id"])
    deleted = result["deleted"]
    assert deleted["relationship_id"] == added["relationship_id"]
    assert deleted["label"] == "Phil Example → Josie Example"
    assert deleted["person"]["id"] == ids["phil"] and deleted["other"]["id"] == ids["josie"]
    assert deleted["type"] == "Child"
    assert links_between(await snapshot_of(hass, entry), ids["phil"], ids["josie"]) == []
    with pytest.raises(ToolError) as err:
        await run(hass, user, "remove_relationship", relationship_id=added["relationship_id"])
    assert str(err.value).startswith("There is no relationship with that id.")


# -- households --------------------------------------------------------------------------


async def test_create_household_refuses_moving_someone_without_move(hass, crm):
    user, ids, entry = crm
    before = await snapshot_of(hass, entry)
    with pytest.raises(ToolError) as err:
        await run(hass, user, "create_household", person_ids=[ids["josie"], ids["phil"]])
    assert str(err.value) == (
        "Phil Example is already in the household 'Mae & Phil Example'. To move them, ask the "
        "user and call again with move=true. To add someone to that household instead, use "
        "update_household."
    )
    after = await snapshot_of(hass, entry)
    assert after["households"] == before["households"] and after["people"] == before["people"]

    moved = await run(
        hass, user, "create_household", person_ids=[ids["josie"], ids["phil"]], move=True
    )
    assert {m["id"] for m in moved["members"]} == {ids["josie"], ids["phil"]}
    old = await run(hass, user, "get_household", household_id=ids["house"])
    assert [m["id"] for m in old["members"]] == [ids["mae"]]


async def test_create_household_sets_members_and_the_name_is_generated(hass, crm):
    user, ids, entry = crm
    result = await run(
        hass, user, "create_household", person_ids=[ids["lena"], ids["omar"]],
        address="4 Birch Lane, Springfield", notes="Blue door",
    )
    assert result["name"] == "Lena & Omar Sample" and result["name_status"] == "generated"
    assert result["name_override"] is None and "warning" not in result
    assert result["address"]["formatted"] == "4 Birch Lane, Springfield"
    assert result["notes"] == "Blue door"
    assert [m["id"] for m in result["members"]] == [ids["lena"], ids["omar"]]
    snapshot = await snapshot_of(hass, entry)
    people = {p["id"]: p for p in snapshot["people"]}
    assert people[ids["lena"]]["household_id"] == people[ids["omar"]]["household_id"] == result["id"]
    assert people[ids["lena"]]["household_name"] == "Lena & Omar Sample"


async def test_create_household_for_one_person_warns(hass, crm):
    user, ids, _ = crm
    result = await run(hass, user, "create_household", person_ids=[ids["wren"]])
    assert result["name_status"] == "not_a_household" and result["warning"] == NOT_A_HOUSEHOLD


async def test_update_household_adds_removes_and_warns_when_it_stops_being_a_household(hass, crm):
    user, ids, entry = crm
    alone = await run(
        hass, user, "update_household", household_id=ids["house"], remove_person_ids=[ids["mae"]]
    )
    assert [m["id"] for m in alone["members"]] == [ids["phil"]]
    assert alone["name_status"] == "not_a_household" and alone["warning"] == NOT_A_HOUSEHOLD
    snapshot = await snapshot_of(hass, entry)
    assert any(h["id"] == ids["house"] for h in snapshot["households"])  # not deleted
    assert next(p for p in snapshot["people"] if p["id"] == ids["mae"])["household_id"] is None

    joined = await run(
        hass, user, "update_household", household_id=ids["house"], add_person_ids=[ids["wren"]]
    )
    assert {m["id"] for m in joined["members"]} == {ids["phil"], ids["wren"]}
    assert joined["name_status"] == "needs_name" and joined["warning"] == NEEDS_NAME

    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "update_household", household_id=ids["house"],
            remove_person_ids=[ids["lena"]],
        )
    assert str(err.value) == "Lena Sample is not in this household. Nothing was changed."


async def test_update_household_refuses_moving_someone_without_move(hass, crm):
    user, ids, entry = crm
    other = await run(hass, user, "create_household", person_ids=[ids["lena"], ids["omar"]])
    before = await snapshot_of(hass, entry)
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "update_household", household_id=ids["house"], notes="Changed",
            add_person_ids=[ids["josie"], ids["lena"]],
        )
    assert str(err.value).startswith(
        "Lena Sample is already in the household 'Lena & Omar Sample'. To move them,"
    )
    after = await snapshot_of(hass, entry)
    assert after["households"] == before["households"] and after["people"] == before["people"]

    moved = await run(
        hass, user, "update_household", household_id=ids["house"],
        add_person_ids=[ids["lena"]], move=True,
    )
    assert ids["lena"] in {m["id"] for m in moved["members"]}
    left = await run(hass, user, "get_household", household_id=other["id"])
    assert [m["id"] for m in left["members"]] == [ids["omar"]]


async def test_update_household_empty_override_clears_it(hass, crm):
    user, ids, _ = crm
    named = await run(
        hass, user, "update_household", household_id=ids["house"], name_override="The Example Crew"
    )
    assert named["name"] == "The Example Crew" and named["name_status"] == "override"
    cleared = await run(hass, user, "update_household", household_id=ids["house"], name_override="")
    assert cleared["name_override"] is None
    assert cleared["name"] == "Mae & Phil Example" and cleared["name_status"] == "generated"
    with pytest.raises(ToolError) as err:
        await run(hass, user, "update_household", household_id=ids["house"])
    assert str(err.value).startswith("Nothing to change")


# -- groups ------------------------------------------------------------------------------


async def test_group_tools_create_update_and_change_members_by_delta(hass, crm):
    user, ids, entry = crm
    created = await run(
        hass, user, "create_group", name="Book club", description="Monthly",
        person_ids=[ids["phil"], ids["wren"]],
    )
    assert created["name"] == "Book club" and created["description"] == "Monthly"
    assert {m["id"] for m in created["members"]} == {ids["phil"], ids["wren"]}
    assert created["total"] == 2 and created["truncated"] is False

    updated = await run(
        hass, user, "update_group", group_id=created["id"], name="Book Club", description=""
    )
    assert updated["name"] == "Book Club" and updated["description"] is None

    changed = await run(
        hass, user, "set_group_members", group_id=created["id"],
        add_person_ids=[ids["mae"]], remove_person_ids=[ids["wren"]],
    )
    assert {m["id"] for m in changed["members"]} == {ids["phil"], ids["mae"]}
    assert [p["id"] for p in changed["added"]] == [ids["mae"]]
    assert [p["id"] for p in changed["removed"]] == [ids["wren"]]

    before = await snapshot_of(hass, entry)
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "set_group_members", group_id=created["id"],
            add_person_ids=[ids["josie"], "no-such-person"],
        )
    assert str(err.value) == "There is no person with id 'no-such-person'. Nothing was changed."
    assert (await snapshot_of(hass, entry))["groups"] == before["groups"]


async def test_set_group_members_does_not_wipe_people_added_since_the_model_last_read(hass, crm):
    user, ids, entry = crm
    created = await run(hass, user, "create_group", name="Hikers", person_ids=[ids["phil"]])
    seen = await run(hass, user, "get_group", group_id=created["id"])
    assert [m["id"] for m in seen["members"]] == [ids["phil"]]
    # Meanwhile, the panel adds Mae.
    await hass.async_add_executor_job(
        entry.runtime_data.service.update, "contact_group", created["id"],
        {"member_ids": [ids["phil"], ids["mae"]]}, "panel",
    )
    result = await run(
        hass, user, "set_group_members", group_id=created["id"], add_person_ids=[ids["wren"]]
    )
    assert {m["id"] for m in result["members"]} == {ids["phil"], ids["mae"], ids["wren"]}


# -- the one write path ------------------------------------------------------------------


async def test_link_writes_are_logged_as_claude_and_notify_listeners(hass, crm):
    user, ids, entry = crm
    seen = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(entry.entry_id), seen.append)
    rel = await run(
        hass, user, "add_relationship", person_id=ids["phil"], other_person_id=ids["josie"],
        type="Child",
    )
    rid = rel["relationship_id"]
    await run(hass, user, "update_relationship", relationship_id=rid, person_id=ids["phil"], notes="x")
    await run(hass, user, "remove_relationship", relationship_id=rid)
    home = await run(hass, user, "create_household", person_ids=[ids["lena"]])
    await run(hass, user, "update_household", household_id=home["id"], add_person_ids=[ids["omar"]])
    group = await run(hass, user, "create_group", name="Choir")
    await run(hass, user, "update_group", group_id=group["id"], description="Tuesdays")
    await run(hass, user, "set_group_members", group_id=group["id"], add_person_ids=[ids["wren"]])
    await hass.async_block_till_done()
    assert [(n["source"], n["entity"], n["entity_id"], n["action"]) for n in seen] == [
        ("claude", "relationship", rid, "create"),
        ("claude", "relationship", rid, "update"),
        ("claude", "relationship", rid, "delete"),
        ("claude", "household", home["id"], "create"),
        ("claude", "person", ids["lena"], "update"),
        ("claude", "person", ids["omar"], "update"),
        ("claude", "contact_group", group["id"], "create"),
        ("claude", "contact_group", group["id"], "update"),
        ("claude", "contact_group", group["id"], "update"),
    ]
    changes = await hass.async_add_executor_job(entry.runtime_data.repo.changes, 9)
    assert {c.source for c in changes} == {"claude"}


async def test_backup_in_progress_refuses_a_link_write_politely(hass, crm):
    user, ids, entry = crm
    repo = entry.runtime_data.repo
    before = await snapshot_of(hass, entry)
    repo.write_timeout = 0.05
    await hass.async_add_executor_job(repo.begin_backup)
    try:
        with pytest.raises(ToolError) as err:
            await run(
                hass, user, "add_relationship", person_id=ids["phil"],
                other_person_id=ids["josie"], type="Child",
            )
    finally:
        repo.end_backup()
    assert str(err.value) == BACKUP
    assert (await snapshot_of(hass, entry))["relationships"] == before["relationships"]


# -- a household change that fails partway --------------------------------------------------


def fail_person_write(monkeypatch, entry, person_id, how):
    """Make the write that sets ``person_id``'s household fail, as if, just before it, the
    panel deleted them (``"deleted"``) or a backup started (``"backup"``)."""
    service, repo = entry.runtime_data.service, entry.runtime_data.repo
    real_update, real_delete = service.update, service.delete

    def update(kind, entity_id, changes, source):
        if kind == "person" and entity_id == person_id:
            if how == "deleted":
                real_delete("person", person_id, "panel")
            else:
                repo.write_timeout = 0.05
                repo.begin_backup()
        return real_update(kind, entity_id, changes, source)

    monkeypatch.setattr(service, "update", update)


def notices(hass, entry):
    seen = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(entry.entry_id), seen.append)
    return seen


async def test_create_household_says_what_was_saved_when_a_person_vanishes_midway(
    hass, crm, monkeypatch
):
    user, ids, entry = crm
    seen = notices(hass, entry)
    fail_person_write(monkeypatch, entry, ids["omar"], "deleted")
    with pytest.raises(ToolError) as err:
        await run(
            hass, user, "create_household", person_ids=[ids["lena"], ids["omar"], ids["wren"]]
        )
    snapshot = await snapshot_of(hass, entry)
    people = {p["id"]: p for p in snapshot["people"]}
    household_id = people[ids["lena"]]["household_id"]
    assert household_id is not None and household_id != ids["house"]
    assert ids["omar"] not in people and people[ids["wren"]]["household_id"] is None
    assert str(err.value) == (
        f"The household was created (id {household_id}) with Lena Sample, but Omar Sample "
        "could not be added: that person no longer exists in Hearth. Wren Friend was not "
        f"added either. Call update_household with household_id {household_id} to finish, "
        "adding only the people not added. Do not create another household."
    )
    assert "Nothing was changed" not in str(err.value)
    await hass.async_block_till_done()
    assert [(n["entity"], n["entity_id"], n["action"]) for n in seen if n["source"] == "claude"] == [
        ("household", household_id, "create"),
        ("person", ids["lena"], "update"),
    ]


async def test_create_household_says_what_was_saved_when_a_backup_starts_midway(
    hass, crm, monkeypatch
):
    user, ids, entry = crm
    fail_person_write(monkeypatch, entry, ids["omar"], "backup")
    try:
        with pytest.raises(ToolError) as err:
            await run(hass, user, "create_household", person_ids=[ids["lena"], ids["omar"]])
    finally:
        entry.runtime_data.repo.end_backup()
    people = {p["id"]: p for p in (await snapshot_of(hass, entry))["people"]}
    household_id = people[ids["lena"]]["household_id"]
    assert people[ids["omar"]]["household_id"] is None
    message = str(err.value)
    assert message.startswith(
        f"The household was created (id {household_id}) with Lena Sample, but Omar Sample "
        "could not be added: Home Assistant started a backup; try again in a minute. Call "
        f"update_household with household_id {household_id} to finish"
    )
    assert "Nothing was changed" not in message


async def test_update_household_says_which_changes_were_saved_when_a_write_fails_midway(
    hass, crm, monkeypatch
):
    user, ids, entry = crm
    seen = notices(hass, entry)
    fail_person_write(monkeypatch, entry, ids["wren"], "backup")
    try:
        with pytest.raises(ToolError) as err:
            await run(
                hass, user, "update_household", household_id=ids["house"], notes="New notes",
                remove_person_ids=[ids["mae"]], add_person_ids=[ids["wren"], ids["josie"]],
            )
    finally:
        entry.runtime_data.repo.end_backup()
    house = ids["house"]
    assert str(err.value) == (
        f"The household (id {house}) was only partly updated. Saved: the household's notes; "
        "taking out Mae Example. Not saved: adding Wren Friend (Home Assistant started a "
        "backup; try again in a minute); adding Josie Example. Call update_household with "
        f"household_id {house} again for only what was not saved."
    )
    snapshot = await snapshot_of(hass, entry)
    people = {p["id"]: p for p in snapshot["people"]}
    assert next(h for h in snapshot["households"] if h["id"] == house)["notes"] == "New notes"
    assert people[ids["mae"]]["household_id"] is None
    assert people[ids["wren"]]["household_id"] is None
    assert people[ids["josie"]]["household_id"] is None
    await hass.async_block_till_done()
    assert [(n["entity"], n["entity_id"]) for n in seen if n["source"] == "claude"] == [
        ("household", house),
        ("person", ids["mae"]),
    ]


async def test_update_household_whose_first_write_fails_says_nothing_was_changed(hass, crm):
    user, ids, entry = crm
    repo = entry.runtime_data.repo
    repo.write_timeout = 0.05
    await hass.async_add_executor_job(repo.begin_backup)
    try:
        with pytest.raises(ToolError) as err:
            await run(
                hass, user, "update_household", household_id=ids["house"],
                add_person_ids=[ids["wren"]],
            )
    finally:
        repo.end_backup()
    assert str(err.value) == BACKUP
