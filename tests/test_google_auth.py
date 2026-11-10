"""Tests for connecting a Hearth CRM to Google with Home Assistant's OAuth flow."""

from __future__ import annotations

import asyncio
import time
from http import HTTPStatus
from unittest.mock import patch

import pytest
from homeassistant.components.application_credentials import (
    ClientCredential,
    async_import_client_credential,
)
from homeassistant.config_entries import SOURCE_RECONFIGURE, SOURCE_USER, ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers import config_entry_oauth2_flow
from homeassistant.loader import async_get_application_credentials
from homeassistant.setup import async_setup_component

from custom_components.hearth_crm import google_link
from custom_components.hearth_crm.config_flow import HearthConfigFlow
from custom_components.hearth_crm.const import (
    CONF_GOOGLE_ACCOUNT_ID,
    CONF_OWNER_USER_ID,
    DOMAIN,
    GOOGLE_SCOPE,
    OAUTH2_AUTHORIZE,
    OAUTH2_TOKEN,
)
from custom_components.hearth_crm.google_link import GoogleAuthError, GoogleLink

CLIENT_ID = "invented-client-id"
CLIENT_SECRET = "invented-client-secret"
REDIRECT_URI = "https://example.com/auth/external/callback"
PEOPLE_ME = "https://people.googleapis.com/v1/people/me"
ACCOUNT_LOOKUP = f"{PEOPLE_ME}?personFields=metadata"
ACCOUNT = "people/c1001"
OTHER_ACCOUNT = "people/c2002"


@pytest.fixture(autouse=True)
async def credentials(hass: HomeAssistant, enable_custom_integrations) -> None:
    """Add the Google OAuth client the way a user would in Application Credentials."""
    assert await async_setup_component(hass, "application_credentials", {})
    await async_import_client_credential(
        hass, DOMAIN, ClientCredential(CLIENT_ID, CLIENT_SECRET)
    )


def token(access: str, *, expires_at: float | None = None) -> dict:
    return {
        "access_token": access,
        "refresh_token": "invented-refresh-token",
        "token_type": "Bearer",
        "expires_in": 3599,
        "expires_at": time.time() + 3599 if expires_at is None else expires_at,
        "scope": GOOGLE_SCOPE,
    }


async def run_oauth(
    hass, hass_client_no_auth, aioclient_mock, result, access: str,
    *, account: str = ACCOUNT, lookup_status: HTTPStatus = HTTPStatus.OK,
    lookup: dict | None = None,
):
    """Walk an OAuth flow that reached the external step through Google's callback.

    Google answers the account lookup with ``account`` (or ``lookup_status``), or with
    ``lookup``'s mock arguments when given.
    """
    aioclient_mock.clear_requests()
    assert result["type"] is FlowResultType.EXTERNAL_STEP
    state = config_entry_oauth2_flow._encode_jwt(
        hass, {"flow_id": result["flow_id"], "redirect_uri": REDIRECT_URI}
    )
    assert result["url"] == (
        f"{OAUTH2_AUTHORIZE}?response_type=code&client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}&state={state}"
        "&scope=https://www.googleapis.com/auth/contacts&access_type=offline&prompt=consent"
    )
    client = await hass_client_no_auth()
    resp = await client.get(f"/auth/external/callback?code=invented-code&state={state}")
    assert resp.status == HTTPStatus.OK
    aioclient_mock.post(
        OAUTH2_TOKEN,
        json={
            "access_token": access,
            "refresh_token": "invented-refresh-token",
            "token_type": "Bearer",
            "expires_in": 3599,
            "scope": GOOGLE_SCOPE,
        },
    )
    if lookup is None:
        lookup = {
            "status": lookup_status,
            "json": {"resourceName": account} if lookup_status == HTTPStatus.OK else {"error": {}},
        }
    aioclient_mock.get(ACCOUNT_LOOKUP, **lookup)
    result = await hass.config_entries.flow.async_configure(result["flow_id"])
    await hass.async_block_till_done()
    return result


async def connect(
    hass, entry, access: str = "invented-access", *, account: str | None = ACCOUNT, **kw
) -> None:
    """Store a Google token (and account, unless None) on an entry directly and reload it."""
    data = {**entry.data, "auth_implementation": DOMAIN, "token": token(access, **kw)}
    if account is not None:
        data[CONF_GOOGLE_ACCOUNT_ID] = account
    hass.config_entries.async_update_entry(entry, data=data)
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()


async def test_reconfigure_connects_google_and_stores_the_token(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host,
):
    entry = await add_crm(hass_admin_user)
    assert not entry.runtime_data.google.connected

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_RECONFIGURE, "entry_id": entry.entry_id}
    )
    result = await run_oauth(hass, hass_client_no_auth, aioclient_mock, result, "first-access")

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    assert entry.data[CONF_OWNER_USER_ID] == hass_admin_user.id
    assert entry.data["auth_implementation"] == DOMAIN
    assert entry.data["token"]["access_token"] == "first-access"
    assert entry.data["token"]["refresh_token"] == "invented-refresh-token"
    assert entry.data[CONF_GOOGLE_ACCOUNT_ID] == ACCOUNT
    lookup = [c for c in aioclient_mock.mock_calls if str(c[1]) == ACCOUNT_LOOKUP]
    assert lookup and lookup[0][3]["Authorization"] == "Bearer first-access"
    assert entry.unique_id == hass_admin_user.id
    assert hass.config_entries.async_entries(DOMAIN) == [entry]
    assert entry.state is ConfigEntryState.LOADED
    assert entry.runtime_data.google.connected


async def test_reauth_replaces_a_dead_token(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host,
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry, "dead-access")

    entry.async_start_reauth(hass)
    await hass.async_block_till_done()
    [flow] = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    assert flow["step_id"] == "reauth_confirm"

    result = await hass.config_entries.flow.async_configure(flow["flow_id"], {})
    result = await run_oauth(hass, hass_client_no_auth, aioclient_mock, result, "fresh-access")

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reauth_successful"
    assert entry.data[CONF_OWNER_USER_ID] == hass_admin_user.id
    assert entry.data["token"]["access_token"] == "fresh-access"
    assert entry.data[CONF_GOOGLE_ACCOUNT_ID] == ACCOUNT
    assert hass.config_entries.async_entries(DOMAIN) == [entry]
    assert entry.state is ConfigEntryState.LOADED


async def test_user_flow_still_creates_a_crm_without_google(hass, hass_admin_user):
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {CONF_OWNER_USER_ID: hass_admin_user.id}
    )
    await hass.async_block_till_done()
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["data"] == {CONF_OWNER_USER_ID: hass_admin_user.id}
    assert "token" not in result["result"].data


async def test_an_oauth_flow_can_never_create_a_crm(hass, hass_admin_user):
    flow = HearthConfigFlow()
    flow.hass = hass
    flow.handler = DOMAIN
    flow.context = {"source": SOURCE_USER}

    result = await flow.async_oauth_create_entry(
        {"auth_implementation": DOMAIN, "token": token("stray-access")}
    )

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "google_needs_a_crm"
    assert hass.config_entries.async_entries(DOMAIN) == []


async def test_application_credentials_platform_names_google(hass):
    from custom_components.hearth_crm import application_credentials

    assert DOMAIN in await async_get_application_credentials(hass)
    server = await application_credentials.async_get_authorization_server(hass)
    assert server.authorize_url == OAUTH2_AUTHORIZE
    assert server.token_url == OAUTH2_TOKEN
    placeholders = await application_credentials.async_get_description_placeholders(hass)
    assert placeholders == {
        "oauth_consent_url": "https://console.cloud.google.com/apis/credentials/consent",
        "oauth_creds_url": "https://console.cloud.google.com/apis/credentials",
        "more_info_url": "https://github.com/iantrich/hearth#google-contacts",
    }


async def test_link_refreshes_an_expired_token_before_a_request(
    hass, hass_admin_user, add_crm, aioclient_mock
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry, "stale-access", expires_at=time.time() - 60)
    aioclient_mock.post(
        OAUTH2_TOKEN,
        json={"access_token": "renewed-access", "token_type": "Bearer", "expires_in": 3599},
    )
    aioclient_mock.get(PEOPLE_ME, json={"resourceName": "people/me"})

    link: GoogleLink = entry.runtime_data.google
    resp = await link.request("GET", PEOPLE_ME)

    assert resp.status == HTTPStatus.OK
    method, url, _data, headers = aioclient_mock.mock_calls[-1]
    assert (method, str(url)) == ("GET", PEOPLE_ME)
    assert headers["Authorization"] == "Bearer renewed-access"
    assert entry.data["token"]["access_token"] == "renewed-access"
    assert entry.data[CONF_OWNER_USER_ID] == hass_admin_user.id


async def test_link_reports_a_dead_refresh_token_as_an_auth_error(
    hass, hass_admin_user, add_crm, aioclient_mock, caplog
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry, "stale-access", expires_at=time.time() - 60)
    aioclient_mock.post(
        OAUTH2_TOKEN, status=HTTPStatus.BAD_REQUEST, json={"error": "invalid_grant"}
    )

    with pytest.raises(GoogleAuthError) as caught:
        await entry.runtime_data.google.request("GET", PEOPLE_ME)
    await hass.async_block_till_done()

    chain, err = [], caught.value
    while err is not None and err not in chain:
        chain.append(err)
        err = err.__cause__ or err.__context__
    for secret in ("stale-access", "invented-refresh-token", CLIENT_SECRET):
        assert secret not in caplog.text
        for link in chain:
            assert secret not in str(link)
            assert secret not in repr(link)
    assert not any(str(url) == PEOPLE_ME for _m, url, _d, _h in aioclient_mock.mock_calls)
    [flow] = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    assert flow["context"]["source"] == "reauth"


async def test_link_reports_a_rejected_token_as_an_auth_error(
    hass, hass_admin_user, add_crm, aioclient_mock
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry, "revoked-access")
    aioclient_mock.get(PEOPLE_ME, status=HTTPStatus.UNAUTHORIZED)

    with pytest.raises(GoogleAuthError) as caught:
        await entry.runtime_data.google.request("GET", PEOPLE_ME)
    await hass.async_block_till_done()

    assert "revoked-access" not in str(caught.value)
    [flow] = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    assert flow["context"]["source"] == "reauth"


async def test_setup_works_with_no_google_connection(
    hass, hass_admin_user, add_crm, aioclient_mock
):
    entry = await add_crm(hass_admin_user)

    assert entry.state is ConfigEntryState.LOADED
    link = entry.runtime_data.google
    assert isinstance(link, GoogleLink)
    assert not link.connected
    with pytest.raises(GoogleAuthError):
        await link.request("GET", PEOPLE_ME)
    assert aioclient_mock.call_count == 0


async def start_reauth(hass, entry):
    entry.async_start_reauth(hass)
    await hass.async_block_till_done()
    [flow] = hass.config_entries.flow.async_progress_by_handler(DOMAIN)
    return await hass.config_entries.flow.async_configure(flow["flow_id"], {})


async def start_reconfigure(hass, entry):
    return await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_RECONFIGURE, "entry_id": entry.entry_id}
    )


@pytest.mark.parametrize("start", [start_reauth, start_reconfigure])
async def test_reconnecting_a_different_google_account_is_refused(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host, start,
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry, "first-access")
    before = dict(entry.data)

    result = await start(hass, entry)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "other-access",
        account=OTHER_ACCOUNT,
    )

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "wrong_account"
    assert dict(entry.data) == before


async def test_a_failing_account_lookup_aborts_plainly(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host, caplog,
):
    entry = await add_crm(hass_admin_user)
    before = dict(entry.data)

    result = await start_reconfigure(hass, entry)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "unused-access",
        lookup_status=HTTPStatus.FORBIDDEN,
    )

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "people_api_unavailable"
    assert dict(entry.data) == before
    assert "unused-access" not in caplog.text


async def test_a_refused_account_lookup_logs_googles_reason_code(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host, caplog,
):
    entry = await add_crm(hass_admin_user)

    result = await start_reconfigure(hass, entry)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "unused-access",
        lookup={
            "status": HTTPStatus.FORBIDDEN,
            "json": {
                "error": {
                    "code": 403,
                    "status": "PERMISSION_DENIED",
                    "message": "The caller does not have permission",
                    "details": [{"reason": "SERVICE_DISABLED"}],
                }
            },
        },
    )

    assert result["reason"] == "people_api_unavailable"
    assert "HTTP 403 PERMISSION_DENIED SERVICE_DISABLED" in caplog.text
    assert "scopes granted: https://www.googleapis.com/auth/contacts" in caplog.text
    assert "Google said: The caller does not have permission" in caplog.text
    assert "unused-access" not in caplog.text


@pytest.mark.parametrize(
    "lookup",
    [
        {"text": "<html>not json</html>"},
        {"json": {"etag": "invented-etag"}},
        {"json": {"resourceName": ""}},
        {"json": ["people/c1001"]},
        {"exc": TimeoutError()},
    ],
    ids=["not-json", "no-resource-name", "empty-resource-name", "not-an-object", "timeout"],
)
async def test_an_unreadable_account_lookup_aborts_plainly(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host, caplog, lookup,
):
    entry = await add_crm(hass_admin_user)
    before = dict(entry.data)

    result = await start_reconfigure(hass, entry)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "unused-access", lookup=lookup
    )

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "people_api_unavailable"
    assert dict(entry.data) == before
    assert "unused-access" not in caplog.text


async def test_an_entry_connected_before_accounts_were_recorded_records_one(
    hass, hass_admin_user, add_crm, hass_client_no_auth, aioclient_mock,
    current_request_with_host,
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry, "old-access", account=None)
    assert CONF_GOOGLE_ACCOUNT_ID not in entry.data

    result = await start_reauth(hass, entry)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "new-access", account=OTHER_ACCOUNT
    )

    assert result["reason"] == "reauth_successful"
    assert entry.data[CONF_GOOGLE_ACCOUNT_ID] == OTHER_ACCOUNT
    assert entry.data["token"]["access_token"] == "new-access"


async def test_connecting_one_crm_leaves_another_alone(
    hass, hass_admin_user, hass_read_only_user, add_crm, hass_client_no_auth,
    aioclient_mock, current_request_with_host,
):
    first = await add_crm(hass_admin_user)
    second = await add_crm(hass_read_only_user)
    before = dict(second.data)

    result = await start_reconfigure(hass, first)
    result = await run_oauth(hass, hass_client_no_auth, aioclient_mock, result, "first-access")

    assert result["reason"] == "reconfigure_successful"
    assert first.data["token"]["access_token"] == "first-access"
    assert dict(second.data) == before
    assert not second.runtime_data.google.connected


async def test_a_google_account_linked_to_another_crm_is_refused(
    hass, hass_admin_user, hass_read_only_user, add_crm, hass_client_no_auth,
    aioclient_mock, current_request_with_host,
):
    first = await add_crm(hass_admin_user)
    await connect(hass, first, "first-access", account=ACCOUNT)
    second = await add_crm(hass_read_only_user)
    before = dict(second.data)

    result = await start_reconfigure(hass, second)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "second-access", account=ACCOUNT
    )

    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "account_in_use"
    assert dict(second.data) == before
    assert first.data[CONF_GOOGLE_ACCOUNT_ID] == ACCOUNT

    # The CRM that holds the account can still reconnect with it.
    result = await start_reauth(hass, first)
    result = await run_oauth(
        hass, hass_client_no_auth, aioclient_mock, result, "fresh-access", account=ACCOUNT
    )
    assert result["reason"] == "reauth_successful"


async def test_two_first_requests_build_one_session(
    hass, hass_admin_user, add_crm, aioclient_mock
):
    entry = await add_crm(hass_admin_user)
    await connect(hass, entry)
    aioclient_mock.get(PEOPLE_ME, json={"resourceName": ACCOUNT})
    real = google_link.config_entry_oauth2_flow.async_get_config_entry_implementation
    lookups = 0

    async def slow_lookup(hass, entry):
        nonlocal lookups
        lookups += 1
        await asyncio.sleep(0)
        return await real(hass, entry)

    with patch.object(
        google_link.config_entry_oauth2_flow,
        "async_get_config_entry_implementation",
        slow_lookup,
    ):
        link = entry.runtime_data.google
        await asyncio.gather(link.request("GET", PEOPLE_ME), link.request("GET", PEOPLE_ME))

    assert lookups == 1
