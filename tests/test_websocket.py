"""Tests for the websocket API, on a real Home Assistant with two users and two CRMs."""

from __future__ import annotations

import asyncio
import base64
import io

import pytest
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.setup import async_setup_component
from PIL import Image

from custom_components.hearth_crm.const import DOMAIN, SIGNAL_CHANGED


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


async def token_for(hass, user) -> str:
    refresh = await hass.auth.async_create_refresh_token(user, "https://example.test")
    return hass.auth.async_create_access_token(refresh)


async def make_user(hass, name):
    return await hass.auth.async_create_user(name, group_ids=[GROUP_ID_USER])


@pytest.fixture
async def two_crms(hass, hass_admin_user, add_crm):
    """User A (admin) and user B, each with a CRM; B is a plain user."""
    user_b = await make_user(hass, "Bee Example")
    return hass_admin_user, user_b, await add_crm(hass_admin_user), await add_crm(user_b)


@pytest.fixture
async def ws_for_a(hass, hass_ws_client, two_crms):
    return await hass_ws_client(hass, await token_for(hass, two_crms[0]))


@pytest.fixture
async def ws_for_b(hass, hass_ws_client, two_crms):
    return await hass_ws_client(hass, await token_for(hass, two_crms[1]))


async def call(ws, command, **data):
    await ws.send_json_auto_id({"type": f"hearth_crm/{command}", **data})
    return await ws.receive_json()


async def ok(ws, command, **data):
    reply = await call(ws, command, **data)
    assert reply["success"], reply
    return reply["result"]


def png_b64() -> str:
    out = io.BytesIO()
    Image.new("RGB", (8, 8), (200, 10, 10)).save(out, format="PNG")
    return base64.b64encode(out.getvalue()).decode()


async def test_user_without_crm_gets_no_crm(hass, hass_ws_client):
    assert await async_setup_component(hass, DOMAIN, {})
    ws = await hass_ws_client(hass)
    assert (await ok(ws, "crm/status")) == {"has_crm": False, "loaded": False, "entry_id": None}
    for command, data in (
        ("snapshot", {}),
        ("subscribe", {}),
        ("create", {"kind": "person", "fields": {"name": "X"}}),
        ("update", {"kind": "person", "entity_id": "p", "changes": {}}),
        ("delete", {"kind": "person", "entity_id": "p"}),
        ("group/set_members", {"group_id": "g", "person_ids": []}),
        ("photo/set", {"kind": "person", "entity_id": "p", "data": ""}),
        ("photo/clear", {"kind": "person", "entity_id": "p"}),
        ("settings/get", {}),
        ("settings/set", {"changes": {}}),
    ):
        reply = await call(ws, command, **data)
        assert not reply["success"] and reply["error"]["code"] == "no_crm", command


async def test_create_crm_from_panel(hass, hass_ws_client, hass_read_only_user):
    assert await async_setup_component(hass, DOMAIN, {})
    ws = await hass_ws_client(hass, await token_for(hass, hass_read_only_user))
    created = await ok(ws, "crm/create")
    entries = hass.config_entries.async_entries(DOMAIN)
    assert [e.entry_id for e in entries] == [created["entry_id"]]
    assert entries[0].data["owner_user_id"] == hass_read_only_user.id
    assert (await ok(ws, "crm/status")) == {
        "has_crm": True, "loaded": True, "entry_id": created["entry_id"]
    }
    # Asking again returns the same CRM and starts no second flow.
    assert (await ok(ws, "crm/create")) == created
    assert len(hass.config_entries.async_entries(DOMAIN)) == 1
    assert (await ok(ws, "snapshot"))["people"] == []


async def test_create_crm_failure_reports_reason(hass, hass_ws_client, monkeypatch):
    assert await async_setup_component(hass, DOMAIN, {})
    ws = await hass_ws_client(hass)

    async def abort(self, data):
        return self.async_abort(reason="invalid_user")

    monkeypatch.setattr(
        "custom_components.hearth_crm.config_flow.HearthConfigFlow.async_step_self_service", abort
    )
    reply = await call(ws, "crm/create")
    assert reply["error"]["code"] == "create_failed"
    assert "invalid_user" in reply["error"]["message"]


async def test_snapshot_returns_only_callers_data(hass, two_crms, ws_for_a, ws_for_b):
    person = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    snap_a = await ok(ws_for_a, "snapshot")
    snap_b = await ok(ws_for_b, "snapshot")
    assert [p["id"] for p in snap_a["people"]] == [person["id"]]
    assert snap_b["people"] == []


async def test_b_cannot_touch_a_person_by_id(hass, two_crms, ws_for_a, ws_for_b):
    person = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    pid = person["id"]
    for command, data in (
        ("update", {"kind": "person", "entity_id": pid, "changes": {"name": "Hacked"}}),
        ("delete", {"kind": "person", "entity_id": pid}),
        ("photo/set", {"kind": "person", "entity_id": pid, "data": png_b64()}),
        ("photo/clear", {"kind": "person", "entity_id": pid}),
    ):
        reply = await call(ws_for_b, command, **data)
        assert reply["error"]["code"] == "not_found", command
    reply = await call(ws_for_b, "settings/set", changes={"me_person_id": pid})
    assert reply["error"]["code"] == "invalid"
    group = await ok(ws_for_b, "create", kind="contact_group", fields={"name": "Mine"})
    reply = await call(
        ws_for_b, "group/set_members", group_id=group["id"], person_ids=[pid]
    )
    assert reply["error"]["code"] == "invalid"
    after = (await ok(ws_for_a, "snapshot"))["people"]
    assert [(p["id"], p["name"], p["photo_hash"]) for p in after] == [(pid, "Alex Example", None)]
    assert (await ok(ws_for_b, "settings/get")) == {"me_person_id": None}


async def test_entry_and_owner_ids_in_messages_are_rejected(hass, two_crms, ws_for_b):
    entry_a = two_crms[2]
    for extra in ({"entry_id": entry_a.entry_id}, {"owner_user_id": two_crms[0].id}):
        reply = await call(ws_for_b, "snapshot", **extra)
        assert reply["error"]["code"] == "invalid_format"


async def test_crud_and_group_members_and_settings(hass, two_crms, ws_for_a):
    alex = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    blair = await ok(ws_for_a, "create", kind="person", fields={"name": "Blair Example"})
    updated = await ok(
        ws_for_a, "update", kind="person", entity_id=alex["id"], changes={"favorite": True}
    )
    assert updated["favorite"] is True and updated["name"] == "Alex Example"
    group = await ok(ws_for_a, "create", kind="contact_group", fields={"name": "Book Club"})
    members = await ok(
        ws_for_a, "group/set_members", group_id=group["id"], person_ids=[alex["id"], blair["id"]]
    )
    assert members["member_ids"] == sorted([alex["id"], blair["id"]])
    assert (await ok(ws_for_a, "settings/set", changes={"me_person_id": alex["id"]})) == {
        "me_person_id": alex["id"]
    }
    assert (await ok(ws_for_a, "settings/get")) == {"me_person_id": alex["id"]}
    photo = await ok(ws_for_a, "photo/set", kind="person", entity_id=alex["id"], data=png_b64())
    assert len(photo["photo_hash"]) == 64
    people = {p["id"]: p for p in (await ok(ws_for_a, "snapshot"))["people"]}
    assert people[alex["id"]]["photo_hash"] == photo["photo_hash"]
    assert (await call(ws_for_a, "photo/clear", kind="person", entity_id=alex["id"]))["success"]
    people = {p["id"]: p for p in (await ok(ws_for_a, "snapshot"))["people"]}
    assert people[alex["id"]]["photo_hash"] is None


async def test_delete_person_returns_cascade(hass, two_crms, ws_for_a):
    alex = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    blair = await ok(ws_for_a, "create", kind="person", fields={"name": "Blair Example"})
    solo = await ok(
        ws_for_a, "create", kind="interaction",
        fields={"summary": "Alone", "date": "2026-01-02", "type": "Catch-up",
                "person_ids": [alex["id"]]},
    )
    shared = await ok(
        ws_for_a, "create", kind="interaction",
        fields={"summary": "Together", "date": "2026-01-03", "type": "Catch-up",
                "person_ids": [alex["id"], blair["id"]]},
    )
    rel = await ok(
        ws_for_a, "create", kind="relationship",
        fields={"person_a_id": alex["id"], "person_b_id": blair["id"], "type": "Sibling"},
    )
    result = await ok(ws_for_a, "delete", kind="person", entity_id=alex["id"])
    deleted = result["deleted"]
    assert deleted["person"] == [alex["id"]]
    assert deleted["interaction"] == [solo["id"]]
    assert deleted["relationship"] == [rel["id"]]
    snap = await ok(ws_for_a, "snapshot")
    assert [i["id"] for i in snap["interactions"]] == [shared["id"]]


async def test_subscriber_hears_write_once_after_commit(hass, two_crms, ws_for_a, ws_for_b):
    await ws_for_a.send_json_auto_id({"type": "hearth_crm/subscribe"})
    sub_id = (await ws_for_a.receive_json())["id"]
    # B's writes are on B's CRM and A must not hear them.
    await ok(ws_for_b, "create", kind="person", fields={"name": "Bee Friend"})
    await ws_for_a.send_json_auto_id(
        {"type": "hearth_crm/create", "kind": "person", "fields": {"name": "Alex Example"}}
    )
    first, second = await ws_for_a.receive_json(), await ws_for_a.receive_json()
    (event,) = [m for m in (first, second) if m["type"] == "event"]
    (result,) = [m for m in (first, second) if m["type"] == "result"]
    person = result["result"]
    assert event["id"] == sub_id
    assert event["event"] == {
        "source": "panel", "entity": "person", "entity_id": person["id"], "action": "create"
    }
    # The commit has happened by the time the notice arrives.
    assert [p["id"] for p in (await ok(ws_for_a, "snapshot"))["people"]] == [person["id"]]
    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.2):
            await ws_for_a.receive_json()


async def test_subscription_closes_with_unsubscribe(hass, two_crms, ws_for_a):
    await ws_for_a.send_json_auto_id({"type": "hearth_crm/subscribe"})
    sub_id = (await ws_for_a.receive_json())["id"]
    await ws_for_a.send_json_auto_id({"type": "unsubscribe_events", "subscription": sub_id})
    assert (await ws_for_a.receive_json())["success"]
    await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})  # no event first
    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.2):
            await ws_for_a.receive_json()


async def test_failed_write_sends_no_notice(hass, two_crms, ws_for_a):
    seen = []
    from homeassistant.helpers.dispatcher import async_dispatcher_connect

    async_dispatcher_connect(
        hass, SIGNAL_CHANGED.format(two_crms[2].entry_id), lambda notice: seen.append(notice)
    )
    reply = await call(ws_for_a, "create", kind="person", fields={"name": "   "})
    assert reply["error"]["code"] == "invalid"
    reply = await call(ws_for_a, "update", kind="person", entity_id="nope", changes={})
    assert reply["error"]["code"] == "not_found"
    await hass.async_block_till_done()
    assert seen == []


async def test_invalid_input_reports_field(hass, two_crms, ws_for_a):
    reply = await call(ws_for_a, "create", kind="person", fields={"name": "X", "bogus": 1})
    assert reply["error"]["code"] == "invalid"
    assert "bogus" in reply["error"]["message"]
    reply = await call(ws_for_a, "create", kind="person", fields={"name": " "})
    assert "name" in reply["error"]["message"]


async def test_schema_failures_are_invalid_format(hass, two_crms, ws_for_a):
    for command, data in (
        ("create", {"kind": "planet", "fields": {}}),
        ("create", {"kind": "person", "fields": "x"}),
        ("update", {"kind": "person", "entity_id": "", "changes": {}}),
        ("photo/set", {"kind": "relationship", "entity_id": "p", "data": ""}),
        ("delete", {"kind": "person"}),
    ):
        reply = await call(ws_for_a, command, **data)
        assert reply["error"]["code"] == "invalid_format", (command, data)


async def test_photo_set_rejects_oversized_payload(hass, two_crms, ws_for_a):
    person = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    reply = await call(
        ws_for_a, "photo/set", kind="person", entity_id=person["id"], data="A" * 4_000_004
    )
    assert reply["error"]["code"] == "invalid"
    assert "data" in reply["error"]["message"]


async def test_photo_set_rejects_bad_base64_and_non_images(hass, two_crms, ws_for_a):
    person = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    reply = await call(ws_for_a, "photo/set", kind="person", entity_id=person["id"], data="!!!")
    assert reply["error"]["code"] == "invalid"
    junk = base64.b64encode(b"not an image").decode()
    reply = await call(ws_for_a, "photo/set", kind="person", entity_id=person["id"], data=junk)
    assert reply["error"]["code"] == "invalid"


async def test_unexpected_errors_are_logged_not_echoed(
    hass, two_crms, ws_for_a, monkeypatch, caplog
):
    def boom(*args, **kwargs):
        raise RuntimeError("secret-internal-detail")

    monkeypatch.setattr(two_crms[2].runtime_data.service, "snapshot", boom)
    reply = await call(ws_for_a, "snapshot")
    assert reply["error"]["code"] == "unknown_error"
    assert "secret-internal-detail" not in str(reply)
    assert "secret-internal-detail" in caplog.text


async def test_write_during_a_backup_reports_backup_in_progress(hass, two_crms, ws_for_a):
    repo = two_crms[2].runtime_data.repo
    repo.write_timeout = 0.1
    await hass.async_add_executor_job(repo.begin_backup)
    try:
        reply = await call(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
        assert reply["error"] == {
            "code": "backup_in_progress",
            "message": "A backup is running; try again in a moment",
        }
        assert (await ok(ws_for_a, "snapshot"))["people"] == []  # reads keep working
    finally:
        await hass.async_add_executor_job(repo.end_backup)
    await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})


async def test_every_write_sends_its_notice(hass, two_crms, ws_for_a):
    from homeassistant.helpers.dispatcher import async_dispatcher_connect

    seen = []
    async_dispatcher_connect(
        hass, SIGNAL_CHANGED.format(two_crms[2].entry_id), seen.append
    )

    def notice(entity, entity_id, action):
        return {"source": "panel", "entity": entity, "entity_id": entity_id, "action": action}

    async def last_after(command, **data):
        before = len(seen)
        result = await ok(ws_for_a, command, **data)
        assert len(seen) == before + 1, command
        return result, seen[-1]

    alex, got = await last_after("create", kind="person", fields={"name": "Alex Example"})
    assert got == notice("person", alex["id"], "create")
    _, got = await last_after(
        "update", kind="person", entity_id=alex["id"], changes={"favorite": True}
    )
    assert got == notice("person", alex["id"], "update")
    group, got = await last_after("create", kind="contact_group", fields={"name": "Book Club"})
    assert got == notice("contact_group", group["id"], "create")
    _, got = await last_after(
        "group/set_members", group_id=group["id"], person_ids=[alex["id"]]
    )
    assert got == notice("contact_group", group["id"], "update")
    _, got = await last_after("photo/set", kind="person", entity_id=alex["id"], data=png_b64())
    assert got == notice("person", alex["id"], "update")
    _, got = await last_after("photo/clear", kind="person", entity_id=alex["id"])
    assert got == notice("person", alex["id"], "update")
    _, got = await last_after("settings/set", changes={"me_person_id": alex["id"]})
    assert got == notice("settings", None, "update")
    _, got = await last_after("delete", kind="person", entity_id=alex["id"])
    assert got == notice("person", alex["id"], "delete")
    before = len(seen)
    await ok(ws_for_a, "settings/get")
    await ok(ws_for_a, "snapshot")
    assert len(seen) == before


async def test_concurrent_creates_return_the_same_crm(hass, hass_ws_client, hass_read_only_user):
    assert await async_setup_component(hass, DOMAIN, {})
    ws = await hass_ws_client(hass, await token_for(hass, hass_read_only_user))
    for _ in range(3):
        await ws.send_json_auto_id({"type": "hearth_crm/crm/create"})
    replies = [await ws.receive_json() for _ in range(3)]
    assert all(r["success"] for r in replies), replies
    assert len({r["result"]["entry_id"] for r in replies}) == 1
    assert len(hass.config_entries.async_entries(DOMAIN)) == 1


async def test_unloaded_crm_is_no_crm_for_data_and_not_loaded_for_create(
    hass, two_crms, ws_for_b
):
    entry_b = two_crms[3]
    assert await hass.config_entries.async_unload(entry_b.entry_id)
    assert (await ok(ws_for_b, "crm/status")) == {
        "has_crm": True, "loaded": False, "entry_id": entry_b.entry_id
    }
    for command, data in (("snapshot", {}), ("settings/get", {}), ("subscribe", {})):
        assert (await call(ws_for_b, command, **data))["error"]["code"] == "no_crm"
    reply = await call(ws_for_b, "crm/create")
    assert reply["error"]["code"] == "crm_not_loaded"
    assert len(hass.config_entries.async_entries(DOMAIN)) == 2


async def test_snapshot_photo_url_opens_the_photo(hass, hass_client_no_auth, two_crms, ws_for_a):
    with_photo = await ok(ws_for_a, "create", kind="person", fields={"name": "Alex Example"})
    await ok(ws_for_a, "create", kind="person", fields={"name": "Blair Example"})
    await ok(ws_for_a, "photo/set", kind="person", entity_id=with_photo["id"], data=png_b64())
    result = await ok(ws_for_a, "snapshot")
    person = next(p for p in result["people"] if p["photo_hash"])
    assert all(p["photo_url"] is None for p in result["people"] if not p["photo_hash"])
    client = await hass_client_no_auth()
    resp = await client.get(person["photo_url"])
    assert resp.status == 200 and resp.headers["Content-Type"] == "image/jpeg"


async def test_status_includes_entry_id(hass, two_crms, ws_for_a):
    assert (await ok(ws_for_a, "crm/status")) == {
        "has_crm": True, "loaded": True, "entry_id": two_crms[2].entry_id
    }
