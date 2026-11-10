"""Find the CRM that belongs to a Home Assistant user and check who may reach it."""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError, Unauthorized

from .const import CONF_OWNER_USER_ID, DOMAIN

if TYPE_CHECKING:
    from . import HearthConfigEntry


def entry_for_user(hass: HomeAssistant, user_id: str | None) -> HearthConfigEntry | None:
    """Return the loaded CRM owned by this user, if there is one."""
    if user_id is None:
        return None
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED and entry.data.get(CONF_OWNER_USER_ID) == user_id:
            return entry
    return None


def entry_by_id(hass: HomeAssistant, entry_id: str) -> HearthConfigEntry:
    """Return the loaded Hearth CRM with this entry ID."""
    entry = hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN:
        raise ServiceValidationError(f"{entry_id} is not a Hearth CRM")
    if entry.state is not ConfigEntryState.LOADED:
        raise ServiceValidationError(f"The Hearth CRM {entry_id} is not loaded")
    return entry


async def async_check_owner_or_admin(
    hass: HomeAssistant, entry: HearthConfigEntry, user_id: str | None
) -> None:
    """Allow the CRM's owner and Home Assistant administrators; refuse everyone else."""
    if user_id is None:
        raise Unauthorized
    if user_id == entry.data.get(CONF_OWNER_USER_ID):
        return
    user = await hass.auth.async_get_user(user_id)
    if user is None or not user.is_admin:
        raise Unauthorized(user_id=user_id)
