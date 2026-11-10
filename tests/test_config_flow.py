"""Tests for the Hearth config flow on a real Home Assistant."""

from __future__ import annotations

import pytest
from homeassistant.config_entries import SOURCE_USER
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.auth.models import User

from custom_components.hearth_crm.const import CONF_OWNER_USER_ID, DOMAIN

SELF_SERVICE = "self_service"


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


def option_values(result) -> dict[str, str]:
    selector = result["data_schema"].schema[CONF_OWNER_USER_ID]
    return {o["value"]: o["label"] for o in selector.config["options"]}


async def test_user_step_lists_people_not_system_users(hass, hass_admin_user, hass_read_only_user):
    system = await hass.auth.async_create_system_user("Background Job")
    inactive = await hass.auth.async_create_user("Dormant Dana")
    await hass.auth.async_deactivate_user(inactive)

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})

    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"
    options = option_values(result)
    assert options[hass_admin_user.id] == hass_admin_user.name
    assert options[hass_read_only_user.id] == hass_read_only_user.name
    assert system.id not in options
    assert inactive.id not in options


async def test_user_step_aborts_when_there_are_no_users(hass):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "no_users"


async def test_user_step_creates_entry_for_chosen_owner(hass, hass_admin_user):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_OWNER_USER_ID: hass_admin_user.id}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {"owner_user_id": hass_admin_user.id}
    assert result["title"] == f"Hearth ({hass_admin_user.name})"
    assert result["result"].unique_id == hass_admin_user.id


async def test_second_crm_for_same_user_aborts(hass, hass_admin_user, add_crm):
    await add_crm(hass_admin_user)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_OWNER_USER_ID: hass_admin_user.id}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "already_configured"


async def test_self_service_step_creates_entry(hass, hass_read_only_user):
    result = await hass.config_entries.flow.async_init(
        DOMAIN,
        context={"source": SELF_SERVICE},
        data={CONF_OWNER_USER_ID: hass_read_only_user.id},
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {"owner_user_id": hass_read_only_user.id}
    assert result["title"] == f"Hearth ({hass_read_only_user.name})"
    assert result["result"].unique_id == hass_read_only_user.id


async def test_self_service_twice_aborts(hass, hass_read_only_user):
    for expected in (FlowResultType.CREATE_ENTRY, FlowResultType.ABORT):
        result = await hass.config_entries.flow.async_init(
            DOMAIN,
            context={"source": SELF_SERVICE},
            data={CONF_OWNER_USER_ID: hass_read_only_user.id},
        )
        assert result["type"] is expected
    assert result["reason"] == "already_configured"


async def test_self_service_rejects_unknown_inactive_and_system_users(hass, hass_admin_user):
    inactive: User = await hass.auth.async_create_user("Dormant Dana")
    await hass.auth.async_deactivate_user(inactive)
    system = await hass.auth.async_create_system_user("Background Job")
    for user_id in ("no-such-user", inactive.id, system.id):
        result = await hass.config_entries.flow.async_init(
            DOMAIN, context={"source": SELF_SERVICE}, data={CONF_OWNER_USER_ID: user_id}
        )
        assert result["type"] is FlowResultType.ABORT
        assert result["reason"] == "invalid_user"
    assert hass.config_entries.async_entries(DOMAIN) == []
