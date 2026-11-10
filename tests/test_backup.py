"""Tests for the backup hooks, with real entries and repositories."""

from __future__ import annotations

import sqlite3
import threading
from unittest.mock import patch

import pytest
from homeassistant.config_entries import ConfigEntryState

from custom_components.hearth_crm import backup
from tests.conftest import sample_data


@pytest.fixture(autouse=True)
def _custom_integrations(enable_custom_integrations):
    """Let Home Assistant find this integration."""


async def test_backup_hooks_cover_every_entry(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    repos = [
        (await add_crm(user)).runtime_data.repo
        for user in (hass_admin_user, hass_read_only_user)
    ]
    # A CRM that is not loaded is skipped (its hooks would blow up if called).
    unloaded = await add_crm(await hass.auth.async_create_user("Quiet Quinn"))
    await hass.config_entries.async_unload(unloaded.entry_id)

    await backup.async_pre_backup(hass)
    assert all(repo._write_gate.locked() for repo in repos)

    dones = [threading.Event() for _ in repos]
    writers = [
        threading.Thread(
            target=lambda r=repo, d=done: (r.replace_all(sample_data(), source="sync"), d.set())
        )
        for repo, done in zip(repos, dones, strict=True)
    ]
    for writer in writers:
        writer.start()
    assert not any(done.wait(0.2) for done in dones)

    await backup.async_post_backup(hass)
    for writer, done in zip(writers, dones, strict=True):
        writer.join(5)
        assert not writer.is_alive()
        assert done.is_set()
    assert not any(repo._write_gate.locked() for repo in repos)


async def test_post_backup_releases_a_crm_unloaded_during_the_backup(
    hass, hass_admin_user, add_crm
):
    entry = await add_crm(hass_admin_user)
    repo = entry.runtime_data.repo
    real_close = repo.close
    repo.close = lambda: real_close(timeout=0.1)  # unloading gives up while the backup runs

    await backup.async_pre_backup(hass)
    assert not await hass.config_entries.async_unload(entry.entry_id)
    assert entry.state is ConfigEntryState.FAILED_UNLOAD
    assert repo._write_gate.locked()

    await backup.async_post_backup(hass)
    assert not repo._write_gate.locked()
    await hass.async_add_executor_job(real_close)


async def test_failed_begin_backup_releases_the_entries_already_locked(
    hass, hass_admin_user, hass_read_only_user, add_crm
):
    first = (await add_crm(hass_admin_user)).runtime_data.repo
    second_entry = await add_crm(hass_read_only_user)
    second = second_entry.runtime_data.repo

    with patch.object(second, "begin_backup", side_effect=sqlite3.OperationalError("busy")):
        with pytest.raises(sqlite3.OperationalError):
            await backup.async_pre_backup(hass)

    assert not first._write_gate.locked()
    assert not second._write_gate.locked()
