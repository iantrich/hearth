"""Tests for setup, unload and the actions, on a real Home Assistant."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import Context
from homeassistant.exceptions import ServiceValidationError
from pytest_homeassistant_custom_component.common import MockConfigEntry

import custom_components.hearth_crm as integration
from custom_components.hearth_crm.const import DOMAIN
from tests.conftest import sample_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


def crm_dir(hass, user) -> Path:
    return Path(hass.config.path("hearth_crm", user.id))


async def test_setup_opens_this_owners_database_and_photos(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    assert entry.state is ConfigEntryState.LOADED
    runtime = entry.runtime_data
    assert runtime.owner_user_id == hass_admin_user.id
    assert runtime.data_dir == crm_dir(hass, hass_admin_user)
    assert (runtime.data_dir / "hearth_crm.db").exists()
    assert runtime.photos.put(b"img")
    assert runtime.service.snapshot()["people"] == []
    assert (runtime.data_dir / "photos").is_dir()


async def test_two_users_get_separate_databases(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    admin_entry = await add_crm(hass_admin_user)
    reader_entry = await add_crm(hass_read_only_user)

    for user in (hass_admin_user, hass_read_only_user):
        assert (crm_dir(hass, user) / "hearth_crm.db").exists()

    await hass.async_add_executor_job(
        admin_entry.runtime_data.repo.replace_all, sample_data(), "sync"
    )
    admin_data = await hass.async_add_executor_job(admin_entry.runtime_data.repo.snapshot)
    reader_data = await hass.async_add_executor_job(reader_entry.runtime_data.repo.snapshot)
    assert admin_data.people
    assert reader_data.people == []


async def test_readding_reopens_same_data(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await hass.async_add_executor_job(entry.runtime_data.repo.replace_all, sample_data(), "sync")
    before = await hass.async_add_executor_job(entry.runtime_data.repo.snapshot)

    assert await hass.config_entries.async_remove(entry.entry_id) == {
        "require_restart": False
    }
    assert (crm_dir(hass, hass_admin_user) / "hearth_crm.db").exists()

    again = await add_crm(hass_admin_user)
    after = await hass.async_add_executor_job(again.runtime_data.repo.snapshot)
    assert after == before


async def test_unload_closes_database(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    repo = entry.runtime_data.repo
    assert await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.NOT_LOADED
    with pytest.raises(Exception, match="closed"):
        repo.snapshot()


async def test_actions_are_registered_once_for_all_entries(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    admin_entry = await add_crm(hass_admin_user)
    await add_crm(hass_read_only_user)
    assert set(hass.services.async_services_for_domain(DOMAIN)) == {
        "import",
        "export",
        "confirm_cutover",
        "google_sync",
    }

    # Unloading one CRM leaves the actions available to the others.
    await hass.config_entries.async_unload(admin_entry.entry_id)
    assert hass.services.has_service(DOMAIN, "confirm_cutover")


async def test_confirm_cutover_acts_on_the_chosen_entry_only(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    admin_entry = await add_crm(hass_admin_user)
    reader_entry = await add_crm(hass_read_only_user)

    await hass.services.async_call(
        DOMAIN,
        "confirm_cutover",
        {"config_entry_id": admin_entry.entry_id},
        blocking=True,
        context=Context(user_id=hass_admin_user.id),
    )

    assert await hass.async_add_executor_job(admin_entry.runtime_data.repo.cutover_confirmed)
    assert not await hass.async_add_executor_job(reader_entry.runtime_data.repo.cutover_confirmed)


async def test_actions_reject_unknown_entries(hass, hass_admin_user, add_crm):
    await add_crm(hass_admin_user)
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "confirm_cutover", {"config_entry_id": "missing"}, blocking=True
        )


async def test_manifest_declares_dependencies_and_requirements():
    manifest = json.loads((Path(integration.__file__).parent / "manifest.json").read_text())
    assert "single_config_entry" not in manifest
    assert manifest["dependencies"] == [
        "application_credentials", "frontend", "http", "panel_custom", "websocket_api"
    ]
    # Pillow comes with Home Assistant itself; hassfest refuses a custom integration that lists it.
    assert "requirements" not in manifest
    assert manifest["iot_class"] == "calculated"


@pytest.mark.parametrize("owner", [None, "", "../escape", "a/b", "..", "x\\y", "/abs"])
async def test_setup_refuses_a_malformed_owner(hass, owner):
    entry = MockConfigEntry(domain=DOMAIN, data={} if owner is None else {"owner_user_id": owner})
    entry.add_to_hass(hass)
    assert not await hass.config_entries.async_setup(entry.entry_id)
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert not Path(hass.config.path("hearth_crm")).exists() or not any(
        Path(hass.config.path("hearth_crm")).iterdir()
    )
    assert not (Path(hass.config.config_dir) / "escape").exists()


async def test_newer_database_is_a_clear_setup_error(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    repo = entry.runtime_data.repo
    await hass.async_add_executor_job(
        lambda: repo._conn.execute("UPDATE meta SET value = '99' WHERE key = 'schema_version'")
    )
    await hass.config_entries.async_unload(entry.entry_id)
    assert not await hass.config_entries.async_setup(entry.entry_id)
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert "Update Hearth" in entry.reason


async def test_damaged_database_is_a_clear_setup_error(hass, hass_admin_user):
    data_dir = crm_dir(hass, hass_admin_user)
    data_dir.mkdir(parents=True)
    (data_dir / "hearth_crm.db").write_bytes(b"this is not a sqlite database" * 100)
    entry = MockConfigEntry(
        domain=DOMAIN, unique_id=hass_admin_user.id, data={"owner_user_id": hass_admin_user.id}
    )
    entry.add_to_hass(hass)
    assert not await hass.config_entries.async_setup(entry.entry_id)
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert "could not be opened" in entry.reason


async def test_stopping_home_assistant_closes_every_database(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    from homeassistant.const import EVENT_HOMEASSISTANT_STOP

    repos = [(await add_crm(u)).runtime_data.repo for u in (hass_admin_user, hass_read_only_user)]
    hass.bus.async_fire(EVENT_HOMEASSISTANT_STOP)
    await hass.async_block_till_done()
    for repo in repos:
        with pytest.raises(Exception, match="closed"):
            repo.snapshot()
