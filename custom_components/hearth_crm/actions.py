"""The import, export, cutover and Google sync actions."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING

import probatio
from homeassistant.components import persistent_notification
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.util import dt as dt_util

from .access import async_check_owner_or_admin, entry_by_id
from .bundle import BundleError, read_bundle, write_bundle
from .const import (
    DOMAIN,
    EXPORTS_DIR,
    IMPORT_REPORT_FAILED_FILE,
    IMPORT_REPORT_FILE,
    IMPORTS_DIR,
    SIGNAL_CHANGED,
)
from .db import BackupInProgress, ImportRefusedError
from .google_runtime import GoogleSyncFailed
from .google_sync import report_to_dict
from .import_report import build_import_report
from .service import GoogleSyncRefused

if TYPE_CHECKING:
    from . import HearthConfigEntry

_LOGGER = logging.getLogger(__name__)

SERVICE_IMPORT = "import"
SERVICE_EXPORT = "export"
SERVICE_CUTOVER = "confirm_cutover"
SERVICE_GOOGLE_SYNC = "google_sync"
ATTR_CONFIG_ENTRY_ID = "config_entry_id"
ATTR_PATH = "path"
ATTR_REPLACE_EXISTING = "replace_existing"
ATTR_DRY_RUN = "dry_run"
NOTIFICATION_TITLE = "Hearth import"

ENTRY_SCHEMA = probatio.Schema({probatio.Required(ATTR_CONFIG_ENTRY_ID): cv.string})
IMPORT_SCHEMA = ENTRY_SCHEMA.extend(
    {
        probatio.Required(ATTR_PATH): cv.string,
        probatio.Optional(ATTR_REPLACE_EXISTING, default=False): cv.boolean,
    }
)

GOOGLE_SYNC_SCHEMA = ENTRY_SCHEMA.extend(
    {probatio.Optional(ATTR_DRY_RUN, default=False): cv.boolean}
)


class ImportFailed(HomeAssistantError):
    """An import was refused or the bundle was invalid; nothing was changed.

    ``reason`` is one of "invalid", "local_changes", "cutover_confirmed" or
    "backup_in_progress"; ``problems`` lists what is wrong with an invalid bundle.
    """

    def __init__(self, message: str, reason: str, problems: list[str] | None = None) -> None:
        super().__init__(message)
        self.reason = reason
        self.problems = list(problems or [])


def async_register_actions(hass: HomeAssistant) -> None:
    """Register the actions once, however many CRMs are set up."""

    async def import_bundle(call: ServiceCall) -> dict:
        entry = entry_by_id(hass, call.data[ATTR_CONFIG_ENTRY_ID])
        await async_check_owner_or_admin(hass, entry, call.context.user_id)
        return await _import_bundle(
            hass, entry, call.data[ATTR_PATH], call.data[ATTR_REPLACE_EXISTING]
        )

    async def export_bundle(call: ServiceCall) -> dict:
        entry = entry_by_id(hass, call.data[ATTR_CONFIG_ENTRY_ID])
        # Automations and scripts have no user; they may take scheduled backups.
        if call.context.user_id is not None:
            await async_check_owner_or_admin(hass, entry, call.context.user_id)
        return await _export_bundle(hass, entry)

    async def confirm_cutover(call: ServiceCall) -> None:
        entry = entry_by_id(hass, call.data[ATTR_CONFIG_ENTRY_ID])
        await async_check_owner_or_admin(hass, entry, call.context.user_id)
        # The database flag survives removing and re-adding the integration.
        await hass.async_add_executor_job(entry.runtime_data.repo.set_cutover_confirmed)

    async def google_sync(call: ServiceCall) -> dict:
        entry = entry_by_id(hass, call.data[ATTR_CONFIG_ENTRY_ID])
        await async_check_owner_or_admin(hass, entry, call.context.user_id)
        try:
            report = await entry.runtime_data.google_sync.sync_now(
                dry_run=call.data[ATTR_DRY_RUN]
            )
        except GoogleSyncRefused as err:
            raise ServiceValidationError(f"The Google sync did not run: {err}.") from None
        except GoogleSyncFailed as err:
            raise HomeAssistantError(str(err)) from None
        return report_to_dict(report)

    hass.services.async_register(
        DOMAIN, SERVICE_IMPORT, import_bundle, schema=IMPORT_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, SERVICE_EXPORT, export_bundle, schema=ENTRY_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(DOMAIN, SERVICE_CUTOVER, confirm_cutover, schema=ENTRY_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_GOOGLE_SYNC, google_sync, schema=GOOGLE_SYNC_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )


def _checked_path(entry: HearthConfigEntry, raw: str) -> Path:
    """Resolve ``raw`` inside this CRM's own imports folder; refuse anything that leaves it.

    A bare filename or relative path is relative to that folder. Symlinks and ``..`` are
    resolved first, so neither can reach another CRM's files or the rest of the config.
    """
    imports = (entry.runtime_data.data_dir / IMPORTS_DIR).resolve()
    path = Path(raw)
    path = (path if path.is_absolute() else imports / path).resolve()
    if path == imports or not path.is_relative_to(imports):
        raise ServiceValidationError(
            f"{raw} is not allowed. Put the bundle in this CRM's imports folder "
            f"({IMPORTS_DIR}/ inside its data folder) and give its name."
        )
    return path


async def _import_bundle(
    hass: HomeAssistant, entry: HearthConfigEntry, raw_path: str, replace_existing: bool
) -> dict:
    """Import the bundle at ``raw_path`` (inside this CRM's imports folder) into the CRM.

    Shared by the ``import`` action and the panel's upload endpoint. Raises ImportFailed for
    an invalid bundle or a refused import, after notifying and writing the failed report.
    """
    runtime = entry.runtime_data
    notification_id = f"hearth_crm_import_{runtime.owner_user_id}"
    report_path = runtime.data_dir / IMPORT_REPORT_FILE
    try:
        path = await hass.async_add_executor_job(_checked_path, entry, raw_path)
        bundle = await hass.async_add_executor_job(read_bundle, path)
        # Everything that can fail for a reason other than the database happens before it.
        report = await hass.async_add_executor_job(build_import_report, bundle.data)
        markdown = await hass.async_add_executor_job(report.to_markdown)
        await hass.async_add_executor_job(
            lambda: runtime.service.import_data(bundle, replace_existing=replace_existing)
        )
    except Exception as err:
        failed_path = runtime.data_dir / IMPORT_REPORT_FAILED_FILE
        failure = await _fail(hass, notification_id, failed_path, err)
        if failure is err:
            raise
        raise failure from err

    # The import is committed: nothing below may report it as failed.
    async_dispatcher_send(
        hass,
        SIGNAL_CHANGED.format(entry.entry_id),
        {"source": "import", "entity": "all", "entity_id": None, "action": "replace_all"},
    )
    summary = report.summary()
    note = f"Full report: {IMPORT_REPORT_FILE} in the CRM's folder."
    try:
        await hass.async_add_executor_job(report_path.write_text, markdown)
    except OSError as err:
        _LOGGER.error("Could not write the import report to %s: %s", report_path, err)
        note = "The report file could not be written; see the Home Assistant log."
    _notify(hass, notification_id, f"{summary}\n\n{note}")
    return {"summary": summary, "counts": report.counts, "report_path": str(report_path)}


async def _fail(
    hass: HomeAssistant, notification_id: str, report_path: Path, err: Exception
) -> Exception:
    """Tell the user an import failed. Notifications are seen by every user, so they stay short.

    Details go to the log and to ``report_path`` (the failed-import report, so the last
    successful import's report survives). Returns what the caller should raise: ``err``
    itself for a refused path, an ImportFailed for a known reason, else a HomeAssistantError.
    """
    if isinstance(err, ServiceValidationError):
        short = detail = str(err)
    elif isinstance(err, BundleError):
        short = f"The bundle is not valid ({len(err.problems)} problems); nothing was changed."
        detail = "The bundle is not valid; nothing was changed.\n\n" + "\n".join(
            f"- {problem}" for problem in err.problems
        )
        _LOGGER.error("Import refused, invalid bundle: %s", err)
    elif isinstance(err, ImportRefusedError):
        short = detail = _refusal_message(err)
    elif isinstance(err, BackupInProgress):
        short = detail = f"{err}. Nothing was changed."
    else:
        _LOGGER.exception("Unexpected error during the bundle import", exc_info=err)
        short = detail = f"Unexpected error ({type(err).__name__}); see the Home Assistant log."
    text = f"# Hearth import report\n\n## Failed import\n\n{detail}\n"
    note = f"Details: {IMPORT_REPORT_FAILED_FILE} in the CRM's folder."
    try:
        await hass.async_add_executor_job(report_path.write_text, text)
    except OSError as write_err:
        _LOGGER.error("Could not write the failed-import report: %s", write_err)
        note = "The report file could not be written; see the Home Assistant log."
    _notify(hass, notification_id, f"Import failed: {short}\n\n{note}")
    if isinstance(err, ServiceValidationError):
        return err
    if isinstance(err, BundleError):
        return ImportFailed(detail, "invalid", err.problems)
    if isinstance(err, ImportRefusedError):
        reason = "cutover_confirmed" if err.reason == "cutover" else err.reason
        return ImportFailed(short, reason)
    if isinstance(err, BackupInProgress):
        return ImportFailed(short, "backup_in_progress")
    return HomeAssistantError(short)


def _refusal_message(err: ImportRefusedError) -> str:
    if err.reason == "local_changes":
        return (
            f"{err} Nothing was changed. Pass replace_existing: true to discard those changes "
            "and import anyway."
        )
    return f"{err} Nothing was changed."


def _notify(hass: HomeAssistant, notification_id: str, message: str) -> None:
    try:
        persistent_notification.async_create(
            hass, message, title=NOTIFICATION_TITLE, notification_id=notification_id
        )
    except Exception:
        _LOGGER.exception("Could not post the import notification")


async def _export_bundle(hass: HomeAssistant, entry: HearthConfigEntry) -> dict:
    runtime = entry.runtime_data

    def export() -> Path:
        stamp = dt_util.utcnow().strftime("%Y%m%d-%H%M%S-%f")
        path = runtime.data_dir / EXPORTS_DIR / f"hearth-{stamp}.zip"
        path.parent.mkdir(parents=True, exist_ok=True)
        data, me_person_id = runtime.repo.export_state()
        write_bundle(
            path,
            data,
            lambda photo_hash: runtime.photos.path(photo_hash).read_bytes(),
            me_person_id=me_person_id,
        )
        return path

    try:
        path = await hass.async_add_executor_job(export)
    except Exception as err:
        _LOGGER.exception("Could not export the CRM")
        raise HomeAssistantError("The export failed; see the Home Assistant log.") from err
    return {"path": str(path)}
