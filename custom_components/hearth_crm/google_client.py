"""A thin client for the four Google People API calls the sync makes.

Create a contact, read its etag, update its four synced fields, and upload its photo.
Writes are paced to stay under the People API's per-user write quota (about 90 a minute);
429 and 5xx answers are retried with backoff. Nothing here deletes a contact or a photo,
looks a contact up by phone, email or name, or logs request bodies, headers or tokens.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import re
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any, ClassVar

import aiohttp
from homeassistant.exceptions import OAuth2TokenRequestBaseError

from .google_link import GoogleAuthError
from .google_payload import ERROR_CONTACT_MISSING, ERROR_CREATE_UNCERTAIN, UPDATE_FIELDS

_LOGGER = logging.getLogger(__name__)

BASE_URL = "https://people.googleapis.com/v1"
API_DISABLED_MESSAGE = "The Google People API is not enabled for this Google Cloud project."
SCOPE_MISSING_MESSAGE = "Hearth was not given access to your Google contacts."
CREATE_UNCERTAIN_MESSAGE = (
    "Google may have created this contact. Hearth will not retry it automatically."
)
MAX_REASON_LENGTH = 200
MAX_BACKOFF = 60.0
MAX_RETRY_AFTER = 120.0

_RESOURCE_NAME = re.compile(r"people/[A-Za-z0-9_-]+")
# Google's machine-readable codes (``status``, ``details[].reason``) look like this; anything
# else is dropped so the error can't echo request data back.
_CODE = re.compile(r"[A-Z][A-Z0-9_]{0,63}")
_DISABLED_REASONS = {"SERVICE_DISABLED", "ACCESS_NOT_CONFIGURED", "API_DISABLED"}
_DISABLED_PHRASES = ("has not been used", "is disabled", "not been enabled", "is not enabled")
_SCOPE_REASONS = {"ACCESS_TOKEN_SCOPE_INSUFFICIENT"}
_SCOPE_PHRASE = "insufficient authentication scopes"

Request = Callable[..., Awaitable[Any]]


class GoogleError(Exception):
    """Google refused a request. ``reason`` is short and never holds request data.

    ``stored_error`` is the ``google_sync_error`` value the planner acts on, for the
    errors that have one; store it rather than ``reason``.
    """

    stored_error: ClassVar[str | None] = None

    def __init__(self, status: int, reason: str) -> None:
        reason = reason[:MAX_REASON_LENGTH]
        super().__init__(reason)
        self.status = status
        self.reason = reason


class ContactMissing(GoogleError):
    """The contact no longer exists in Google (404, or marked deleted)."""

    stored_error: ClassVar[str | None] = ERROR_CONTACT_MISSING

    def __init__(
        self, status: int = HTTPStatus.NOT_FOUND, reason: str = ERROR_CONTACT_MISSING
    ) -> None:
        super().__init__(status, reason)


class CreateUncertain(GoogleError):
    """A create got no clear answer (5xx, unreadable reply, network error or timeout).

    Google may have committed the contact, and the People API has no idempotency key,
    so creating it again could make a duplicate. ``status`` is 0 when no HTTP answer
    arrived.
    """

    stored_error: ClassVar[str | None] = ERROR_CREATE_UNCERTAIN

    def __init__(self, status: int = 0) -> None:
        super().__init__(status, CREATE_UNCERTAIN_MESSAGE)


class AccessRefused(GoogleError):
    """A 403 for every request alike: the People API is off for the Cloud project, or the
    token lacks the contacts scope. Nothing was done; no other person will fare better."""


class InvalidResourceName(GoogleError):
    """A stored contact id isn't a People API resource name; nothing was sent."""

    def __init__(self) -> None:
        super().__init__(0, "not a People API contact resource name")


class RateLimited(GoogleError):
    """Google kept answering 429 after every retry."""

    def __init__(self, status: int, reason: str, retry_after: float | None = None) -> None:
        super().__init__(status, reason)
        self.retry_after = retry_after


@dataclass
class Created:
    """A contact just created in Google."""

    resource_name: str
    etag: str


class PeopleClient:
    """Makes the sync's People API calls through ``request`` (``GoogleLink.request``)."""

    def __init__(
        self,
        request: Request,
        *,
        sleep: Callable[[float], Awaitable[Any]] = asyncio.sleep,
        monotonic: Callable[[], float] = time.monotonic,
        min_write_interval: float = 1.0,
        max_retries: int = 5,
    ) -> None:
        self._request = request
        self._sleep = sleep
        self._monotonic = monotonic
        self._min_write_interval = min_write_interval
        self._max_retries = max_retries
        self._last_write: float | None = None
        self._write_lock = asyncio.Lock()

    async def create_contact(self, body: dict) -> Created:
        """Create a contact from a Person body; return its resource name and etag.

        Only a 429 is retried: Google refuses those before doing anything. Any answer
        that leaves it unclear whether the contact exists raises ``CreateUncertain``
        and is never retried, so one person can't become several contacts.
        """
        url = f"{BASE_URL}/people:createContact"
        try:
            status, data = await self._call("POST", url, body, write=True, create=True)
        except OAuth2TokenRequestBaseError:
            # The token refresh in ``GoogleLink.request`` failed before the POST was sent,
            # so nothing was created. Several of these subclass ``aiohttp.ClientError``,
            # so they must be let through before the catch below.
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError):
            # The POST itself failed: it may have reached Google, so the create is
            # uncertain. Raised ``from None`` because aiohttp errors can carry request info.
            raise CreateUncertain(0) from None
        resource_name = data.get("resourceName")
        etag = data.get("etag")
        if not isinstance(resource_name, str) or not isinstance(etag, str):
            raise CreateUncertain(status)
        return Created(resource_name=resource_name, etag=etag)

    async def get_etag(self, resource_name: str) -> str:
        """Read a contact's current etag. Raises ``ContactMissing`` if it is gone."""
        url = f"{BASE_URL}/{_checked(resource_name)}?personFields=names,metadata"
        status, data = await self._call("GET", url, None, write=False)
        metadata = data.get("metadata")
        if isinstance(metadata, dict) and metadata.get("deleted") is True:
            raise ContactMissing()
        etag = data.get("etag")
        if not isinstance(etag, str):
            raise GoogleError(status, "Google's reply had no etag")
        return etag

    async def update_contact(self, resource_name: str, etag: str, body: dict) -> None:
        """Replace the contact's names, phones, emails and addresses with ``body``.

        A PATCH retried after a 5xx that had in fact succeeded sends a now-stale etag
        and comes back as a 400. That reads as an error for this run and heals on the
        next one, which fetches a fresh etag.
        """
        url = (
            f"{BASE_URL}/{_checked(resource_name)}:updateContact"
            f"?updatePersonFields={UPDATE_FIELDS}"
        )
        await self._call("PATCH", url, {**body, "etag": etag}, write=True)

    async def update_photo(self, resource_name: str, jpeg: bytes) -> None:
        """Upload ``jpeg`` as the contact's photo."""
        url = f"{BASE_URL}/{_checked(resource_name)}:updateContactPhoto"
        body = {"photoBytes": base64.b64encode(jpeg).decode("ascii")}
        await self._call("POST", url, body, write=True)

    async def _call(
        self, method: str, url: str, body: dict | None, *, write: bool, create: bool = False
    ) -> tuple[int, dict]:
        """Send with pacing and retries; return the status and JSON body of a 2xx.

        With ``create``, a 5xx raises ``CreateUncertain`` instead of being retried, and a
        404 is a plain ``GoogleError`` rather than ``ContactMissing``.
        """
        kwargs = {} if body is None else {"json": body}
        attempt = 0
        while True:
            if write:
                await self._pace()
            resp = await self._request(method, url, **kwargs)
            try:
                status = resp.status
                data = await _read_json(resp)
                retry_after = _retry_after(resp.headers)
            finally:
                resp.release()

            if HTTPStatus.OK <= status < 300:
                return status, data
            if create and status >= 500:
                raise CreateUncertain(status)
            retryable = status == HTTPStatus.TOO_MANY_REQUESTS or status >= 500
            if not retryable:
                raise _error(status, data, missing_on_404=not create)
            if attempt >= self._max_retries:
                if status == HTTPStatus.TOO_MANY_REQUESTS:
                    raise RateLimited(status, _reason(status, data), retry_after)
                raise _error(status, data, missing_on_404=not create)
            delay = min(2.0**attempt, MAX_BACKOFF)
            if retry_after is not None:
                # Retry-After can lengthen the wait but never shorten the backoff.
                delay = max(delay, retry_after)
            attempt += 1
            _LOGGER.debug(
                "People API answered %s; retry %s of %s in %.1f s",
                status,
                attempt,
                self._max_retries,
                delay,
            )
            await self._sleep(delay)

    async def _pace(self) -> None:
        """Wait until at least ``min_write_interval`` has passed since the last write."""
        async with self._write_lock:
            if self._last_write is not None:
                wait = self._last_write + self._min_write_interval - self._monotonic()
                if wait > 0:
                    await self._sleep(wait)
            self._last_write = self._monotonic()


def _checked(resource_name: str) -> str:
    if not _RESOURCE_NAME.fullmatch(resource_name):
        raise InvalidResourceName()
    return resource_name


async def _read_json(resp: Any) -> dict:
    try:
        data = await resp.json(content_type=None)
    except (ValueError, aiohttp.ClientError):
        return {}
    return data if isinstance(data, dict) else {}


def _retry_after(headers: Any) -> float | None:
    """``Retry-After`` in seconds, capped; ``None`` if absent or not a number of seconds."""
    value = headers.get("Retry-After") if headers else None
    if value is None:
        return None
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        return None
    if seconds != seconds or seconds < 0:  # NaN or negative
        return None
    return min(seconds, MAX_RETRY_AFTER)


def _error(status: int, data: dict, *, missing_on_404: bool) -> GoogleError | GoogleAuthError:
    if status == HTTPStatus.UNAUTHORIZED:
        return GoogleAuthError("Google rejected Hearth's access; reconnect Google Contacts")
    if status == HTTPStatus.NOT_FOUND and missing_on_404:
        return ContactMissing(status)
    if status == HTTPStatus.FORBIDDEN and _api_disabled(data):
        return AccessRefused(status, API_DISABLED_MESSAGE)
    if status == HTTPStatus.FORBIDDEN and _scope_missing(data):
        return AccessRefused(status, SCOPE_MISSING_MESSAGE)
    return GoogleError(status, _reason(status, data))


def _error_body(data: dict) -> dict:
    error = data.get("error")
    return error if isinstance(error, dict) else {}


def _detail_codes(error: dict) -> list[str]:
    details = error.get("details")
    if not isinstance(details, list):
        return []
    codes = []
    for detail in details:
        code = detail.get("reason") if isinstance(detail, dict) else None
        if isinstance(code, str) and _CODE.fullmatch(code) and code not in codes:
            codes.append(code)
    return codes


def _api_disabled(data: dict) -> bool:
    error = _error_body(data)
    if error.get("status") != "PERMISSION_DENIED":
        return False
    if _DISABLED_REASONS.intersection(_detail_codes(error)):
        return True
    message = error.get("message")
    if not isinstance(message, str):
        return False
    message = message.lower()
    return "api" in message and any(phrase in message for phrase in _DISABLED_PHRASES)


def _scope_missing(data: dict) -> bool:
    error = _error_body(data)
    if error.get("status") != "PERMISSION_DENIED":
        return False
    if _SCOPE_REASONS.intersection(_detail_codes(error)):
        return True
    message = error.get("message")
    return isinstance(message, str) and _SCOPE_PHRASE in message.lower()


def _reason(status: int, data: dict) -> str:
    """A short reason from Google's codes only; its free-text message may echo our data."""
    error = _error_body(data)
    code = error.get("status")
    parts = [f"HTTP {status}"]
    if isinstance(code, str) and _CODE.fullmatch(code):
        parts.append(code)
    parts.extend(_detail_codes(error))
    return " ".join(parts)[:MAX_REASON_LENGTH]
