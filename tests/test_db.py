"""Tests for the SQLite database and CRMRepository."""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import replace

import pytest

from custom_components.hearth_crm.db import (
    SCHEMA_VERSION,
    BackupInProgress,
    CRMRepository,
    ImportRefusedError,
    open_database,
)
from custom_components.hearth_crm.models import CRMData
from tests.conftest import sample_data


@pytest.fixture
def repo(tmp_path):
    conn = open_database(tmp_path / "sub" / "db.sqlite")
    yield CRMRepository(conn)
    conn.close()


def test_round_trip_preserves_everything(repo):
    repo.replace_all(sample_data(), source="import")
    assert repo.snapshot() == sample_data()


def test_replace_all_wipes_previous_rows(repo):
    repo.replace_all(sample_data(), source="import")
    repo.replace_all(CRMData(), source="import")
    assert repo.snapshot() == CRMData()


def test_replace_all_logs_one_change_entry_with_counts(repo):
    repo.replace_all(sample_data(), source="import")
    entries = repo.changes()
    assert len(entries) == 1
    entry = entries[0]
    assert (entry.source, entry.entity, entry.action) == ("import", "all", "replace_all")
    assert entry.entity_id is None and entry.before is None
    assert entry.at.tzinfo is not None
    assert entry.after == {
        "person": 4, "household": 1, "contact_group": 1,
        "group_member": 2, "relationship": 3, "interaction": 2,
    }


def test_changes_newest_first_and_limited(repo):
    repo.replace_all(sample_data(), source="import")
    repo.replace_all(CRMData(), source="sync")
    assert [c.source for c in repo.changes()] == ["sync", "import"]
    assert len(repo.changes(limit=1)) == 1


def test_failed_replace_all_leaves_previous_data(repo):
    repo.replace_all(sample_data(), source="import")
    bad = sample_data()
    bad.relationships[0] = replace(bad.relationships[0], person_b_id="missing")
    with pytest.raises(sqlite3.IntegrityError):
        repo.replace_all(bad, source="import")
    assert repo.snapshot() == sample_data()
    assert len(repo.changes()) == 1


def test_reopen_keeps_schema_version(tmp_path):
    path = tmp_path / "db.sqlite"
    conn = open_database(path)
    CRMRepository(conn).replace_all(sample_data(), source="import")
    conn.close()
    conn = open_database(path)
    row = conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
    assert row[0] == str(SCHEMA_VERSION)
    assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
    assert CRMRepository(conn).snapshot() == sample_data()
    conn.close()


def test_backup_lock_blocks_writes(repo):
    repo.begin_backup()
    done = threading.Event()

    def write():
        repo.replace_all(sample_data(), source="import")
        done.set()

    thread = threading.Thread(target=write)
    thread.start()
    assert not done.wait(0.2)
    repo.end_backup()
    assert done.wait(5)
    thread.join()
    assert repo.snapshot() == sample_data()


def test_end_backup_without_begin_is_noop(repo):
    repo.end_backup()


def test_snapshot_during_replace_all_never_sees_partial_data(repo, monkeypatch):
    old = sample_data()
    repo.replace_all(old, source="import")
    new = CRMData(people=old.people[:1], households=old.households)

    paused, resume = threading.Event(), threading.Event()
    original = repo._insert_all

    def slow_insert(data):
        original(data)
        paused.set()
        assert resume.wait(5)

    monkeypatch.setattr(repo, "_insert_all", slow_insert)
    writer = threading.Thread(target=lambda: repo.replace_all(new, source="sync"))
    writer.start()
    assert paused.wait(5)

    result = []
    reader = threading.Thread(target=lambda: result.append(repo.snapshot()))
    reader.start()
    reader.join(0.2)
    assert reader.is_alive()  # blocked, not reading uncommitted state
    resume.set()
    writer.join()
    reader.join()
    assert result == [new]


def test_begin_backup_holds_gate_after_checkpoint(repo):
    repo.begin_backup()
    assert repo._write_gate.locked()
    repo.end_backup()
    assert not repo._write_gate.locked()


def test_begin_backup_raises_and_releases_when_checkpoint_busy(repo):
    class FakeConn:
        def execute(self, sql):
            class Cur:
                def fetchone(self):
                    return (1, 0, 0)

            return Cur()

    repo._conn = FakeConn()
    with pytest.raises(sqlite3.OperationalError):
        repo.begin_backup()
    assert not repo._write_gate.locked()


def test_end_backup_does_not_release_a_writers_lock(repo):
    with repo._write_gate:  # a writer holds the lock; no backup is active
        repo.end_backup()
        assert repo._write_gate.locked()


def test_cutover_flag_defaults_off_and_persists(tmp_path):
    path = tmp_path / "db.sqlite"
    conn = open_database(path)
    repo = CRMRepository(conn)
    assert repo.cutover_confirmed() is False
    repo.set_cutover_confirmed()
    assert repo.cutover_confirmed() is True
    conn.close()
    conn = open_database(path)
    assert CRMRepository(conn).cutover_confirmed() is True
    row = conn.execute("SELECT value FROM meta WHERE key='cutover_confirmed'").fetchone()
    assert row == ("1",)
    conn.close()


def test_import_refused_after_cutover(repo):
    repo.replace_all(sample_data(), source="import")
    repo.set_cutover_confirmed()
    with pytest.raises(ImportRefusedError) as err:
        repo.replace_all(CRMData(), source="import")
    assert err.value.reason == "cutover"
    assert repo.snapshot() == sample_data()
    assert len(repo.changes()) == 1
    repo.replace_all(CRMData(), source="sync")  # only imports are blocked
    assert repo.snapshot() == CRMData()


def test_import_refused_over_local_changes(repo):
    repo.replace_all(sample_data(), source="import")
    repo.replace_all(CRMData(), source="panel")
    with pytest.raises(ImportRefusedError) as err:
        repo.replace_all(sample_data(), source="import")
    assert err.value.reason == "local_changes"
    assert repo.snapshot() == CRMData()


def test_import_refused_over_local_changes_when_never_imported(repo):
    repo.replace_all(CRMData(), source="claude")
    with pytest.raises(ImportRefusedError, match="(?i)changes"):
        repo.replace_all(sample_data(), source="import")


def test_import_allowed_with_replace_existing(repo):
    repo.replace_all(CRMData(), source="panel")
    repo.replace_all(sample_data(), source="import", replace_existing=True)
    assert repo.snapshot() == sample_data()
    assert not repo.has_changes_since_import()


def test_import_refused_after_cutover_even_with_replace_existing(repo):
    repo.set_cutover_confirmed()
    with pytest.raises(ImportRefusedError) as err:
        repo.replace_all(sample_data(), source="import", replace_existing=True)
    assert err.value.reason == "cutover"


def test_reimport_after_import_needs_no_flag(repo):
    repo.replace_all(sample_data(), source="import")
    repo.replace_all(CRMData(), source="import")
    assert repo.snapshot() == CRMData()


def test_meta_and_change_log_survive_replace(repo):
    repo.replace_all(sample_data(), source="import")
    repo.set_meta("me_person_id", "p1", "panel")
    repo.set_cutover_confirmed()
    repo.replace_all(CRMData(), source="sync")
    assert repo.get_meta("me_person_id") == "p1"
    assert repo.cutover_confirmed()
    assert [c.source for c in repo.changes()] == ["sync", "panel", "import"]


def test_set_meta_logs_a_setting_change(repo):
    repo.set_meta("me_person_id", "p1", "panel")
    entry = repo.changes()[0]
    assert (entry.source, entry.entity, entry.entity_id) == ("panel", "setting", "me_person_id")
    assert (entry.before, entry.after) == (None, "p1")
    repo.set_meta("me_person_id", None, "panel")
    assert repo.get_meta("me_person_id") is None


def test_setting_changed_in_the_panel_counts_as_a_local_change(repo):
    repo.replace_all(sample_data(), source="import")
    repo.set_meta("me_person_id", "p1", "panel")
    assert repo.has_changes_since_import()


def test_import_sets_me_person_in_the_same_transaction(repo):
    repo.replace_all(sample_data(), source="import", me_person_id="p2")
    assert repo.get_meta("me_person_id") == "p2"
    assert not repo.has_changes_since_import()
    repo.replace_all(CRMData(), source="panel")
    with pytest.raises(ImportRefusedError):
        repo.replace_all(sample_data(), source="import", me_person_id="p3")
    assert repo.get_meta("me_person_id") == "p2"


def test_import_clears_the_me_person_when_the_bundle_has_none(repo):
    repo.replace_all(sample_data(), source="import", me_person_id="p1")
    repo.replace_all(sample_data(), source="import")
    assert repo.get_meta("me_person_id") is None
    repo.replace_all(sample_data(), source="sync")  # other sources leave it alone
    repo.set_meta("me_person_id", "p2", "panel")
    repo.replace_all(CRMData(), source="sync")
    assert repo.get_meta("me_person_id") == "p2"


def test_export_state_returns_data_and_me_together(repo):
    repo.replace_all(sample_data(), source="import", me_person_id="p3")
    assert repo.export_state() == (sample_data(), "p3")


def test_reads_continue_during_backup(repo):
    repo.replace_all(sample_data(), source="import")
    repo.begin_backup()
    try:
        result = []
        readers = [
            threading.Thread(target=lambda: result.append(repo.snapshot())),
            threading.Thread(target=lambda: result.append(repo.get("person", "p1"))),
            threading.Thread(target=lambda: result.append(repo.changes())),
        ]
        for t in readers:
            t.start()
        for t in readers:
            t.join(1)
        assert not any(t.is_alive() for t in readers)
        assert len(result) == 3
    finally:
        repo.end_backup()


def test_writes_wait_for_backup(repo):
    repo.replace_all(sample_data(), source="import")
    repo.begin_backup()
    done = threading.Event()
    p = sample_data().people[0]

    def write():
        repo.update("person", replace(p, name="Renamed"), "panel")
        done.set()

    thread = threading.Thread(target=write)
    thread.start()
    assert not done.wait(0.2)
    repo.end_backup()
    assert done.wait(5)
    thread.join()
    assert repo.get("person", "p1").name == "Renamed"


def test_write_waits_a_bounded_time_for_a_backup_then_raises(repo):
    repo.replace_all(sample_data(), source="import")
    p = sample_data().people[0]
    repo.write_timeout = 0.2
    repo.begin_backup()
    try:
        for write in (
            lambda: repo.update("person", replace(p, name="Renamed"), "panel"),
            lambda: repo.replace_all(CRMData(), "import", replace_existing=True),
            lambda: repo.set_meta("me_person_id", "p1", "panel"),
        ):
            with pytest.raises(BackupInProgress):
                write()
    finally:
        repo.end_backup()
    assert repo.snapshot() == sample_data()
    repo.update("person", replace(p, name="Renamed"), "panel")  # the gate was not leaked
    assert repo.get("person", "p1").name == "Renamed"


def test_default_write_wait_is_ten_seconds(repo):
    assert repo.write_timeout == 10.0


class _RollbackFails:
    """A connection whose ROLLBACK fails, to check that failure is logged, not hidden."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, *args):
        if sql == "ROLLBACK":
            self._conn.execute("ROLLBACK")
            raise sqlite3.OperationalError("rollback-broke")
        return self._conn.execute(sql, *args)


def test_failed_rollback_is_logged_and_the_original_error_raised(repo, caplog):
    repo._conn = _RollbackFails(repo._conn)
    bad = replace(sample_data().people[0], household_id="missing")
    with pytest.raises(sqlite3.IntegrityError):
        repo.insert("person", bad, "panel")
    errors = [r for r in caplog.records if r.levelname == "ERROR"]
    assert len(errors) == 1 and "rollback-broke" in errors[0].getMessage()
    repo._conn = repo._conn._conn


def test_begin_backup_times_out_while_a_writer_holds_the_gate(repo):
    with repo._write_gate:  # a stuck writer
        with pytest.raises(TimeoutError):
            repo.begin_backup(timeout=0.2)
    repo.begin_backup(timeout=0.2)  # nothing leaked
    repo.end_backup()


def test_close_waits_for_writer_then_closes(repo):
    repo._write_gate.acquire()
    closed = threading.Event()

    def close():
        repo.close(timeout=5)
        closed.set()

    thread = threading.Thread(target=close)
    thread.start()
    assert not closed.wait(0.2)
    repo._write_gate.release()
    assert closed.wait(5)
    thread.join()
    with pytest.raises(sqlite3.ProgrammingError):
        repo.snapshot()


def test_close_times_out_while_a_backup_runs(repo):
    repo.begin_backup()
    with pytest.raises(TimeoutError):
        repo.close(timeout=0.2)
    repo.end_backup()
    repo.snapshot()  # still open
    repo.close()


def test_newer_schema_version_refused(tmp_path):
    path = tmp_path / "db.sqlite"
    conn = open_database(path)
    newer = str(SCHEMA_VERSION + 1)
    conn.execute("UPDATE meta SET value = ? WHERE key = 'schema_version'", (newer,))
    conn.close()
    with pytest.raises(RuntimeError) as err:
        open_database(path)
    assert str(SCHEMA_VERSION + 1) in str(err.value) and str(SCHEMA_VERSION) in str(err.value)


def test_child_foreign_key_indexes_exist(repo):
    names = {r[0] for r in repo._conn.execute("SELECT name FROM sqlite_master WHERE type='index'")}
    assert {
        "idx_person_household", "idx_group_member_person", "idx_relationship_a",
        "idx_relationship_b", "idx_interaction_person_person",
    } <= names
