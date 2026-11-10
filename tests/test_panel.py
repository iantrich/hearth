"""The Hearth sidebar panel is registered once and its module is served."""

import json
from pathlib import Path

import pytest

from custom_components.hearth_crm.const import DOMAIN

MANIFEST_VERSION = json.loads(
    (Path(__file__).parent.parent / "custom_components" / DOMAIN / "manifest.json").read_text()
)["version"]


@pytest.fixture
async def owner_entry(hass, hass_admin_user, add_crm):
    return await add_crm(hass_admin_user)


@pytest.fixture
async def second_owner_entry(hass, hass_read_only_user, owner_entry, add_crm):
    return await add_crm(hass_read_only_user)


async def test_panel_registered_for_everyone(hass, owner_entry):
    panel = hass.data["frontend_panels"]["hearth"]
    assert panel.sidebar_title == "Hearth"
    assert panel.sidebar_icon == "mdi:fireplace"
    assert panel.require_admin is False
    cfg = panel.config["_panel_custom"]
    assert cfg["name"] == "hearth-panel"
    assert cfg["module_url"] == f"/hearth_crm_static/hearth-panel.js?v={MANIFEST_VERSION}"
    assert cfg["embed_iframe"] is False
    assert cfg["handle_safe_area"] is True


async def test_panel_module_is_served(hass, hass_client, owner_entry):
    resp = await (await hass_client()).get("/hearth_crm_static/hearth-panel.js")
    assert resp.status == 200
    assert "hearth-panel" in await resp.text()


async def test_second_crm_does_not_reregister(hass, owner_entry, second_owner_entry):
    assert [k for k in hass.data["frontend_panels"] if k == "hearth"] == ["hearth"]
