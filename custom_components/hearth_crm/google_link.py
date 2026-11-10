"""A CRM's link to its owner's Google account: authenticated requests, nothing more.

Nothing here talks to Google until ``request`` is called on a connected entry. Tokens and
headers are never logged.
"""

from __future__ import annotations

import asyncio
from http import HTTPStatus
from typing import Any

import aiohttp
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import OAuth2TokenRequestReauthError, UnknownImplementationError
from homeassistant.helpers import config_entry_oauth2_flow


class GoogleAuthError(Exception):
    """Hearth can't act for the owner on Google: not connected, the token can't be
    refreshed, or Google rejected it (401). Reconnecting Google Contacts fixes it."""


class GoogleLink:
    """Makes requests to Google with the entry's OAuth token, refreshing it when needed."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self._hass = hass
        self._entry = entry
        self._session: config_entry_oauth2_flow.OAuth2Session | None = None
        self._session_lock = asyncio.Lock()

    @property
    def connected(self) -> bool:
        """Whether the entry holds a Google token."""
        return "token" in self._entry.data

    async def request(self, method: str, url: str, **kwargs: Any) -> aiohttp.ClientResponse:
        """Send an authenticated request; the caller reads and releases the response.

        Raises ``GoogleAuthError`` when the entry is not connected, the token can't be
        refreshed, or Google answers 401. Other network and token-endpoint failures
        propagate as ``aiohttp.ClientError``.

        Callers map response statuses themselves. They must never call
        ``raise_for_status()`` or log ``request_info``: the resulting error's
        ``request_info.headers`` hold the bearer token.
        """
        if not self.connected:
            raise GoogleAuthError("Google Contacts is not connected")
        session = await self._async_session()
        try:
            await session.async_ensure_token_valid()
        except OAuth2TokenRequestReauthError as err:
            # OAuth2Session has already started a reauth flow.
            raise GoogleAuthError(
                "Google refused to renew Hearth's access; reconnect Google Contacts"
            ) from err
        resp = await config_entry_oauth2_flow.async_oauth2_request(
            self._hass, self._entry.data["token"], method, url, **kwargs
        )
        if resp.status == HTTPStatus.UNAUTHORIZED:
            resp.release()
            self._entry.async_start_reauth_if_available(self._hass)
            raise GoogleAuthError("Google rejected Hearth's access; reconnect Google Contacts")
        return resp

    async def _async_session(self) -> config_entry_oauth2_flow.OAuth2Session:
        # Locked so two first requests at the same moment build one session.
        async with self._session_lock:
            if self._session is None:
                try:
                    implementation = (
                        await config_entry_oauth2_flow.async_get_config_entry_implementation(
                            self._hass, self._entry
                        )
                    )
                except UnknownImplementationError as err:
                    # The Application Credentials this entry was connected with were removed.
                    self._entry.async_start_reauth_if_available(self._hass)
                    raise GoogleAuthError(
                        "Hearth's Google credentials are gone; reconnect Google Contacts"
                    ) from err
                self._session = config_entry_oauth2_flow.OAuth2Session(
                    self._hass, self._entry, implementation
                )
            return self._session
