"""Tests for the import, export and cutover actions, on a real Home Assistant."""

from __future__ import annotations

import hashlib
import zipfile
from dataclasses import replace
from pathlib import Path

import pytest
from homeassistant.core import Context
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError, Unauthorized

import custom_components.hearth_crm.actions as actions
from custom_components.hearth_crm.const import DOMAIN
from custom_components.hearth_crm.models import CRMData
from tests.conftest import sample_data as base_sample_data

PHOTO_A = b"photo-a-bytes"
PHOTO_B = b"photo-b-bytes"


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


def sample_data():
    """The shared sample with real (hashable) photos, as a bundle requires."""
    data = base_sample_data()
    hash_a, hash_b = (hashlib.sha256(b).hexdigest() for b in (PHOTO_A, PHOTO_B))
    data.people[0] = replace(data.people[0], photo_hash=hash_a)
    data.households[0] = replace(data.households[0], photo_hash=hash_b)
    return data


async def seed(hass, entry, data=None, source="import", me=None):
    """Put data (and its photos) into a CRM without going through an import."""
    runtime = entry.runtime_data
    for content in (PHOTO_A, PHOTO_B):
        await hass.async_add_executor_job(runtime.photos.put, content)
    await hass.async_add_executor_job(runtime.repo.replace_all, data or sample_data(), source)
    if me:
        await hass.async_add_executor_job(runtime.repo.set_meta, "me_person_id", me, source)


def call(hass, service, user, **data):
    return hass.services.async_call(
        DOMAIN, service, data, blocking=True, return_response=service != "confirm_cutover",
        context=Context(user_id=user.id if user else None),
    )


async def export(hass, entry, user) -> Path:
    result = await call(hass, "export", user, config_entry_id=entry.entry_id)
    return Path(result["path"])


def stage(entry, bundle: Path, name: str = "bundle.zip") -> str:
    """Copy a bundle into this CRM's imports folder and return the name to import."""
    imports = entry.runtime_data.data_dir / "imports"
    imports.mkdir(parents=True, exist_ok=True)
    (imports / name).write_bytes(bundle.read_bytes())
    return name


def snapshot(hass, entry):
    return hass.async_add_executor_job(entry.runtime_data.repo.snapshot)


def notifications(hass):
    return hass.data["persistent_notification"]


async def test_import_action_round_trip(hass, hass_admin_user, hass_read_only_user, add_crm):
    entry_a = await add_crm(hass_admin_user)
    entry_b = await add_crm(hass_read_only_user)
    data, me = sample_data(), "p2"
    await seed(hass, entry_a, data, me=me)
    bundle = await export(hass, entry_a, hass_admin_user)
    assert bundle.parent == entry_a.runtime_data.data_dir / "exports"
    assert bundle.name.startswith("hearth-") and bundle.suffix == ".zip"

    result = await call(
        hass, "import", hass_admin_user, config_entry_id=entry_b.entry_id,
        path=stage(entry_b, bundle),
    )

    assert await snapshot(hass, entry_b) == await snapshot(hass, entry_a) == data
    for photo in (PHOTO_A, PHOTO_B):
        path = entry_b.runtime_data.photos.path(hashlib.sha256(photo).hexdigest())
        assert path.read_bytes() == photo
    repo_b = entry_b.runtime_data.repo
    assert await hass.async_add_executor_job(repo_b.get_meta, "me_person_id") == me
    assert not await hass.async_add_executor_job(repo_b.has_changes_since_import)
    report_path = entry_b.runtime_data.data_dir / "import_report.md"
    assert result["report_path"] == str(report_path)
    assert result["counts"]["people"] == 4
    assert result["summary"].startswith("Imported 4 people")
    assert report_path.read_text().startswith("# Hearth import report")
    note = notifications(hass)[f"hearth_crm_import_{hass_read_only_user.id}"]
    assert note["title"] == "Hearth import" and "Imported 4 people" in note["message"]
    # The export carried the "me" person, and the other CRM was left alone.
    again = await export(hass, entry_b, hass_admin_user)
    with zipfile.ZipFile(again) as zf:
        assert '"me_person_id": "p2"' in zf.read("bundle.json").decode()


async def test_path_forms_inside_the_imports_folder(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    name = stage(entry, await export(hass, entry, hass_admin_user))
    imports = entry.runtime_data.data_dir / "imports"
    sub = imports / "sub"
    sub.mkdir()
    (sub / name).write_bytes((imports / name).read_bytes())
    for path in (name, f"sub/{name}", str(imports / name), f"sub/../{name}"):
        result = await call(
            hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=path
        )
        assert result["counts"]["people"] == 4


async def test_import_refused_over_local_changes_then_allowed(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry, source="panel")
    bundle = stage(entry, await export(hass, entry, hass_admin_user))
    await hass.async_add_executor_job(entry.runtime_data.repo.replace_all, CRMData(), "panel")

    with pytest.raises(HomeAssistantError, match="replace_existing: true") as err:
        await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=bundle)
    assert await snapshot(hass, entry) == CRMData()
    message = notifications(hass)[f"hearth_crm_import_{hass_admin_user.id}"]["message"]
    assert message.startswith("Import failed") and "replace_existing" in message
    assert err.value.__cause__ is not None

    await call(
        hass, "import", hass_admin_user, config_entry_id=entry.entry_id,
        path=bundle, replace_existing=True,
    )
    assert await snapshot(hass, entry) == sample_data()


async def test_cutover_survives_remove_and_readd(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_admin_user))
    await call(hass, "confirm_cutover", hass_admin_user, config_entry_id=entry.entry_id)
    assert "cutover_confirmed" not in entry.options
    await hass.config_entries.async_remove(entry.entry_id)

    again = await add_crm(hass_admin_user)
    with pytest.raises(HomeAssistantError, match="(?i)cutover"):
        await call(
            hass, "import", hass_admin_user, config_entry_id=again.entry_id,
            path=bundle, replace_existing=True,
        )
    assert await snapshot(hass, again) == sample_data()


async def test_import_cannot_reach_another_crms_files(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    """User B (an owner, not an admin) must not import A's export, by any route."""
    entry_a = await add_crm(hass_admin_user)
    entry_b = await add_crm(hass_read_only_user)
    await seed(hass, entry_a)
    victim = await export(hass, entry_a, hass_admin_user)
    await seed(hass, entry_b, CRMData(), source="import")
    imports_b = entry_b.runtime_data.data_dir / "imports"
    imports_b.mkdir(exist_ok=True)
    (imports_b / "link.zip").symlink_to(victim)
    (imports_b / "dirlink").symlink_to(victim.parent)

    relative = "../../" + hass_admin_user.id + "/exports/" + victim.name
    for bad in (
        str(victim),  # absolute
        relative,  # ../ traversal
        str(imports_b / relative),
        "link.zip",  # symlink inside B's imports pointing at A's file
        f"dirlink/{victim.name}",  # symlinked folder
        str(imports_b),  # the folder itself
        "",
    ):
        with pytest.raises(ServiceValidationError):
            await call(
                hass, "import", hass_read_only_user, config_entry_id=entry_b.entry_id, path=bad
            )
        assert await snapshot(hass, entry_b) == CRMData()
    assert f"hearth_crm_import_{hass_read_only_user.id}" in notifications(hass)


async def test_refused_path_notifies_and_reports(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    with pytest.raises(ServiceValidationError):
        await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path="/etc/x")
    note = notifications(hass)[f"hearth_crm_import_{hass_admin_user.id}"]
    assert note["message"].startswith("Import failed")
    assert "import_report_failed.md" in note["message"]
    report = (entry.runtime_data.data_dir / "import_report_failed.md").read_text()
    assert "## Failed import" in report
    assert not (entry.runtime_data.data_dir / "import_report.md").exists()


async def test_failed_import_keeps_the_last_successful_report(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_admin_user))
    await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=bundle)
    good = (entry.runtime_data.data_dir / "import_report.md").read_text()

    with pytest.raises(HomeAssistantError):
        await call(
            hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path="nope.zip"
        )
    assert (entry.runtime_data.data_dir / "import_report.md").read_text() == good
    assert "## Failed import" in (
        entry.runtime_data.data_dir / "import_report_failed.md"
    ).read_text()
    note = notifications(hass)[f"hearth_crm_import_{hass_admin_user.id}"]["message"]
    assert "import_report_failed.md" in note and "import_report.md " not in note


async def test_import_by_non_owner_is_unauthorized(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_admin_user))
    await hass.async_add_executor_job(entry.runtime_data.repo.replace_all, CRMData(), "import")
    for user in (hass_read_only_user, None):
        with pytest.raises(Unauthorized):
            await call(hass, "import", user, config_entry_id=entry.entry_id, path=bundle)
        with pytest.raises(Unauthorized):
            await call(hass, "confirm_cutover", user, config_entry_id=entry.entry_id)
    with pytest.raises(Unauthorized):
        await call(hass, "export", hass_read_only_user, config_entry_id=entry.entry_id)
    assert await snapshot(hass, entry) == CRMData()
    assert not await hass.async_add_executor_job(entry.runtime_data.repo.cutover_confirmed)


async def test_owner_who_is_not_admin_may_import_and_export(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    entry = await add_crm(hass_read_only_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_read_only_user))
    result = await call(
        hass, "import", hass_read_only_user, config_entry_id=entry.entry_id, path=bundle
    )
    assert result["counts"]["people"] == 4


async def test_bad_bundle_notifies_and_writes_nothing(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry, source="import")
    (entry.runtime_data.data_dir / "imports").mkdir()
    bad = entry.runtime_data.data_dir / "imports" / "bad.zip"
    with zipfile.ZipFile(bad, "w") as zf:
        zf.writestr("bundle.json", "not json")

    with pytest.raises(HomeAssistantError, match="not valid"):
        await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path="bad.zip")

    assert await snapshot(hass, entry) == sample_data()
    note = notifications(hass)[f"hearth_crm_import_{hass_admin_user.id}"]
    assert note["message"].startswith("Import failed")
    assert "bundle.json" not in note["message"]  # details stay out of the shared notification
    report = (entry.runtime_data.data_dir / "import_report_failed.md").read_text()
    assert "## Failed import" in report and "- " in report


async def test_import_during_a_backup_fails_with_that_reason(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_admin_user))
    repo = entry.runtime_data.repo
    repo.write_timeout = 0.1
    await hass.async_add_executor_job(repo.begin_backup)
    try:
        with pytest.raises(HomeAssistantError, match="A backup is running"):
            await call(
                hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=bundle
            )
    finally:
        await hass.async_add_executor_job(repo.end_backup)
    note = notifications(hass)[f"hearth_crm_import_{hass_admin_user.id}"]
    assert note["message"].startswith("Import failed: A backup is running")
    assert await snapshot(hass, entry) == sample_data()


async def test_missing_file_is_a_clean_failure(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    with pytest.raises(HomeAssistantError):
        await call(
            hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path="nope.zip"
        )
    assert f"hearth_crm_import_{hass_admin_user.id}" in notifications(hass)


async def test_report_failure_leaves_data_untouched(hass, hass_admin_user, add_crm, monkeypatch):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_admin_user))
    await hass.async_add_executor_job(entry.runtime_data.repo.replace_all, CRMData(), "import")

    def boom(data):
        raise RuntimeError("report exploded")

    monkeypatch.setattr(actions, "build_import_report", boom)
    with pytest.raises(HomeAssistantError, match="RuntimeError"):
        await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=bundle)
    assert await snapshot(hass, entry) == CRMData()


async def test_notification_failure_after_commit_is_not_reported_as_failed_import(
    hass, hass_admin_user, add_crm, monkeypatch
):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    bundle = stage(entry, await export(hass, entry, hass_admin_user))

    def boom(*args, **kwargs):
        raise RuntimeError("notify exploded")

    monkeypatch.setattr(actions.persistent_notification, "async_create", boom)
    result = await call(
        hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=bundle
    )
    assert result["counts"]["people"] == 4


async def test_me_person_is_replaced_by_each_import(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    repo = entry.runtime_data.repo
    await seed(hass, entry, me="p2")
    with_me = stage(entry, await export(hass, entry, hass_admin_user), "with-me.zip")

    # A bundle without that person (and without a "me") replaces both.
    smaller = sample_data()
    smaller.people = [p for p in smaller.people if p.id == "p1"]
    smaller.households, smaller.groups, smaller.group_members = [], [], []
    smaller.relationships, smaller.interactions = [], []
    smaller.people[0] = replace(smaller.people[0], household_id=None, photo_hash=None)
    await hass.async_add_executor_job(repo.replace_all, smaller, "import")
    await hass.async_add_executor_job(repo.set_meta, "me_person_id", None, "import")
    await seed(hass, entry, smaller, source="import")
    without_me = stage(entry, await export(hass, entry, hass_admin_user), "without-me.zip")

    await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=with_me)
    assert await hass.async_add_executor_job(repo.get_meta, "me_person_id") == "p2"
    await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=without_me)
    assert await hass.async_add_executor_job(repo.get_meta, "me_person_id") is None

    # The export no longer names a person who is gone, so it imports cleanly again.
    again = stage(entry, await export(hass, entry, hass_admin_user), "again.zip")
    await call(hass, "import", hass_admin_user, config_entry_id=entry.entry_id, path=again)
    assert len((await snapshot(hass, entry)).people) == 1


async def test_two_exports_never_overwrite_each_other(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    paths = {await export(hass, entry, hass_admin_user) for _ in range(5)}
    assert len(paths) == 5


async def test_export_failure_is_short_and_logged(
    hass, hass_admin_user, add_crm, monkeypatch, caplog
):
    entry = await add_crm(hass_admin_user)

    def boom(*args, **kwargs):
        raise OSError("/config/hearth_crm/secret-internal-path")

    monkeypatch.setattr(actions, "write_bundle", boom)
    with pytest.raises(HomeAssistantError) as err:
        await export(hass, entry, hass_admin_user)
    assert "secret-internal-path" not in str(err.value)
    assert "see the Home Assistant log" in str(err.value)
    assert "secret-internal-path" in caplog.text


async def test_export_from_automation_context_allowed(hass, hass_admin_user, add_crm):
    entry = await add_crm(hass_admin_user)
    await seed(hass, entry)
    path = await export(hass, entry, None)
    assert path.is_file() and path.parent.name == "exports"


async def test_actions_reject_unknown_entries(hass, hass_admin_user, add_crm):
    await add_crm(hass_admin_user)
    for service, extra in (("import", {"path": "x.zip"}), ("export", {}), ("confirm_cutover", {})):
        with pytest.raises(ServiceValidationError):
            await call(hass, service, hass_admin_user, config_entry_id="missing", **extra)


async def test_import_sends_one_notice_to_that_crm_only(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    from homeassistant.helpers.dispatcher import async_dispatcher_connect

    from custom_components.hearth_crm.const import SIGNAL_CHANGED

    entry_a = await add_crm(hass_admin_user)
    entry_b = await add_crm(hass_read_only_user)
    await seed(hass, entry_a)
    bundle = stage(entry_b, await export(hass, entry_a, hass_admin_user))
    heard = {entry_a.entry_id: [], entry_b.entry_id: []}
    for entry in (entry_a, entry_b):
        async_dispatcher_connect(
            hass, SIGNAL_CHANGED.format(entry.entry_id), heard[entry.entry_id].append
        )

    await call(hass, "import", hass_admin_user, config_entry_id=entry_b.entry_id, path=bundle)
    assert heard[entry_b.entry_id] == [
        {"source": "import", "entity": "all", "entity_id": None, "action": "replace_all"}
    ]
    assert heard[entry_a.entry_id] == []

    # A refused import changes nothing and says nothing.
    with pytest.raises(ServiceValidationError):
        await call(
            hass, "import", hass_admin_user, config_entry_id=entry_b.entry_id, path="/etc/x"
        )
    assert len(heard[entry_b.entry_id]) == 1
