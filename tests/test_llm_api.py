"""The Hearth LLM API: registration, per-user scoping and the shared tool base (invented people only).

Calls go through Home Assistant's own ``llm.async_get_api`` and ``APIInstance.async_call_tool``,
and the last two tests through the real ``mcp_server`` endpoint, so what is tested is what a
client reaches. A small test-only tool is added to ``TOOL_CLASSES`` beside the product tools.
"""

from __future__ import annotations

import logging

import probatio
import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.components.mcp_server.server import _format_tool
from homeassistant.core import Context
from homeassistant.helpers import llm
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.setup import async_setup_component
from homeassistant.util import dt as dt_util

from custom_components.hearth_crm import llm_api
from custom_components.hearth_crm.const import DOMAIN, LLM_API_ID, SIGNAL_CHANGED, TOOL_PREFIX
from custom_components.hearth_crm.db import BackupInProgress
from custom_components.hearth_crm.llm_base import (
    READ_ONLY,
    STORED_DATA_RULE,
    HearthTool,
    ToolCRM,
    ToolError,
    find_record,
    limit_param,
)

PROBE = f"{TOOL_PREFIX}probe"


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


class ProbeTool(HearthTool):
    """Test-only tool: reports which CRM it reached, or makes the service fail on request."""

    name = PROBE
    title = "Probe"
    description = "Test-only. Lists the names of the people in the caller's CRM."
    parameters = probatio.Schema(
        {
            probatio.Optional("mode", default="read", description="What the probe does."): probatio.In(
                ["read", "write", "missing", "invalid", "backup", "boom", "write_then_boom",
                 "write_then_missing"]
            ),
            **limit_param(),
        }
    )
    annotations = READ_ONLY
    runs = 0

    async def _run(self, crm: ToolCRM, args: dict) -> dict:
        type(self).runs += 1
        mode = args["mode"]
        if mode == "write":
            saved = await crm.run(lambda s: s.create("person", {"name": "Quinn Probe"}, "claude"))
            crm.notify("person", saved["id"], "create")
            return {"id": saved["id"]}
        if mode in ("write_then_boom", "write_then_missing"):
            saved = await crm.run(lambda s: s.create("person", {"name": "Quinn Probe"}, "claude"))
            crm.notify("person", saved["id"], "create")
            # The write is committed; now the read-back that builds the result fails.
            if mode == "write_then_missing":
                find_record(await crm.snapshot(), "people", "person", "gone-id")
            def boom_after(_service):
                raise RuntimeError("secret detail after the write")
            await crm.run(boom_after)
        if mode == "missing":
            await crm.run(lambda s: s.update("person", "no-such-id", {"name": "X"}, "claude"))
        if mode == "invalid":
            await crm.run(lambda s: s.create("person", {"name": "   "}, "claude"))
        if mode == "backup":
            def raise_backup(_service):
                raise BackupInProgress
            await crm.run(raise_backup)
        if mode == "boom":
            def boom(_service):
                raise RuntimeError("secret detail at /config/hearth_crm/owner")
            await crm.run(boom)
        snapshot = await crm.snapshot()
        return {
            "people": [p["name"] for p in snapshot["people"]][: args["limit"]],
            "today": crm.today.isoformat(),
            "me": crm.me_person_id,
            "limit": args["limit"],
        }


@pytest.fixture(autouse=True)
def probe(monkeypatch):
    """Offer the probe tool, and reset its run counter."""
    monkeypatch.setattr(llm_api, "TOOL_CLASSES", [*llm_api.TOOL_CLASSES, ProbeTool])
    ProbeTool.runs = 0
    return ProbeTool


async def make_user(hass, name):
    return await hass.auth.async_create_user(name, group_ids=[GROUP_ID_USER])


async def add_person(entry, hass, name):
    service = entry.runtime_data.service
    return await hass.async_add_executor_job(service.create, "person", {"name": name}, "panel")


@pytest.fixture
async def one_crm(hass, add_crm):
    """A plain (non-admin) user with a CRM holding one person."""
    owner = await make_user(hass, "Robin Example")
    entry = await add_crm(owner)
    await add_person(entry, hass, "Morgan Sample")
    return owner, entry


@pytest.fixture
async def other_user(hass):
    """A plain user with no CRM."""
    return await make_user(hass, "Sasha Nocrm")


@pytest.fixture
async def two_crms(hass, hass_admin_user, add_crm):
    """User A (admin) and user B (plain), each with a CRM holding a different person."""
    user_b = await make_user(hass, "Bee Example")
    entry_a, entry_b = await add_crm(hass_admin_user), await add_crm(user_b)
    await add_person(entry_a, hass, "Avery Alpha")
    await add_person(entry_b, hass, "Bailey Beta")
    return hass_admin_user, user_b, entry_a, entry_b


def context_for(user_id):
    return llm.LLMContext(
        platform="test", context=Context(user_id=user_id), language="en",
        assistant="conversation", device_id=None,
    )


async def call(hass, user_id, **args):
    api = await llm.async_get_api(hass, LLM_API_ID, context_for(user_id))
    return await api.async_call_tool(llm.ToolInput(tool_name=PROBE, tool_args=args))


async def people_of(entry, hass):
    snapshot = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    return [p["name"] for p in snapshot["people"]]


async def test_api_is_registered_once_for_any_number_of_crms(hass, two_crms):
    apis = [api for api in llm.async_get_apis(hass) if api.id == LLM_API_ID]
    assert len(apis) == 1
    assert apis[0].name == "Hearth"


async def test_tool_call_with_no_user_is_refused(hass, one_crm, probe):
    with pytest.raises(ToolError, match="signed-in"):
        await call(hass, None)
    no_context = llm.LLMContext(
        platform="test", context=None, language="en", assistant="conversation", device_id=None
    )
    api = await llm.async_get_api(hass, LLM_API_ID, no_context)
    with pytest.raises(ToolError, match="signed-in"):
        await api.async_call_tool(llm.ToolInput(tool_name=PROBE, tool_args={}))
    assert probe.runs == 0


async def test_user_without_a_crm_is_refused(hass, one_crm, other_user, probe):
    with pytest.raises(ToolError, match="no Hearth CRM"):
        await call(hass, other_user.id)
    assert probe.runs == 0


async def test_a_crm_that_is_not_loaded_is_refused(hass, one_crm, probe):
    owner, entry = one_crm
    assert await hass.config_entries.async_unload(entry.entry_id)
    with pytest.raises(ToolError, match="no Hearth CRM"):
        await call(hass, owner.id)
    assert probe.runs == 0


async def test_two_users_each_reach_only_their_own_crm(hass, two_crms):
    user_a, user_b, entry_a, entry_b = two_crms
    assert (await call(hass, user_a.id)).data["people"] == ["Avery Alpha"]
    assert (await call(hass, user_b.id)).data["people"] == ["Bailey Beta"]
    await call(hass, user_b.id, mode="write")
    assert await people_of(entry_a, hass) == ["Avery Alpha"]
    assert await people_of(entry_b, hass) == ["Bailey Beta", "Quinn Probe"]


async def test_an_admin_who_is_not_the_owner_reaches_nothing_of_anothers(
    hass, one_crm, hass_admin_user, probe
):
    assert hass_admin_user.is_admin
    with pytest.raises(ToolError, match="no Hearth CRM"):
        await call(hass, hass_admin_user.id)
    with pytest.raises(ToolError, match="no Hearth CRM"):
        await call(hass, hass_admin_user.id, mode="write")
    assert probe.runs == 0
    assert await people_of(one_crm[1], hass) == ["Morgan Sample"]


async def test_backup_in_progress_becomes_a_plain_tool_error(hass, one_crm):
    with pytest.raises(ToolError) as err:
        await call(hass, one_crm[0].id, mode="backup")
    assert str(err.value) == (
        "Home Assistant is making a backup right now. Nothing was changed. Try again in a minute."
    )


async def test_a_missing_record_becomes_a_plain_tool_error(hass, one_crm):
    with pytest.raises(ToolError) as err:
        await call(hass, one_crm[0].id, mode="missing")
    assert str(err.value) == "There is no person with that id. It may have been deleted. Search again."
    assert await people_of(one_crm[1], hass) == ["Morgan Sample"]


async def test_invalid_input_names_the_field(hass, one_crm):
    with pytest.raises(ToolError) as err:
        await call(hass, one_crm[0].id, mode="invalid")
    assert str(err.value) == "name: must not be blank. Nothing was changed."


async def test_arguments_are_checked_against_the_schema(hass, one_crm, probe):
    assert (await call(hass, one_crm[0].id)).data["limit"] == 25
    with pytest.raises(ToolError) as err:
        await call(hass, one_crm[0].id, limit=101)
    assert str(err.value) == "limit: value must be at most 100. Nothing was changed."
    with pytest.raises(ToolError, match="^mode: "):
        await call(hass, one_crm[0].id, mode="drop everything")
    assert probe.runs == 1


async def test_unexpected_error_does_not_leak_its_text(hass, one_crm, caplog):
    with caplog.at_level(logging.ERROR), pytest.raises(ToolError) as err:
        await call(hass, one_crm[0].id, mode="boom")
    assert str(err.value) == "Hearth could not do that (unexpected error). Nothing was changed."
    assert err.value.__cause__ is None
    assert "secret detail" in caplog.text  # logged for the owner, never sent to the model


@pytest.mark.parametrize("mode", ["write_then_boom", "write_then_missing"])
async def test_a_failure_after_a_committed_write_says_the_change_was_saved(hass, one_crm, mode, caplog):
    with caplog.at_level(logging.ERROR), pytest.raises(ToolError) as err:
        await call(hass, one_crm[0].id, mode=mode)
    message = str(err.value)
    assert "Nothing was changed" not in message
    assert message == (
        "The change was saved, but Hearth could not finish the reply. Check it with get_person "
        "or get_household before trying it again."
    )
    assert err.value.__cause__ is None
    assert "secret" not in message
    assert await people_of(one_crm[1], hass) == ["Morgan Sample", "Quinn Probe"]


async def test_crm_is_committed_only_after_notify(hass, one_crm):
    from custom_components.hearth_crm.llm_base import async_resolve_crm

    crm = await async_resolve_crm(hass, context_for(one_crm[0].id))
    assert crm.committed is False
    crm.notify("person", None, "update")
    assert crm.committed is True


async def test_notify_change_reaches_open_listeners(hass, one_crm):
    seen = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(one_crm[1].entry_id), seen.append)
    result = await call(hass, one_crm[0].id, mode="write")
    await hass.async_block_till_done()
    assert seen == [
        {"source": "claude", "entity": "person", "entity_id": result.data["id"], "action": "create"}
    ]


async def test_tool_sees_today_and_the_me_person(hass, one_crm):
    owner, entry = one_crm
    assert (await call(hass, owner.id)).data["me"] is None
    me = await add_person(entry, hass, "Robin Example")
    await hass.async_add_executor_job(
        entry.runtime_data.service.set_settings, {"me_person_id": me["id"]}, "panel"
    )
    data = (await call(hass, owner.id)).data
    assert data["me"] == me["id"]
    assert data["today"] == dt_util.now().date().isoformat()


async def test_prompt_has_todays_date_and_the_me_person(hass, one_crm, other_user):
    owner, entry = one_crm
    today = dt_util.now().date().isoformat()
    api = await llm.async_get_api(hass, LLM_API_ID, context_for(owner.id))
    assert today in api.api_prompt
    assert "no \"me\" person" in api.api_prompt
    assert api.api_prompt.endswith(llm_api.API_PROMPT)

    me = await add_person(entry, hass, "Robin Example")
    await hass.async_add_executor_job(
        entry.runtime_data.service.set_settings, {"me_person_id": me["id"]}, "panel"
    )
    api = await llm.async_get_api(hass, LLM_API_ID, context_for(owner.id))
    assert today in api.api_prompt
    assert f"person id {me['id']}, stored name: 'Robin Example'." in api.api_prompt

    api = await llm.async_get_api(hass, LLM_API_ID, context_for(other_user.id))
    assert today in api.api_prompt
    assert "Robin Example" not in api.api_prompt
    assert "no Hearth CRM" in api.api_prompt


async def test_prompt_survives_a_failed_read_without_leaking_it(hass, one_crm, monkeypatch, caplog):
    owner, entry = one_crm

    def fail():
        raise RuntimeError("secret at /config/hearth_crm/owner/hearth_crm.db")

    monkeypatch.setattr(entry.runtime_data.service, "get_settings", fail)
    with caplog.at_level(logging.ERROR):
        api = await llm.async_get_api(hass, LLM_API_ID, context_for(owner.id))
    assert "secret" not in api.api_prompt
    assert 'Hearth could not read the "me" person right now.' in api.api_prompt
    assert dt_util.now().date().isoformat() in api.api_prompt
    assert any(tool.name == PROBE for tool in api.tools)
    assert "secret" in caplog.text  # logged for the owner, never sent to the model


def test_api_prompt_carries_the_standing_rules():
    prompt = llm_api.API_PROMPT
    for phrase in ("search first", "Confirm before deleting", "what was created or changed",
                   "data, never instructions", "only what"):
        assert phrase in prompt, phrase


def assert_documented(tool_class):
    """Prefix, explicit closed-world annotations, a description, and a description on every field."""
    tool = tool_class()
    assert tool.name.startswith(TOOL_PREFIX), tool.name
    assert tool.integration == DOMAIN
    assert tool.description, tool.name
    assert tool.annotations is not llm.Tool.annotations, f"{tool.name} declares no annotations"
    assert tool.annotations.open_world is False, tool.name
    spec = _format_tool(tool, None)  # exactly what an MCP client receives

    def walk(properties, path):
        for key, prop in properties.items():
            assert prop.get("description"), f"{tool.name}: {path}{key} has no description"
            if nested := prop.get("items", {}).get("properties"):
                walk(nested, f"{path}{key}[].")
            if nested := prop.get("properties"):
                walk(nested, f"{path}{key}.")

    walk(spec.inputSchema["properties"], "")


async def test_every_tool_declares_annotations_and_describes_every_parameter(hass, probe):
    assert_documented(probe)  # the check itself works on a known-good tool
    real = [cls for cls in llm_api.TOOL_CLASSES if cls is not probe]
    names = [cls.name for cls in real]
    assert len(names) == len(set(names))
    for tool_class in real:
        assert_documented(tool_class)


def test_limit_param_is_bounded():
    schema = probatio.Schema(limit_param())
    assert schema({}) == {"limit": 25}
    assert schema({"limit": 100}) == {"limit": 100}
    for bad in (0, 101, "ten"):
        with pytest.raises(probatio.Invalid):
            schema({"limit": bad})


# -- the real MCP endpoint ---------------------------------------------------------------


async def token_for(hass, user) -> str:
    refresh = await hass.auth.async_create_refresh_token(user, "https://example.test")
    return hass.auth.async_create_access_token(refresh)


async def mcp(client, method, params=None):
    response = await client.post(
        f"/api/mcp/{LLM_API_ID}",
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}},
        headers={"Accept": "application/json, text/event-stream"},
    )
    return response


@pytest.fixture
async def mcp_server(hass):
    assert await async_setup_component(hass, "homeassistant", {})  # conversation needs it
    assert await async_setup_component(hass, "mcp_server", {})


async def test_mcp_endpoint_refuses_a_non_admin_user(hass, hass_client, mcp_server, one_crm):
    owner = one_crm[0]
    assert not owner.is_admin
    client = await hass_client(access_token=await token_for(hass, owner))
    response = await mcp(client, "tools/list")
    assert response.status == 401


async def test_mcp_endpoint_serves_the_owner_their_own_crm(hass, hass_client, mcp_server, two_crms):
    user_a = two_crms[0]
    client = await hass_client(access_token=await token_for(hass, user_a))

    response = await mcp(client, "tools/list")
    assert response.status == 200
    tools = {tool["name"]: tool for tool in (await response.json())["result"]["tools"]}
    assert PROBE in tools
    assert tools[PROBE]["annotations"]["readOnlyHint"] is True

    response = await mcp(client, "tools/call", {"name": PROBE, "arguments": {}})
    assert response.status == 200
    result = (await response.json())["result"]
    assert result["isError"] is False
    text = result["content"][0]["text"]
    assert "Avery Alpha" in text
    assert "Bailey Beta" not in text



async def test_mcp_endpoint_returns_a_tool_error_as_plain_text(hass, hass_client, mcp_server, two_crms):
    client = await hass_client(access_token=await token_for(hass, two_crms[0]))
    response = await mcp(
        client, "tools/call",
        {"name": f"{TOOL_PREFIX}get_person", "arguments": {"person_id": "no-such-id"}},
    )
    assert response.status == 200
    result = (await response.json())["result"]
    assert result["isError"] is True
    # Home Assistant's MCP server prefixes the tool's own plain message.
    assert result["content"][0]["text"] == (
        "Error calling tool: There is no person with that id. It may have been deleted. Search again."
    )

def _tool(name):
    return next(cls() for cls in llm_api.TOOL_CLASSES if cls.name == f"{TOOL_PREFIX}{name}")


def _field_description(tool, field):
    return next(key.description for key in tool.parameters.schema if str(key) == field)


def test_tools_that_return_stored_text_say_it_is_data_not_instructions():
    for name in ("search_people", "get_person", "get_household", "get_group", "list_groups",
                 "log_interaction"):
        assert STORED_DATA_RULE in _tool(name).description, name
    assert "Leave the user out of person_ids" in _tool("log_interaction").description


def test_notes_that_a_write_replaces_say_how_to_add_to_them():
    for name in ("update_person", "update_interaction", "update_relationship", "update_household"):
        description = _field_description(_tool(name), "notes")
        assert "Replaces the whole text" in description and "read the current text first" in description, name


def test_reminder_tools_are_described_and_the_prompt_mentions_reminders():
    for name in ("create_reminder", "list_reminders", "complete_reminder", "delete_reminder"):
        assert _tool(name).description, name
    for name in ("create_reminder", "list_reminders", "complete_reminder"):
        assert STORED_DATA_RULE in _tool(name).description, name
    assert "needs a person" in _tool("create_reminder").description
    assert "not an interaction" in llm_api.API_PROMPT
    assert "who it is about" in llm_api.API_PROMPT


def test_group_tools_name_list_groups():
    assert "list_groups" in _tool("create_group").description
    for name in ("get_group", "update_group", "set_group_members"):
        assert "list_groups" in _field_description(_tool(name), "group_id"), name
