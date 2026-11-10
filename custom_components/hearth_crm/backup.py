"""Hold the database quiet while Home Assistant takes a backup."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant

from .const import DOMAIN

# Every repository this Home Assistant's backup holds, whatever happens to its entry meanwhile.
DATA_BACKUP_HELD = "hearth_crm_backup_held"


def _loaded_repos(hass: HomeAssistant) -> list:
    return [
        entry.runtime_data.repo
        for entry in hass.config_entries.async_entries(DOMAIN)
        if entry.state is ConfigEntryState.LOADED
    ]


async def async_pre_backup(hass: HomeAssistant) -> None:
    """Block writes and flush the WAL so the copied database files are complete.

    If any CRM cannot be held, the ones already held are released before raising.
    """
    held: list = hass.data.setdefault(DATA_BACKUP_HELD, [])
    try:
        for repo in _loaded_repos(hass):
            await hass.async_add_executor_job(repo.begin_backup)
            held.append(repo)
    except BaseException:
        await async_post_backup(hass)
        raise


async def async_post_backup(hass: HomeAssistant) -> None:
    """Allow writes again on every CRM the backup held, even one unloaded since."""
    held: list = hass.data.pop(DATA_BACKUP_HELD, [])
    for repo in held:
        await hass.async_add_executor_job(repo.end_backup)
