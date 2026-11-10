"""Tests for the authenticated views: the per-owner photo view and the import upload."""

from __future__ import annotations

import hashlib
import re
from dataclasses import replace
from datetime import timedelta
from pathlib import Path

import pytest
from aiohttp import FormData
from homeassistant.auth.const import GROUP_ID_USER
from homeassistant.components.http.auth import async_sign_path
from homeassistant.helpers.dispatcher import async_dispatcher_connect

import custom_components.hearth_crm.http as hearth_http
from custom_components.hearth_crm.bundle import write_bundle
from custom_components.hearth_crm.const import SIGNAL_CHANGED
from custom_components.hearth_crm.models import CRMData
from tests.conftest import sample_data

JPEG = b"\xff\xd8\xff\xe0 pretend this is a jpeg"


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


async def token_for(hass, user) -> str:
    refresh = await hass.auth.async_create_refresh_token(user, "https://example.test")
    return hass.auth.async_create_access_token(refresh)


@pytest.fixture
async def setup(hass, hass_admin_user, add_crm):
    """Owner A (a plain user) with a CRM and one stored photo; admin and stranger exist too."""
    owner = await hass.auth.async_create_user("Ann Example", group_ids=[GROUP_ID_USER])
    stranger = await hass.auth.async_create_user("Bee Example", group_ids=[GROUP_ID_USER])
    entry = await add_crm(owner)
    photo_hash = entry.runtime_data.photos.put(JPEG)
    return owner, stranger, hass_admin_user, photo_hash


def photo_url(owner, photo_hash) -> str:
    return f"/api/hearth_crm/photos/{owner.id}/{photo_hash}"


async def test_owner_gets_photo(hass, hass_client, setup):
    owner, _, _, photo_hash = setup
    client = await hass_client(await token_for(hass, owner))
    resp = await client.get(photo_url(owner, photo_hash))
    assert resp.status == 200
    assert await resp.read() == JPEG
    assert resp.headers["Content-Type"] == "image/jpeg"
    assert resp.headers["Cache-Control"] == "private, max-age=31536000, immutable"
    assert resp.headers["X-Content-Type-Options"] == "nosniff"


async def test_other_user_gets_403(hass, hass_client, setup):
    owner, stranger, _, photo_hash = setup
    client = await hass_client(await token_for(hass, stranger))
    assert (await client.get(photo_url(owner, photo_hash))).status == 403


async def test_other_user_cannot_probe_for_existence(hass, hass_client, setup):
    owner, stranger, _, photo_hash = setup
    client = await hass_client(await token_for(hass, stranger))
    assert (await client.get(photo_url(owner, "0" * 64))).status == 403
    assert (await client.get(photo_url(owner, "not-a-hash"))).status == 403
    assert (await client.get(f"/api/hearth_crm/photos/nobody/{photo_hash}")).status == 403


async def test_admin_gets_photo(hass, hass_client, setup):
    owner, _, _, photo_hash = setup
    client = await hass_client()  # the default token belongs to the admin user
    resp = await client.get(photo_url(owner, photo_hash))
    assert resp.status == 200
    assert await resp.read() == JPEG


async def test_bad_hash_gets_404(hass, hass_client, setup):
    owner, _, _, photo_hash = setup
    client = await hass_client(await token_for(hass, owner))
    assert (await client.get(photo_url(owner, "not-a-hash"))).status == 404
    assert (await client.get(photo_url(owner, "../" + photo_hash))).status == 404
    assert (await client.get(photo_url(owner, "0" * 64))).status == 404


async def test_unknown_owner_gets_404_for_admin(hass, hass_client, setup):
    _, _, _, photo_hash = setup
    client = await hass_client()
    assert (await client.get(f"/api/hearth_crm/photos/nobody/{photo_hash}")).status == 404


async def test_unloaded_crm_gets_404(hass, hass_client, setup):
    owner, _, _, photo_hash = setup
    entry = hass.config_entries.async_entries("hearth_crm")[0]
    await hass.config_entries.async_unload(entry.entry_id)
    client = await hass_client(await token_for(hass, owner))
    assert (await client.get(photo_url(owner, photo_hash))).status == 404


async def test_unauthenticated_gets_401(hass, hass_client_no_auth, setup):
    owner, _, _, photo_hash = setup
    client = await hass_client_no_auth()
    assert (await client.get(photo_url(owner, photo_hash))).status == 401


async def test_signed_path_works_without_header(hass, hass_client_no_auth, setup):
    owner, _, _, photo_hash = setup
    refresh = await hass.auth.async_create_refresh_token(owner, "https://example.test")
    signed = async_sign_path(
        hass, photo_url(owner, photo_hash), timedelta(minutes=5), refresh_token_id=refresh.id
    )
    client = await hass_client_no_auth()
    resp = await client.get(signed)
    assert resp.status == 200
    assert await resp.read() == JPEG


async def test_signed_path_of_another_user_gets_403(hass, hass_client_no_auth, setup):
    owner, stranger, _, photo_hash = setup
    refresh = await hass.auth.async_create_refresh_token(stranger, "https://example.test")
    signed = async_sign_path(
        hass, photo_url(owner, photo_hash), timedelta(minutes=5), refresh_token_id=refresh.id
    )
    client = await hass_client_no_auth()
    assert (await client.get(signed)).status == 403


# --- The upload-and-import endpoint ------------------------------------------------------------

IMPORT_URL = "/api/hearth_crm/import"
PHOTO_ONE = b"invented-photo-one"
PHOTO_TWO = b"invented-photo-two"


def bundle_data():
    """The shared invented sample, with real (hashable) photos as a bundle requires."""
    data = sample_data()
    hash_one, hash_two = (hashlib.sha256(b).hexdigest() for b in (PHOTO_ONE, PHOTO_TWO))
    data.people[0] = replace(data.people[0], photo_hash=hash_one)
    data.households[0] = replace(data.households[0], photo_hash=hash_two)
    return data


def bundle_bytes(tmp_path: Path) -> bytes:
    photos = {hashlib.sha256(b).hexdigest(): b for b in (PHOTO_ONE, PHOTO_TWO)}
    path = tmp_path / "upload-source.zip"
    write_bundle(path, bundle_data(), photos.__getitem__, me_person_id="p1")
    return path.read_bytes()


def upload_form(content: bytes, replace_existing: str | None = None) -> FormData:
    form = FormData()
    if replace_existing is not None:
        form.add_field("replace_existing", replace_existing)
    form.add_field(
        "file", content, filename="../../evil name.zip", content_type="application/zip"
    )
    return form


def uploads(entry) -> list[str]:
    imports = entry.runtime_data.data_dir / "imports"
    return sorted(p.name for p in imports.iterdir()) if imports.exists() else []


@pytest.fixture
async def two_owners(hass, hass_admin_user, add_crm):
    """User A (admin) and user B (a plain user), each with a CRM."""
    user_b = await hass.auth.async_create_user("Bee Example", group_ids=[GROUP_ID_USER])
    return hass_admin_user, user_b, await add_crm(hass_admin_user), await add_crm(user_b)


async def test_import_endpoint_imports_an_uploaded_bundle(
    hass, hass_client, two_owners, tmp_path
):
    user_a, _, entry_a, _ = two_owners
    heard = []
    async_dispatcher_connect(hass, SIGNAL_CHANGED.format(entry_a.entry_id), heard.append)
    client = await hass_client(await token_for(hass, user_a))

    resp = await client.post(IMPORT_URL, data=upload_form(bundle_bytes(tmp_path)))

    assert resp.status == 200, await resp.text()
    body = await resp.json()
    assert set(body) == {"summary", "counts"}
    assert body["counts"]["people"] == len(bundle_data().people)
    assert "Imported" in body["summary"]
    snap = await hass.async_add_executor_job(entry_a.runtime_data.repo.snapshot)
    assert snap == bundle_data()
    assert heard == [
        {"source": "import", "entity": "all", "entity_id": None, "action": "replace_all"}
    ]
    assert uploads(entry_a) == []  # removed once imported


async def test_import_endpoint_returns_the_refusal_reason(
    hass, hass_client, two_owners, tmp_path
):
    user_a, _, entry_a, _ = two_owners
    repo = entry_a.runtime_data.repo
    await hass.async_add_executor_job(repo.replace_all, CRMData(), "panel")  # a local change
    content = bundle_bytes(tmp_path)
    client = await hass_client(await token_for(hass, user_a))

    resp = await client.post(IMPORT_URL, data=upload_form(content))
    assert resp.status == 422
    body = await resp.json()
    assert body["reason"] == "local_changes" and body["problems"] == []
    assert "Nothing was changed" in body["message"]
    assert await hass.async_add_executor_job(repo.snapshot) == CRMData()
    assert uploads(entry_a) == []  # removed after a refused import too

    resp = await client.post(IMPORT_URL, data=upload_form(content, replace_existing="false"))
    assert resp.status == 422 and (await resp.json())["reason"] == "local_changes"

    resp = await client.post(IMPORT_URL, data=upload_form(content, replace_existing="true"))
    assert resp.status == 200, await resp.text()
    assert await hass.async_add_executor_job(repo.snapshot) == bundle_data()
    assert uploads(entry_a) == []

    await hass.async_add_executor_job(repo.set_cutover_confirmed)
    resp = await client.post(IMPORT_URL, data=upload_form(content, replace_existing="true"))
    assert resp.status == 422
    body = await resp.json()
    assert body["reason"] == "cutover_confirmed" and body["problems"] == []
    assert body["message"]
    assert uploads(entry_a) == []


async def test_import_endpoint_reports_a_running_backup(hass, hass_client, two_owners, tmp_path):
    user_a, _, entry_a, _ = two_owners
    repo = entry_a.runtime_data.repo
    repo.write_timeout = 0.1
    client = await hass_client(await token_for(hass, user_a))
    await hass.async_add_executor_job(repo.begin_backup)
    try:
        resp = await client.post(IMPORT_URL, data=upload_form(bundle_bytes(tmp_path)))
    finally:
        await hass.async_add_executor_job(repo.end_backup)
    assert resp.status == 422
    body = await resp.json()
    assert body["reason"] == "backup_in_progress" and body["problems"] == []


async def test_import_endpoint_writes_only_into_the_callers_own_imports(
    hass, hass_client, two_owners, tmp_path
):
    _, user_b, entry_a, entry_b = two_owners
    before_a = await hass.async_add_executor_job(entry_a.runtime_data.repo.snapshot)
    client = await hass_client(await token_for(hass, user_b))

    resp = await client.post(IMPORT_URL, data=upload_form(bundle_bytes(tmp_path)))

    assert resp.status == 200, await resp.text()
    assert (entry_b.runtime_data.data_dir / "imports").is_dir()  # it was saved in B's folder
    assert not (entry_a.runtime_data.data_dir / "imports").exists()
    assert uploads(entry_b) == []
    assert await hass.async_add_executor_job(entry_a.runtime_data.repo.snapshot) == before_a
    assert await hass.async_add_executor_job(entry_b.runtime_data.repo.snapshot) == bundle_data()
    # The client's filename is never used, anywhere.
    assert not list(Path(hass.config.config_dir).rglob("evil name.zip"))


async def test_import_endpoint_rejects_an_invalid_zip_with_problems(
    hass, hass_client, two_owners
):
    user_a, _, entry_a, _ = two_owners
    before = await hass.async_add_executor_job(entry_a.runtime_data.repo.snapshot)
    client = await hass_client(await token_for(hass, user_a))

    resp = await client.post(IMPORT_URL, data=upload_form(b"this is not a zip"))

    assert resp.status == 422
    body = await resp.json()
    assert body["reason"] == "invalid"
    assert body["problems"] and "zip" in body["problems"][0]
    assert body["message"]
    assert await hass.async_add_executor_job(entry_a.runtime_data.repo.snapshot) == before


async def test_import_endpoint_refuses_a_user_without_a_crm(
    hass, hass_client, two_owners, tmp_path
):
    stranger = await hass.auth.async_create_user("Cee Example", group_ids=[GROUP_ID_USER])
    client = await hass_client(await token_for(hass, stranger))
    resp = await client.post(IMPORT_URL, data=upload_form(bundle_bytes(tmp_path)))
    assert resp.status == 404
    assert await resp.json() == {"reason": "no_crm"}


async def test_import_endpoint_requires_auth(hass, hass_client_no_auth, two_owners, tmp_path):
    client = await hass_client_no_auth()
    resp = await client.post(IMPORT_URL, data=upload_form(bundle_bytes(tmp_path)))
    assert resp.status == 401


async def test_import_endpoint_stops_a_too_large_upload_and_removes_it(
    hass, hass_client, two_owners, tmp_path, monkeypatch
):
    user_a, _, entry_a, _ = two_owners
    monkeypatch.setattr(hearth_http, "MAX_UPLOAD_BYTES", 1000)
    client = await hass_client(await token_for(hass, user_a))

    resp = await client.post(IMPORT_URL, data=upload_form(b"x" * 5000))

    assert resp.status == 413
    assert await resp.json() == {"reason": "too_large"}
    assert uploads(entry_a) == []


async def test_import_endpoint_needs_a_file_part(hass, hass_client, two_owners):
    user_a, _, entry_a, _ = two_owners
    client = await hass_client(await token_for(hass, user_a))
    form = FormData()
    form.add_field("replace_existing", "true")
    form.add_field("other", b"data", filename="x.bin")
    resp = await client.post(IMPORT_URL, data=form)
    assert resp.status == 400
    resp = await client.post(IMPORT_URL, json={"file": "nope"})
    assert resp.status == 400
    assert uploads(entry_a) == []


async def test_import_endpoint_streams_past_the_http_body_limit(hass, hass_client, two_owners):
    """A file bigger than aiohttp's client_max_size still arrives (it is streamed, not read)."""
    user_a, _, entry_a, _ = two_owners
    client = await hass_client(await token_for(hass, user_a))
    big = b"x" * (hass.http.app._client_max_size + 1)

    resp = await client.post(IMPORT_URL, data=upload_form(big))

    assert resp.status == 422  # it reached the bundle check: not a zip
    assert (await resp.json())["reason"] == "invalid"
    assert uploads(entry_a) == []


async def test_import_endpoint_keeps_the_upload_after_an_unexpected_error(
    hass, hass_client, two_owners, tmp_path, monkeypatch, caplog
):
    user_a, _, entry_a, _ = two_owners
    content = bundle_bytes(tmp_path)

    def broken(*args, **kwargs):
        raise RuntimeError("invented failure")

    monkeypatch.setattr(entry_a.runtime_data.service, "import_data", broken)
    client = await hass_client(await token_for(hass, user_a))

    resp = await client.post(IMPORT_URL, data=upload_form(content))

    assert resp.status == 500
    (name,) = uploads(entry_a)
    assert re.fullmatch(r"upload-\d{8}-\d{6}-\d{6}\.zip", name)
    saved = entry_a.runtime_data.data_dir / "imports" / name
    assert saved.read_bytes() == content
    assert str(saved) in caplog.text
