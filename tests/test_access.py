"""Tests for finding a user's CRM and checking who may reach it."""

from __future__ import annotations

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.exceptions import ServiceValidationError, Unauthorized

from custom_components.hearth_crm import access
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hearth_crm.const import DOMAIN


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


async def test_entry_for_user_and_owner_checks(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    admin_entry = await add_crm(hass_admin_user)
    reader_entry = await add_crm(hass_read_only_user)

    assert access.entry_for_user(hass, hass_admin_user.id) is admin_entry
    assert access.entry_for_user(hass, hass_read_only_user.id) is reader_entry
    assert access.entry_for_user(hass, "someone-else") is None
    assert access.entry_for_user(hass, None) is None

    await access.async_check_owner_or_admin(hass, reader_entry, hass_read_only_user.id)
    # An admin may reach another user's CRM; a plain user may not.
    await access.async_check_owner_or_admin(hass, reader_entry, hass_admin_user.id)
    with pytest.raises(Unauthorized):
        await access.async_check_owner_or_admin(hass, admin_entry, hass_read_only_user.id)
    with pytest.raises(Unauthorized):
        await access.async_check_owner_or_admin(hass, admin_entry, None)
    with pytest.raises(Unauthorized):
        await access.async_check_owner_or_admin(hass, admin_entry, "no-such-user")


async def test_entry_for_user_ignores_entries_that_are_not_loaded(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await hass.config_entries.async_unload(entry.entry_id)
    assert access.entry_for_user(hass, hass_admin_user.id) is None


async def test_entry_by_id(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    assert access.entry_by_id(hass, entry.entry_id) is entry
    with pytest.raises(ServiceValidationError):
        access.entry_by_id(hass, "missing")


async def test_entry_by_id_rejects_other_integrations(hass):
    other = MockConfigEntry(domain="not_hearth")
    other.add_to_hass(hass)
    with pytest.raises(ServiceValidationError):
        access.entry_by_id(hass, other.entry_id)
    assert hass.config_entries.async_get_entry(other.entry_id) is other


async def test_entry_by_id_rejects_an_entry_that_is_not_loaded(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await hass.config_entries.async_unload(entry.entry_id)
    with pytest.raises(ServiceValidationError):
        access.entry_by_id(hass, entry.entry_id)


async def test_malformed_entry_does_not_break_other_lookups(hass, hass_admin_user, add_crm):
    admin_entry = await add_crm(hass_admin_user)
    broken = MockConfigEntry(domain=DOMAIN, data={}, state=ConfigEntryState.LOADED)
    broken.add_to_hass(hass)
    assert access.entry_for_user(hass, hass_admin_user.id) is admin_entry
    with pytest.raises(Unauthorized):
        await access.async_check_owner_or_admin(hass, broken, None)
