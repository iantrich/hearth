"""The change notice every write sends, so open panels and cards refresh."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .const import SIGNAL_CHANGED


def notify_change(
    hass: HomeAssistant,
    entry: ConfigEntry,
    *,
    source: str,
    entity: str,
    entity_id: str | None,
    action: str,
) -> None:
    """Tell everyone listening to this CRM about a committed write."""
    async_dispatcher_send(
        hass,
        SIGNAL_CHANGED.format(entry.entry_id),
        {"source": source, "entity": entity, "entity_id": entity_id, "action": action},
    )
