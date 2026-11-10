"""The websocket commands the Hearth panel and cards use.

Every command works on the CRM of the user who sent it: the entry is found from
``connection.user.id`` on each call, and no message can name another entry or owner.
"""

from __future__ import annotations

import asyncio
import base64
import dataclasses
import logging
from collections.abc import Awaitable, Callable
from functools import wraps
from typing import Any

import probatio
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .access import entry_for_user
from .changes import notify_change
from .const import CONF_OWNER_USER_ID, DOMAIN, SIGNAL_CHANGED
from .db import BackupInProgress
from .google_runtime import GoogleSyncFailed
from .google_sync import report_to_dict
from .photo_urls import signed_photo_url
from .service import MAX_PHOTO_BYTES, GoogleSyncRefused, InvalidInput, NotBlocked, NotFound

_LOGGER = logging.getLogger(__name__)

SOURCE = "panel"
# Base64 of MAX_PHOTO_BYTES (4,000,000 characters), well inside HA's ~4 MiB message limit.
MAX_PHOTO_DATA_CHARS = 4 * MAX_PHOTO_BYTES // 3
KINDS = ["person", "household", "contact_group", "relationship", "interaction"]
PHOTO_KINDS = ["person", "household", "contact_group"]

ERR_NO_CRM = "no_crm"
ERR_NOT_FOUND = "not_found"
ERR_INVALID = "invalid"
ERR_CREATE_FAILED = "create_failed"
ERR_NOT_LOADED = "crm_not_loaded"
ERR_BACKUP_IN_PROGRESS = "backup_in_progress"
ERR_CUTOVER_NOT_CONFIRMED = "cutover_not_confirmed"
ERR_SYNC_REFUSED = "sync_refused"
ERR_SYNC_FAILED = "sync_failed"
ERR_NOT_BLOCKED = "not_blocked"
CUTOVER_NOT_CONFIRMED_MESSAGE = (
    "Confirm cutover before switching on the Google sync, so test edits never reach Google."
)
DATA_CREATE_LOCKS = "hearth_crm_create_locks"

_ID = probatio.All(str, probatio.Length(min=1))

type _Handler = Callable[[HomeAssistant, websocket_api.ActiveConnection, dict, ConfigEntry], Awaitable[None]]


def async_register_websocket(hass: HomeAssistant) -> None:
    """Register every command once."""
    for command in (
        ws_status, ws_create_crm, ws_snapshot, ws_subscribe, ws_create, ws_update, ws_delete,
        ws_set_members, ws_photo_set, ws_photo_clear, ws_settings_get, ws_settings_set,
        ws_google_status, ws_google_set_enabled, ws_google_sync_now, ws_google_preview,
        ws_google_clear_contact,
    ):
        websocket_api.async_register_command(hass, command)


def _notify(
    hass: HomeAssistant, entry: ConfigEntry, entity: str, entity_id: str | None, action: str
) -> None:
    """Tell everyone listening to this CRM about a committed write from the panel."""
    notify_change(hass, entry, source=SOURCE, entity=entity, entity_id=entity_id, action=action)


def _with_crm(handler: _Handler):
    """Resolve the caller's own CRM and turn service errors into websocket errors."""

    @wraps(handler)
    async def wrapper(
        hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict
    ) -> None:
        entry = entry_for_user(hass, connection.user.id)
        if entry is None:
            connection.send_error(msg["id"], ERR_NO_CRM, "You do not have a Hearth CRM yet")
            return
        try:
            await handler(hass, connection, msg, entry)
        except NotFound as err:
            connection.send_error(msg["id"], ERR_NOT_FOUND, str(err))
        except InvalidInput as err:
            connection.send_error(msg["id"], ERR_INVALID, str(err))
        except BackupInProgress as err:
            connection.send_error(msg["id"], ERR_BACKUP_IN_PROGRESS, str(err))
        except GoogleSyncRefused as err:
            connection.send_error(msg["id"], ERR_SYNC_REFUSED, str(err))
        except NotBlocked as err:
            connection.send_error(msg["id"], ERR_NOT_BLOCKED, str(err))
        except GoogleSyncFailed as err:  # logged by type name where it happened
            connection.send_error(msg["id"], ERR_SYNC_FAILED, str(err))
        except Exception:
            _LOGGER.exception("Hearth websocket command %s failed", msg["type"])
            connection.send_error(msg["id"], websocket_api.ERR_UNKNOWN_ERROR, "Unknown error")

    return wrapper


def _any_entry_for_user(hass: HomeAssistant, user_id: str) -> ConfigEntry | None:
    """The user's CRM in whatever state it is in."""
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.data.get(CONF_OWNER_USER_ID) == user_id:
            return entry
    return None


@websocket_api.websocket_command({"type": "hearth_crm/crm/status"})
@websocket_api.async_response
async def ws_status(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    entry = _any_entry_for_user(hass, connection.user.id)
    connection.send_result(
        msg["id"],
        {
            "has_crm": entry is not None,
            "loaded": entry_for_user(hass, connection.user.id) is not None,
            "entry_id": entry.entry_id if entry is not None else None,
        },
    )


@websocket_api.websocket_command({"type": "hearth_crm/crm/create"})
@websocket_api.async_response
async def ws_create_crm(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    user_id = connection.user.id
    locks: dict[str, asyncio.Lock] = hass.data.setdefault(DATA_CREATE_LOCKS, {})
    try:
        # One create at a time per user, so a double click cannot start two flows.
        async with locks.setdefault(user_id, asyncio.Lock()):
            entry = entry_for_user(hass, user_id)
            if entry is None and _any_entry_for_user(hass, user_id) is None:
                result = await hass.config_entries.flow.async_init(
                    DOMAIN,
                    context={"source": "self_service"},
                    data={CONF_OWNER_USER_ID: user_id},
                )
                reason = result.get("reason")
                if result["type"] is not FlowResultType.CREATE_ENTRY and reason not in (
                    "already_configured",
                    "already_in_progress",
                ):
                    connection.send_error(msg["id"], ERR_CREATE_FAILED, str(reason or "unknown"))
                    return
                entry = entry_for_user(hass, user_id)
            if entry is None:
                if _any_entry_for_user(hass, user_id) is not None:
                    connection.send_error(
                        msg["id"], ERR_NOT_LOADED, "Your Hearth CRM exists but is not loaded"
                    )
                else:
                    connection.send_error(msg["id"], ERR_CREATE_FAILED, "The CRM did not load")
                return
    except Exception:
        _LOGGER.exception("Could not create a Hearth CRM from the panel")
        connection.send_error(msg["id"], websocket_api.ERR_UNKNOWN_ERROR, "Unknown error")
        return
    connection.send_result(msg["id"], {"entry_id": entry.entry_id})


@websocket_api.websocket_command({"type": "hearth_crm/snapshot"})
@websocket_api.async_response
@_with_crm
async def ws_snapshot(hass, connection, msg, entry) -> None:
    snapshot = await hass.async_add_executor_job(entry.runtime_data.service.snapshot)
    owner_user_id = entry.runtime_data.owner_user_id
    for kind in ("people", "households", "groups"):
        for row in snapshot[kind]:
            row["photo_url"] = (
                signed_photo_url(hass, connection.refresh_token_id, owner_user_id, row["photo_hash"])
                if row["photo_hash"]
                else None
            )
    connection.send_result(msg["id"], snapshot)


@websocket_api.websocket_command({"type": "hearth_crm/subscribe"})
@websocket_api.async_response
@_with_crm
async def ws_subscribe(hass, connection, msg, entry) -> None:
    @callback
    def forward(notice: dict) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], notice))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_CHANGED.format(entry.entry_id), forward
    )
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        "type": "hearth_crm/create",
        probatio.Required("kind"): probatio.In(KINDS),
        probatio.Required("fields"): dict,
    }
)
@websocket_api.async_response
@_with_crm
async def ws_create(hass, connection, msg, entry) -> None:
    saved = await hass.async_add_executor_job(
        entry.runtime_data.service.create, msg["kind"], msg["fields"], SOURCE
    )
    _notify(hass, entry, msg["kind"], saved["id"], "create")
    connection.send_result(msg["id"], saved)


@websocket_api.websocket_command(
    {
        "type": "hearth_crm/update",
        probatio.Required("kind"): probatio.In(KINDS),
        probatio.Required("entity_id"): _ID,
        probatio.Required("changes"): dict,
    }
)
@websocket_api.async_response
@_with_crm
async def ws_update(hass, connection, msg, entry) -> None:
    saved = await hass.async_add_executor_job(
        entry.runtime_data.service.update, msg["kind"], msg["entity_id"], msg["changes"], SOURCE
    )
    _notify(hass, entry, msg["kind"], msg["entity_id"], "update")
    connection.send_result(msg["id"], saved)


@websocket_api.websocket_command(
    {
        "type": "hearth_crm/delete",
        probatio.Required("kind"): probatio.In(KINDS),
        probatio.Required("entity_id"): _ID,
    }
)
@websocket_api.async_response
@_with_crm
async def ws_delete(hass, connection, msg, entry) -> None:
    result = await hass.async_add_executor_job(
        entry.runtime_data.service.delete, msg["kind"], msg["entity_id"], SOURCE
    )
    _notify(hass, entry, msg["kind"], msg["entity_id"], "delete")
    connection.send_result(msg["id"], dataclasses.asdict(result))


@websocket_api.websocket_command(
    {
        "type": "hearth_crm/group/set_members",
        probatio.Required("group_id"): _ID,
        probatio.Required("person_ids"): [_ID],
    }
)
@websocket_api.async_response
@_with_crm
async def ws_set_members(hass, connection, msg, entry) -> None:
    saved = await hass.async_add_executor_job(
        entry.runtime_data.service.update,
        "contact_group",
        msg["group_id"],
        {"member_ids": msg["person_ids"]},
        SOURCE,
    )
    _notify(hass, entry, "contact_group", msg["group_id"], "update")
    connection.send_result(msg["id"], saved)


def _store_photo(service, kind: str, entity_id: str, data: str) -> str:
    """Decode and store a photo; runs in the executor, as decoding 3 MB is not instant."""
    try:
        image = base64.b64decode(data, validate=True)
    except ValueError:  # binascii.Error is a ValueError
        raise InvalidInput("data", "not valid base64") from None
    return service.set_photo(kind, entity_id, image, SOURCE)


@websocket_api.websocket_command(
    {
        "type": "hearth_crm/photo/set",
        probatio.Required("kind"): probatio.In(PHOTO_KINDS),
        probatio.Required("entity_id"): _ID,
        probatio.Required("data"): str,
    }
)
@websocket_api.async_response
@_with_crm
async def ws_photo_set(hass, connection, msg, entry) -> None:
    if len(msg["data"]) > MAX_PHOTO_DATA_CHARS:
        raise InvalidInput("data", "photo is too large")
    photo_hash = await hass.async_add_executor_job(
        _store_photo, entry.runtime_data.service, msg["kind"], msg["entity_id"], msg["data"]
    )
    _notify(hass, entry, msg["kind"], msg["entity_id"], "update")
    connection.send_result(msg["id"], {"photo_hash": photo_hash})


@websocket_api.websocket_command(
    {
        "type": "hearth_crm/photo/clear",
        probatio.Required("kind"): probatio.In(PHOTO_KINDS),
        probatio.Required("entity_id"): _ID,
    }
)
@websocket_api.async_response
@_with_crm
async def ws_photo_clear(hass, connection, msg, entry) -> None:
    await hass.async_add_executor_job(
        entry.runtime_data.service.clear_photo, msg["kind"], msg["entity_id"], SOURCE
    )
    _notify(hass, entry, msg["kind"], msg["entity_id"], "update")
    connection.send_result(msg["id"])


@websocket_api.websocket_command({"type": "hearth_crm/settings/get"})
@websocket_api.async_response
@_with_crm
async def ws_settings_get(hass, connection, msg, entry) -> None:
    settings = await hass.async_add_executor_job(entry.runtime_data.service.get_settings)
    connection.send_result(msg["id"], settings)


@websocket_api.websocket_command(
    {"type": "hearth_crm/settings/set", probatio.Required("changes"): dict}
)
@websocket_api.async_response
@_with_crm
async def ws_settings_set(hass, connection, msg, entry) -> None:
    settings = await hass.async_add_executor_job(
        entry.runtime_data.service.set_settings, msg["changes"], SOURCE
    )
    _notify(hass, entry, "settings", None, "update")
    connection.send_result(msg["id"], settings)


# -- Google Contacts sync -------------------------------------------------


@websocket_api.websocket_command({"type": "hearth_crm/google/status"})
@websocket_api.async_response
@_with_crm
async def ws_google_status(hass, connection, msg, entry) -> None:
    connection.send_result(msg["id"], await entry.runtime_data.google_sync.status())


@websocket_api.websocket_command(
    {"type": "hearth_crm/google/set_enabled", probatio.Required("enabled"): bool}
)
@websocket_api.async_response
@_with_crm
async def ws_google_set_enabled(hass, connection, msg, entry) -> None:
    runtime = entry.runtime_data
    try:
        await hass.async_add_executor_job(
            runtime.service.set_google_sync_enabled, msg["enabled"], SOURCE
        )
    except GoogleSyncRefused:
        connection.send_error(msg["id"], ERR_CUTOVER_NOT_CONFIRMED, CUTOVER_NOT_CONFIRMED_MESSAGE)
        return
    # This panel notice arms the 60 s debounce, so enabling starts a run about a minute later.
    _notify(hass, entry, "google", None, "update")
    connection.send_result(msg["id"], await runtime.google_sync.status())


@websocket_api.websocket_command({"type": "hearth_crm/google/sync_now"})
@websocket_api.async_response
@_with_crm
async def ws_google_sync_now(hass, connection, msg, entry) -> None:
    report = await entry.runtime_data.google_sync.sync_now()
    connection.send_result(msg["id"], report_to_dict(report))


@websocket_api.websocket_command({"type": "hearth_crm/google/preview"})
@websocket_api.async_response
@_with_crm
async def ws_google_preview(hass, connection, msg, entry) -> None:
    report = await entry.runtime_data.google_sync.sync_now(dry_run=True)
    connection.send_result(msg["id"], report_to_dict(report))


@websocket_api.websocket_command(
    {"type": "hearth_crm/google/clear_contact", probatio.Required("entity_id"): _ID}
)
@websocket_api.async_response
@_with_crm
async def ws_google_clear_contact(hass, connection, msg, entry) -> None:
    await hass.async_add_executor_job(
        entry.runtime_data.service.clear_google_contact, msg["entity_id"], SOURCE
    )
    _notify(hass, entry, "person", msg["entity_id"], "update")
    connection.send_result(msg["id"])
