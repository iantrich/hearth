"""Hearth: a personal CRM stored in Home Assistant's config directory."""

from __future__ import annotations

import logging
import re
import sqlite3
from dataclasses import dataclass, field
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
from homeassistant.core import Event, HomeAssistant
from homeassistant.exceptions import ConfigEntryError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import dt as dt_util

from . import llm_api
from .actions import async_register_actions
from .const import CONF_OWNER_USER_ID, DATA_DIR, DB_FILE, DOMAIN, PHOTOS_DIR
from .db import CRMRepository, open_database
from .google_link import GoogleLink
from .google_runtime import GoogleRuntime
from .http import HearthImportView, HearthPhotoView
from .notifications import NotificationRuntime
from .panel import async_register_panel
from .photos import PhotoStore
from .service import HearthService
from .websocket import async_register_websocket

_LOGGER = logging.getLogger(__name__)
_PLAIN_ID = re.compile(r"[A-Za-z0-9_-]+")
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


@dataclass
class HearthRuntime:
    """What a loaded entry holds on to."""

    repo: CRMRepository
    photos: PhotoStore
    service: HearthService
    data_dir: Path
    owner_user_id: str
    google: GoogleLink  # always present; not connected until the owner links Google
    google_sync: GoogleRuntime = field(init=False)  # set right after the runtime is built
    notifications: NotificationRuntime = field(init=False)  # likewise


type HearthConfigEntry = ConfigEntry[HearthRuntime]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the actions, websocket commands, panel and LLM API once, however many CRMs exist."""
    async_register_actions(hass)
    async_register_websocket(hass)
    hass.http.register_view(HearthPhotoView())
    hass.http.register_view(HearthImportView())
    await async_register_panel(hass)
    # The API lives as long as Home Assistant does, so its unregister callback is not kept.
    llm_api.async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: HearthConfigEntry) -> bool:
    """Open this owner's database and photo store."""
    owner_user_id = entry.data.get(CONF_OWNER_USER_ID)
    if not isinstance(owner_user_id, str) or not _PLAIN_ID.fullmatch(owner_user_id):
        raise ConfigEntryError("This Hearth CRM has no valid owner")
    root = Path(hass.config.path(DATA_DIR))
    data_dir = root / owner_user_id
    if not await hass.async_add_executor_job(_is_direct_child, data_dir, root):
        raise ConfigEntryError("This Hearth CRM's folder is outside the Hearth data folder")
    try:
        conn = await hass.async_add_executor_job(open_database, data_dir / DB_FILE)
    except RuntimeError as err:  # written by a newer Hearth
        raise ConfigEntryError(str(err)) from err
    except sqlite3.DatabaseError as err:
        raise ConfigEntryError(
            f"This Hearth CRM's database could not be opened; it may be damaged ({err})"
        ) from err
    repo = CRMRepository(conn)
    photos = PhotoStore(data_dir / PHOTOS_DIR)
    runtime = HearthRuntime(
        repo=repo,
        photos=photos,
        service=HearthService(repo, photos, today=lambda: dt_util.now().date()),
        data_dir=data_dir,
        owner_user_id=owner_user_id,
        google=GoogleLink(hass, entry),
    )
    runtime.google_sync = GoogleRuntime(hass, entry, runtime)
    runtime.notifications = NotificationRuntime(hass, entry, runtime)
    entry.runtime_data = runtime

    async def _close_on_stop(event: Event) -> None:
        try:
            runtime.notifications.stop()
            await runtime.google_sync.stop()  # before the database closes under a run
            await hass.async_add_executor_job(repo.close)
        except Exception:
            _LOGGER.exception("Could not close the Hearth database while stopping")

    # async_listen, not async_listen_once: its remover is safe to call after the event fired,
    # which happens when an entry is unloaded after Home Assistant began stopping.
    entry.async_on_unload(hass.bus.async_listen(EVENT_HOMEASSISTANT_STOP, _close_on_stop))
    runtime.google_sync.start()
    await runtime.notifications.async_start()
    return True


def _is_direct_child(path: Path, root: Path) -> bool:
    """Whether ``path`` resolves (symlinks followed) to a folder directly inside ``root``."""
    return path.resolve().parent == root.resolve()


async def async_unload_entry(hass: HomeAssistant, entry: HearthConfigEntry) -> bool:
    """Stop the Google sync, then close the database."""
    entry.runtime_data.notifications.stop()
    await entry.runtime_data.google_sync.stop()
    await hass.async_add_executor_job(entry.runtime_data.repo.close)
    return True
