"""The authenticated views: per-owner photos, and uploading a bundle to import."""

from __future__ import annotations

import logging
from http import HTTPStatus
from pathlib import Path
from typing import TYPE_CHECKING, BinaryIO

from aiohttp import BodyPartReader, web
from homeassistant.components.http import KEY_HASS_USER, HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.http import KEY_HASS
from homeassistant.util import dt as dt_util

from .access import entry_for_user
from .actions import ImportFailed, _import_bundle
from .const import IMPORTS_DIR

if TYPE_CHECKING:
    from . import HearthConfigEntry

_LOGGER = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 1_073_741_824
UPLOAD_CHUNK_BYTES = 1 << 20

PHOTO_HEADERS = {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
}


class HearthPhotoView(HomeAssistantView):
    """Serve ``/api/hearth_crm/photos/<owner>/<hash>``.

    Signed paths (``auth/sign_path``) also work, because the view requires auth.
    """

    url = "/api/hearth_crm/photos/{owner_user_id}/{photo_hash}"
    name = "api:hearth_crm:photo"
    requires_auth = True

    async def get(
        self, request: web.Request, owner_user_id: str, photo_hash: str
    ) -> web.StreamResponse:
        user = request.get(KEY_HASS_USER)
        if user is None:
            return web.Response(status=HTTPStatus.UNAUTHORIZED)
        # Decide who may ask before looking anything up, so nobody else can probe what exists.
        if user.id != owner_user_id and not user.is_admin:
            return web.Response(status=HTTPStatus.FORBIDDEN)

        hass = request.app[KEY_HASS]
        entry = entry_for_user(hass, owner_user_id)
        if entry is None:
            return web.Response(status=HTTPStatus.NOT_FOUND)
        photos = entry.runtime_data.photos
        try:
            path = photos.path(photo_hash)
        except ValueError:
            return web.Response(status=HTTPStatus.NOT_FOUND)
        if not await hass.async_add_executor_job(photos.exists, photo_hash):
            return web.Response(status=HTTPStatus.NOT_FOUND)
        return web.FileResponse(path, headers=PHOTO_HEADERS)


class _UploadTooLarge(Exception):
    """The uploaded file passed MAX_UPLOAD_BYTES."""


class HearthImportView(HomeAssistantView):
    """``POST /api/hearth_crm/import``: upload a bundle into the caller's own CRM and import it.

    The body is multipart/form-data with a ``file`` part and an optional ``replace_existing``
    part ("true" or "false"). The CRM is always the caller's own; nothing in the request
    names one. The file streams to disk, so its size is not limited by aiohttp's
    ``client_max_size``, only by MAX_UPLOAD_BYTES.
    """

    url = "/api/hearth_crm/import"
    name = "api:hearth_crm:import"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        user = request.get(KEY_HASS_USER)
        if user is None:
            return web.Response(status=HTTPStatus.UNAUTHORIZED)
        hass = request.app[KEY_HASS]
        entry = entry_for_user(hass, user.id)
        if entry is None:
            return self.json({"reason": "no_crm"}, HTTPStatus.NOT_FOUND)

        try:
            reader = await request.multipart()
        except (AssertionError, ValueError, KeyError):  # not a multipart body
            return self.json({"reason": "bad_request"}, HTTPStatus.BAD_REQUEST)

        path: Path | None = None
        replace_existing = False
        try:
            while (part := await reader.next()) is not None:
                if not isinstance(part, BodyPartReader):
                    continue  # a nested multipart: not something this view takes
                if part.name == "file" and path is None:
                    path = await _save_upload(hass, entry, part)
                elif part.name == "replace_existing":
                    value = await part.text()
                    if value not in ("true", "false"):
                        raise ValueError("replace_existing must be true or false")
                    replace_existing = value == "true"
            if path is None:
                raise ValueError("no file part")
        except _UploadTooLarge:
            return self.json({"reason": "too_large"}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        except ValueError:
            await _remove(hass, path)
            return self.json({"reason": "bad_request"}, HTTPStatus.BAD_REQUEST)
        except BaseException:
            await _remove(hass, path)
            raise

        # Uploads are not kept: each could be up to 1 GiB, in every Home Assistant backup.
        # Only an unexpected error keeps the file, so it can be looked at.
        keep = False
        try:
            result = await _import_bundle(hass, entry, path.name, replace_existing)
        except ImportFailed as err:
            return self.json(
                {"reason": err.reason, "message": str(err), "problems": err.problems},
                HTTPStatus.UNPROCESSABLE_ENTITY,
            )
        except Exception:
            keep = True
            _LOGGER.error("The uploaded bundle that failed to import is kept at %s", path)
            raise
        finally:
            if not keep:
                await _remove(hass, path)
        return self.json({"summary": result["summary"], "counts": result["counts"]})


async def _save_upload(
    hass: HomeAssistant, entry: HearthConfigEntry, part: BodyPartReader
) -> Path:
    """Stream ``part`` to a new file in the CRM's imports folder; never the client's filename.

    On any failure, including passing MAX_UPLOAD_BYTES, the partial file is removed.
    """
    stamp = dt_util.utcnow().strftime("%Y%m%d-%H%M%S-%f")
    path = entry.runtime_data.data_dir / IMPORTS_DIR / f"upload-{stamp}.zip"

    def open_new() -> BinaryIO:
        path.parent.mkdir(parents=True, exist_ok=True)
        return path.open("xb")

    out = await hass.async_add_executor_job(open_new)
    size = 0
    try:
        try:
            while chunk := await part.read_chunk(UPLOAD_CHUNK_BYTES):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise _UploadTooLarge
                await hass.async_add_executor_job(out.write, chunk)
        finally:
            await hass.async_add_executor_job(out.close)
    except BaseException:
        await _remove(hass, path)
        raise
    return path


async def _remove(hass: HomeAssistant, path: Path | None) -> None:
    if path is not None:
        await hass.async_add_executor_job(lambda: path.unlink(missing_ok=True))
