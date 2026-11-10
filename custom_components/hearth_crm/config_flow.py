"""Config flow for Hearth: one CRM per Home Assistant user, optionally connected to Google.

"Add integration" creates a CRM (the owner picker). Reconfigure connects an existing CRM to
its owner's Google Contacts through Home Assistant's OAuth flow, and reauth replaces a dead
token. The OAuth steps only ever update an existing entry; they never create a CRM.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from typing import Any

import aiohttp
import probatio
from homeassistant.config_entries import (
    SOURCE_REAUTH,
    SOURCE_RECONFIGURE,
    ConfigEntry,
    ConfigFlowResult,
)
from homeassistant.helpers import config_entry_oauth2_flow
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import (
    CONF_GOOGLE_ACCOUNT_ID,
    CONF_OWNER_USER_ID,
    DOMAIN,
    GOOGLE_PEOPLE_ME,
    GOOGLE_SCOPE,
)
from .google_client import reason_for

SOURCE_SELF_SERVICE = "self_service"
ACCOUNT_LOOKUP_TIMEOUT = 30


_LOGGER = logging.getLogger(__name__)


class HearthConfigFlow(config_entry_oauth2_flow.AbstractOAuth2FlowHandler, domain=DOMAIN):
    """Create the CRM of one Home Assistant user, or connect one to Google."""

    DOMAIN = DOMAIN
    VERSION = 1

    @property
    def logger(self) -> logging.Logger:
        """Return the logger the OAuth steps write to."""
        return _LOGGER

    @property
    def extra_authorize_data(self) -> dict[str, Any]:
        """Ask for contacts access and a refresh token."""
        return {"scope": GOOGLE_SCOPE, "access_type": "offline", "prompt": "consent"}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Let an administrator pick whose CRM to create."""
        users = [
            user
            for user in await self.hass.auth.async_get_users()
            if user.is_active and not user.system_generated
        ]
        if user_input is not None:
            return await self._async_create(user_input[CONF_OWNER_USER_ID])
        if not users:
            return self.async_abort(reason="no_users")
        schema = probatio.Schema(
            {
                probatio.Required(CONF_OWNER_USER_ID): SelectSelector(
                    SelectSelectorConfig(
                        options=[
                            SelectOptionDict(value=user.id, label=user.name or user.id)
                            for user in users
                        ],
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                )
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    async def async_step_self_service(self, data: dict[str, Any]) -> ConfigFlowResult:
        """Create the CRM of the user who asked for it from the panel."""
        return await self._async_create(data[CONF_OWNER_USER_ID])

    async def _async_create(self, owner_user_id: str) -> ConfigFlowResult:
        user = await self.hass.auth.async_get_user(owner_user_id)
        if user is None or not user.is_active or user.system_generated:
            return self.async_abort(reason="invalid_user")
        await self.async_set_unique_id(owner_user_id)
        self._abort_if_unique_id_configured()
        return self.async_create_entry(
            title=f"Hearth ({user.name})", data={CONF_OWNER_USER_ID: owner_user_id}
        )

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Connect this CRM to its owner's Google Contacts (or reconnect it)."""
        return await self._async_start_oauth(self._get_reconfigure_entry())

    async def async_step_reauth(self, entry_data: Mapping[str, Any]) -> ConfigFlowResult:
        """Google stopped accepting this CRM's token."""
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Ask before sending the owner to Google again."""
        if user_input is None:
            return self.async_show_form(step_id="reauth_confirm")
        return await self._async_start_oauth(self._get_reauth_entry())

    async def _async_start_oauth(self, entry: ConfigEntry) -> ConfigFlowResult:
        # Reuse the credentials the entry was connected with; the base class falls back to
        # picking (or asking for) credentials when those were removed or never chosen.
        if (implementation := entry.data.get("auth_implementation")) is not None:
            return await self.async_step_pick_implementation({"implementation": implementation})
        return await self.async_step_pick_implementation()

    async def async_oauth_create_entry(self, data: dict[str, Any]) -> ConfigFlowResult:
        """Store the token on the CRM being connected, keeping its owner and Google account."""
        if self.source == SOURCE_RECONFIGURE:
            entry = self._get_reconfigure_entry()
        elif self.source == SOURCE_REAUTH:
            entry = self._get_reauth_entry()
        else:
            return self.async_abort(reason="google_needs_a_crm")
        account_id = await self._async_google_account_id(data["token"]["access_token"])
        if account_id is None:
            return self.async_abort(reason="people_api_unavailable")
        # An entry connected before accounts were recorded has none yet and records this one.
        known = entry.data.get(CONF_GOOGLE_ACCOUNT_ID)
        if known is not None and known != account_id:
            return self.async_abort(reason="wrong_account")
        # Two CRMs syncing into one Google account would each create their own contacts.
        if any(
            other.entry_id != entry.entry_id
            and other.data.get(CONF_GOOGLE_ACCOUNT_ID) == account_id
            for other in self._async_current_entries(include_ignore=False)
        ):
            return self.async_abort(reason="account_in_use")
        return self.async_update_reload_and_abort(
            entry, data_updates={**data, CONF_GOOGLE_ACCOUNT_ID: account_id}
        )

    async def _async_google_account_id(self, access_token: str) -> str | None:
        """The signed-in account's People API resourceName, or None if it can't be read.

        Nothing about the request or the token is logged.
        """
        session = async_get_clientsession(self.hass)
        try:
            async with asyncio.timeout(ACCOUNT_LOOKUP_TIMEOUT):
                async with session.get(
                    GOOGLE_PEOPLE_ME,
                    params={"personFields": "metadata"},
                    headers={"Authorization": f"Bearer {access_token}"},
                ) as resp:
                    if resp.status != 200:
                        try:
                            failure = await resp.json()
                        except (aiohttp.ClientError, ValueError):
                            failure = None
                        _LOGGER.warning(
                            "Could not read the Google account (%s)",
                            reason_for(resp.status, failure),
                        )
                        return None
                    body = await resp.json()
        except (TimeoutError, aiohttp.ClientError, ValueError):
            _LOGGER.warning("Could not read the Google account")
            return None
        account_id = body.get("resourceName") if isinstance(body, dict) else None
        return account_id if isinstance(account_id, str) and account_id else None
