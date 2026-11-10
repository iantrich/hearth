"""Tests for the thin Google People API client: calls, pacing, retries and error mapping.

A scripted fake stands in for ``GoogleLink.request`` and a fake clock for ``sleep`` and
``monotonic``, so no test makes real HTTP calls or waits in real time.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any

import aiohttp
import pytest
from homeassistant.exceptions import (
    OAuth2TokenRequestConnectionError,
    OAuth2TokenRequestTransientError,
)
from yarl import URL

from custom_components.hearth_crm.google_client import (
    AccessRefused,
    CREATE_UNCERTAIN_MESSAGE,
    ContactMissing,
    Created,
    CreateUncertain,
    GoogleError,
    InvalidResourceName,
    PeopleClient,
    RateLimited,
)
from custom_components.hearth_crm.google_link import GoogleAuthError
from custom_components.hearth_crm.const import DOMAIN
from custom_components.hearth_crm.google_payload import (
    ERROR_CONTACT_MISSING,
    ERROR_CREATE_UNCERTAIN,
    UPDATE_FIELDS,
)

BASE = "https://people.googleapis.com/v1"
RESOURCE = "people/c1001"
PHONE = "402-555-0142"
TOKEN = "ya29.invented-access-token"
BODY = {
    "names": [{"givenName": "Rowan", "familyName": "Testwood"}],
    "phoneNumbers": [{"value": PHONE, "type": "mobile"}],
}


class FakeResponse:
    def __init__(self, status: int, body: Any = None, headers: dict[str, str] | None = None):
        self.status = status
        self._body = body
        self.headers = headers or {}
        self.released = False

    async def json(self, **_kwargs: Any) -> Any:
        if isinstance(self._body, Exception):
            raise self._body
        return self._body

    def release(self) -> None:
        self.released = True


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


class ScriptedRequest:
    """Answers each call with the next scripted response and records what was sent.

    A scripted exception is raised instead of answering, like a network failure.
    """

    def __init__(self, clock: FakeClock, responses: list[FakeResponse]) -> None:
        self._clock = clock
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []
        self.sent: list[FakeResponse] = []

    async def __call__(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"method": method, "url": url, "at": self._clock.now, **kwargs})
        resp = self._responses.pop(0)
        if isinstance(resp, BaseException):
            raise resp
        self.sent.append(resp)
        return resp


def make(responses: list[FakeResponse], **kwargs: Any) -> tuple[PeopleClient, ScriptedRequest, FakeClock]:
    clock = FakeClock()
    request = ScriptedRequest(clock, responses)
    client = PeopleClient(request, sleep=clock.sleep, monotonic=clock.monotonic, **kwargs)
    return client, request, clock


def google_error(code: int, status: str, message: str, reasons: tuple[str, ...] = ()) -> dict:
    details = [
        {"@type": "type.googleapis.com/google.rpc.ErrorInfo", "reason": reason}
        for reason in reasons
    ]
    return {"error": {"code": code, "message": message, "status": status, "details": details}}


async def test_create_returns_the_resource_name_and_etag():
    client, request, _ = make([FakeResponse(200, {"resourceName": RESOURCE, "etag": "%EgUBAi4"})])

    created = await client.create_contact(BODY)

    assert created == Created(resource_name=RESOURCE, etag="%EgUBAi4")
    [call] = request.calls
    assert call["method"] == "POST"
    assert call["url"] == f"{BASE}/people:createContact"
    assert call["json"] == BODY
    assert request.sent[0].released


async def test_get_etag_reads_the_etag():
    client, request, _ = make([FakeResponse(200, {"etag": "%Etag1", "metadata": {}})])

    assert await client.get_etag(RESOURCE) == "%Etag1"
    [call] = request.calls
    assert call["method"] == "GET"
    assert call["url"] == f"{BASE}/{RESOURCE}?personFields=names,metadata"


async def test_update_sends_the_etag_and_only_the_four_fields_mask():
    client, request, _ = make([FakeResponse(200, {"resourceName": RESOURCE, "etag": "%Etag2"})])

    await client.update_contact(RESOURCE, "%Etag1", BODY)

    [call] = request.calls
    assert call["method"] == "PATCH"
    assert UPDATE_FIELDS == "names,phoneNumbers,emailAddresses,addresses"
    assert call["url"] == f"{BASE}/{RESOURCE}:updateContact?updatePersonFields={UPDATE_FIELDS}"
    assert call["json"] == {**BODY, "etag": "%Etag1"}
    assert "etag" not in BODY  # the caller's body is not mutated


async def test_update_photo_sends_base64_bytes():
    client, request, _ = make([FakeResponse(200, {})])
    jpeg = b"\xff\xd8\xff\xe0invented-jpeg"

    await client.update_photo(RESOURCE, jpeg)

    [call] = request.calls
    assert call["method"] == "POST"
    assert call["url"] == f"{BASE}/{RESOURCE}:updateContactPhoto"
    assert call["json"] == {"photoBytes": base64.b64encode(jpeg).decode("ascii")}


async def test_a_404_on_the_etag_fetch_means_the_contact_is_missing():
    client, _, _ = make([FakeResponse(404, google_error(404, "NOT_FOUND", "Not found"))])

    with pytest.raises(ContactMissing) as err:
        await client.get_etag(RESOURCE)
    assert err.value.status == 404
    assert err.value.reason == ERROR_CONTACT_MISSING


async def test_a_404_on_update_means_the_contact_is_missing():
    client, _, _ = make([FakeResponse(404, google_error(404, "NOT_FOUND", "Not found"))])

    with pytest.raises(ContactMissing):
        await client.update_contact(RESOURCE, "%Etag1", BODY)


async def test_metadata_that_is_not_an_object_is_ignored():
    client, _, _ = make([FakeResponse(200, {"etag": "%E", "metadata": ["odd"]})])

    assert await client.get_etag(RESOURCE) == "%E"


async def test_a_404_on_create_is_a_plain_google_error():
    client, _, _ = make([FakeResponse(404, google_error(404, "NOT_FOUND", "Not found"))])

    with pytest.raises(GoogleError) as err:
        await client.create_contact(BODY)

    assert type(err.value) is GoogleError
    assert err.value.status == 404


async def test_a_5xx_on_create_is_never_retried():
    client, request, clock = make([FakeResponse(503, google_error(503, "UNAVAILABLE", "Later"))])

    with pytest.raises(CreateUncertain) as err:
        await client.create_contact(BODY)

    assert len(request.calls) == 1
    assert clock.sleeps == []
    assert err.value.status == 503
    assert err.value.reason == CREATE_UNCERTAIN_MESSAGE
    assert isinstance(err.value, GoogleError)


async def test_a_429_on_create_is_still_retried():
    client, request, _ = make(
        [
            FakeResponse(429, google_error(429, "RESOURCE_EXHAUSTED", "Quota")),
            FakeResponse(200, {"resourceName": RESOURCE, "etag": "%E"}),
        ]
    )

    assert (await client.create_contact(BODY)).resource_name == RESOURCE
    assert len(request.calls) == 2


@pytest.mark.parametrize(
    "body",
    [ValueError("not json"), {}, {"resourceName": RESOURCE}, {"etag": "%E"}, ["odd"]],
)
async def test_an_unreadable_create_reply_is_uncertain(body):
    client, request, _ = make([FakeResponse(200, body)])

    with pytest.raises(CreateUncertain) as err:
        await client.create_contact(BODY)

    assert err.value.status == 200
    assert len(request.calls) == 1


@pytest.mark.parametrize(
    "failure", [aiohttp.ClientConnectionError("reset"), asyncio.TimeoutError()]
)
async def test_a_network_error_on_create_is_uncertain(failure):
    client, request, _ = make([failure])

    with pytest.raises(CreateUncertain) as err:
        await client.create_contact(BODY)

    assert err.value.status == 0
    assert err.value.__cause__ is None
    assert len(request.calls) == 1


def _transient_token_error() -> OAuth2TokenRequestTransientError:
    token_url = URL("https://oauth2.googleapis.com/token")
    info = aiohttp.RequestInfo(token_url, "POST", {}, token_url)
    return OAuth2TokenRequestTransientError(request_info=info, status=503, domain=DOMAIN)


@pytest.mark.parametrize(
    "failure",
    [
        pytest.param(lambda: OAuth2TokenRequestConnectionError(domain=DOMAIN), id="connection"),
        pytest.param(_transient_token_error, id="transient"),
    ],
)
async def test_a_failed_token_refresh_on_create_is_not_uncertain(failure):
    error = failure()
    assert isinstance(error, aiohttp.ClientError)  # why it must be let through first
    client, request, _ = make([error])

    with pytest.raises(type(error)) as err:
        await client.create_contact(BODY)

    assert err.value is error
    assert not isinstance(err.value, CreateUncertain)
    assert len(request.calls) == 1


async def test_a_plain_client_error_from_the_create_post_is_uncertain():
    client, _, _ = make([aiohttp.ClientError("boom")])

    with pytest.raises(CreateUncertain) as err:
        await client.create_contact(BODY)
    assert err.value.status == 0


async def test_an_auth_error_during_create_propagates_unchanged():
    error = GoogleAuthError("Google rejected Hearth's access; reconnect Google Contacts")
    client, request, _ = make([error])

    with pytest.raises(GoogleAuthError) as err:
        await client.create_contact(BODY)

    assert err.value is error
    assert len(request.calls) == 1


async def test_a_429_then_a_5xx_on_create_is_uncertain():
    client, request, clock = make([FakeResponse(429, {}), FakeResponse(503, {})])

    with pytest.raises(CreateUncertain) as err:
        await client.create_contact(BODY)

    assert err.value.status == 503
    assert len(request.calls) == 2
    assert clock.sleeps == [1.0]


async def test_a_429_then_a_network_error_on_create_is_uncertain():
    client, request, _ = make([FakeResponse(429, {}), aiohttp.ClientConnectionError("reset")])

    with pytest.raises(CreateUncertain) as err:
        await client.create_contact(BODY)

    assert err.value.status == 0
    assert len(request.calls) == 2


def test_stored_errors_match_the_planner_constants():
    assert ContactMissing.stored_error == ERROR_CONTACT_MISSING
    assert CreateUncertain.stored_error == ERROR_CREATE_UNCERTAIN
    assert ContactMissing().stored_error == ERROR_CONTACT_MISSING
    assert CreateUncertain(503).stored_error == ERROR_CREATE_UNCERTAIN
    assert GoogleError(400, "HTTP 400").stored_error is None
    assert RateLimited(429, "HTTP 429").stored_error is None


async def test_a_timeout_reading_the_create_reply_is_uncertain():
    client, _, _ = make([FakeResponse(200, asyncio.TimeoutError())])

    with pytest.raises(CreateUncertain):
        await client.create_contact(BODY)


@pytest.mark.parametrize(
    "failure", [aiohttp.ClientConnectionError("reset"), asyncio.TimeoutError()]
)
async def test_network_errors_on_reads_and_updates_propagate(failure):
    client, _, _ = make([failure, failure, failure])

    with pytest.raises(type(failure)):
        await client.get_etag(RESOURCE)
    with pytest.raises(type(failure)):
        await client.update_contact(RESOURCE, "%E", BODY)
    with pytest.raises(type(failure)):
        await client.update_photo(RESOURCE, b"jpeg")


async def test_a_deleted_flag_means_the_contact_is_missing():
    client, _, _ = make([FakeResponse(200, {"etag": "%Etag1", "metadata": {"deleted": True}})])

    with pytest.raises(ContactMissing):
        await client.get_etag(RESOURCE)


async def test_writes_are_paced():
    ok = {"resourceName": RESOURCE, "etag": "%E"}
    client, request, clock = make(
        [
            FakeResponse(200, ok),
            FakeResponse(200, {"etag": "%E", "metadata": {}}),
            FakeResponse(200, {"etag": "%E", "metadata": {}}),
            FakeResponse(200, ok),
            FakeResponse(200, {}),
        ],
        min_write_interval=1.0,
    )

    await client.create_contact(BODY)
    await client.get_etag(RESOURCE)
    await client.get_etag(RESOURCE)
    clock.now += 0.25  # some local work between calls
    await client.update_contact(RESOURCE, "%E", BODY)
    await client.update_photo(RESOURCE, b"jpeg")

    times = {i: call["at"] for i, call in enumerate(request.calls)}
    # Reads are not delayed by the write before them.
    assert times[1] == times[0]
    assert times[2] == times[0]
    # Each write is at least min_write_interval after the previous write.
    assert times[3] - times[0] == pytest.approx(1.0)
    assert times[4] - times[3] == pytest.approx(1.0)
    # The first write didn't wait at all.
    assert clock.sleeps == [pytest.approx(0.75), pytest.approx(1.0)]


async def test_default_pacing_stays_under_ninety_writes_a_minute():
    responses = [FakeResponse(200, {"resourceName": RESOURCE, "etag": "%E"}) for _ in range(91)]
    client, request, _ = make(responses)

    for _ in range(91):
        await client.create_contact(BODY)

    elapsed = request.calls[-1]["at"] - request.calls[0]["at"]
    assert elapsed >= 60.0


async def test_429_is_retried_with_retry_after():
    client, request, clock = make(
        [
            FakeResponse(429, google_error(429, "RESOURCE_EXHAUSTED", "Quota"), {"Retry-After": "7"}),
            FakeResponse(429, google_error(429, "RESOURCE_EXHAUSTED", "Quota")),
            FakeResponse(200, {"resourceName": RESOURCE, "etag": "%E"}),
        ]
    )

    created = await client.create_contact(BODY)

    assert created.resource_name == RESOURCE
    assert len(request.calls) == 3
    # Retry-After honoured first, then the backoff schedule (second retry waits 2 s).
    assert clock.sleeps == [7.0, 2.0]
    assert all(resp.released for resp in request.sent)


async def test_retry_after_is_capped():
    client, _, clock = make(
        [
            FakeResponse(429, {}, {"Retry-After": "3600"}),
            FakeResponse(200, {"resourceName": RESOURCE, "etag": "%E"}),
        ]
    )

    await client.create_contact(BODY)

    assert clock.sleeps == [120.0]


async def test_gives_up_with_rate_limited_after_max_retries():
    responses = [
        FakeResponse(429, google_error(429, "RESOURCE_EXHAUSTED", "Quota")) for _ in range(6)
    ]
    responses[-1].headers = {"Retry-After": "30"}
    client, request, clock = make(responses, max_retries=5)

    with pytest.raises(RateLimited) as err:
        await client.update_contact(RESOURCE, "%E", BODY)

    assert len(request.calls) == 6  # the first try and five retries
    assert clock.sleeps == [1.0, 2.0, 4.0, 8.0, 16.0]
    assert err.value.status == 429
    assert err.value.retry_after == 30.0
    assert isinstance(err.value, GoogleError)


async def test_5xx_is_retried_then_raised():
    responses = [FakeResponse(503, google_error(503, "UNAVAILABLE", "Try later")) for _ in range(4)]
    client, request, clock = make(responses, max_retries=3)

    with pytest.raises(GoogleError) as err:
        await client.get_etag(RESOURCE)

    assert not isinstance(err.value, RateLimited)
    assert err.value.status == 503
    assert len(request.calls) == 4
    assert clock.sleeps == [1.0, 2.0, 4.0]


async def test_retry_after_on_a_5xx_is_honoured():
    client, _, clock = make(
        [
            FakeResponse(503, {}, {"Retry-After": "9"}),
            FakeResponse(200, {"etag": "%E", "metadata": {}}),
        ]
    )

    await client.get_etag(RESOURCE)

    assert clock.sleeps == [9.0]


async def test_retry_after_never_shortens_the_backoff():
    client, _, clock = make(
        [
            FakeResponse(429, {}, {"Retry-After": "0"}),
            FakeResponse(503, {}, {"Retry-After": "0"}),
            FakeResponse(200, {}),
        ]
    )

    await client.update_contact(RESOURCE, "%E", BODY)

    assert clock.sleeps == [1.0, 2.0]


async def test_5xx_then_success_recovers():
    client, request, _ = make(
        [FakeResponse(500, ValueError("not json")), FakeResponse(200, {"etag": "%E", "metadata": {}})]
    )

    assert await client.get_etag(RESOURCE) == "%E"
    assert len(request.calls) == 2


async def test_backoff_is_capped_at_sixty_seconds():
    responses = [FakeResponse(502, {}) for _ in range(9)]
    client, _, clock = make(responses, max_retries=8)

    with pytest.raises(GoogleError):
        await client.get_etag(RESOURCE)

    assert clock.sleeps == [1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 60.0, 60.0]


async def test_401_is_an_auth_error():
    client, request, _ = make([FakeResponse(401, google_error(401, "UNAUTHENTICATED", "Bad token"))])

    with pytest.raises(GoogleAuthError):
        await client.create_contact(BODY)
    assert len(request.calls) == 1


async def test_a_disabled_api_gets_a_plain_message():
    client, _, _ = make(
        [
            FakeResponse(
                403,
                google_error(
                    403,
                    "PERMISSION_DENIED",
                    "People API has not been used in project 123 before or it is disabled.",
                    ("SERVICE_DISABLED",),
                ),
            )
        ]
    )

    with pytest.raises(AccessRefused) as err:
        await client.create_contact(BODY)

    assert err.value.status == 403
    assert err.value.reason == "The Google People API is not enabled for this Google Cloud project."
    assert str(err.value) == err.value.reason


async def test_a_disabled_api_is_recognised_by_its_message_alone():
    client, _, _ = make(
        [
            FakeResponse(
                403,
                google_error(403, "PERMISSION_DENIED", "People API is not enabled for this project."),
            )
        ]
    )

    with pytest.raises(GoogleError) as err:
        await client.get_etag(RESOURCE)

    assert err.value.reason == "The Google People API is not enabled for this Google Cloud project."


@pytest.mark.parametrize(
    "error",
    [
        google_error(
            403, "PERMISSION_DENIED", "Request had insufficient authentication scopes.",
            ("ACCESS_TOKEN_SCOPE_INSUFFICIENT",),
        ),
        google_error(403, "PERMISSION_DENIED", "Request had insufficient authentication scopes."),
    ],
    ids=["by-reason", "by-message"],
)
async def test_a_missing_scope_is_access_refused(error):
    client, request, _ = make([FakeResponse(403, error)])

    with pytest.raises(AccessRefused) as err:
        await client.update_contact(RESOURCE, "%E", BODY)

    assert err.value.reason == "Hearth was not given access to your Google contacts."
    assert len(request.calls) == 1


async def test_another_403_is_a_plain_google_error():
    client, _, _ = make(
        [FakeResponse(403, google_error(403, "PERMISSION_DENIED", "Nope", ("OTHER_REASON",)))]
    )

    with pytest.raises(GoogleError) as err:
        await client.get_etag(RESOURCE)

    assert not isinstance(err.value, AccessRefused)
    assert err.value.reason == "HTTP 403 PERMISSION_DENIED OTHER_REASON"


async def test_other_4xx_raise_a_google_error_without_retrying():
    client, request, _ = make(
        [FakeResponse(400, google_error(400, "INVALID_ARGUMENT", "Bad request", ("BAD_FIELD",)))]
    )

    with pytest.raises(GoogleError) as err:
        await client.create_contact(BODY)

    assert err.value.status == 400
    assert "INVALID_ARGUMENT" in err.value.reason
    assert len(request.calls) == 1


async def test_a_bad_resource_name_is_refused_before_any_request():
    client, request, _ = make([])

    for call in (
        lambda: client.get_etag("people/c1/../../other"),
        lambda: client.update_contact("people/c1?x=1", "%E", BODY),
        lambda: client.update_photo("", b"jpeg"),
    ):
        with pytest.raises(InvalidResourceName) as err:
            await call()
        assert isinstance(err.value, GoogleError)
        assert err.value.status == 0
    assert request.calls == []


async def test_errors_never_carry_request_bodies_or_tokens(caplog):
    caplog.set_level(logging.DEBUG)
    echo = f"Invalid value {PHONE} for Authorization: Bearer {TOKEN}"
    long_echo = echo + " " + "x" * 500
    client, _, _ = make(
        [
            FakeResponse(400, google_error(400, "INVALID_ARGUMENT", long_echo, (PHONE,))),
            FakeResponse(403, google_error(403, "PERMISSION_DENIED", echo)),
            FakeResponse(429, google_error(429, "RESOURCE_EXHAUSTED", echo)),
            FakeResponse(429, google_error(429, "RESOURCE_EXHAUSTED", echo)),
            FakeResponse(503, google_error(503, "UNAVAILABLE", echo)),
            FakeResponse(503, google_error(503, "UNAVAILABLE", echo)),
            FakeResponse(404, google_error(404, "NOT_FOUND", echo)),
        ],
        max_retries=1,
    )

    errors: list[GoogleError] = []
    for call in (
        lambda: client.create_contact(BODY),
        lambda: client.update_contact(RESOURCE, "%E", BODY),
        lambda: client.update_photo(RESOURCE, PHONE.encode()),
        lambda: client.get_etag(RESOURCE),
        lambda: client.update_contact(RESOURCE, "%E", BODY),
    ):
        with pytest.raises(GoogleError) as err:
            await call()
        errors.append(err.value)

    for error in errors:
        assert len(error.reason) <= 200
        for text in (str(error), error.reason, repr(error), repr(error.args)):
            assert PHONE not in text
            assert TOKEN not in text
            assert "Bearer" not in text
    for record in caplog.records:
        line = record.getMessage()
        assert PHONE not in line
        assert TOKEN not in line
