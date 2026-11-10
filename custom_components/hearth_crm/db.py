"""SQLite storage for Hearth (no Home Assistant imports)."""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from .db_entities import (
    GROUP_COLUMNS,
    HOUSEHOLD_COLUMNS,
    INTERACTION_COLUMNS,
    PERSON_COLUMNS,
    PLACE_FIELDS,
    RELATIONSHIP_COLUMNS,
    EntityKind,
    get_entity,
    group_from_row,
    household_from_row,
    insert_entity,
    insert_row,
    interaction_from_row,
    parse_dt,
    person_from_row,
    relationship_from_row,
    update_entity,
)
from .models import CRMData
from .serialize import to_dict

_LOGGER = logging.getLogger(__name__)

SCHEMA_VERSION = 1
# How long a write waits for a running backup before giving up with BackupInProgress.
WRITE_GATE_TIMEOUT = 10.0

IMPORT_SOURCE = "import"
_META_CUTOVER = "cutover_confirmed"
META_ME_PERSON = "me_person_id"
META_GOOGLE_SYNC = "google_sync_enabled"
# Set once Google has accepted an update or create through this CRM's link. A setting, so
# (like the other meta keys but me_person_id) a bundle neither carries nor replaces it.
META_GOOGLE_LINK_VERIFIED = "google_link_verified"
GOOGLE_FIELDS = (
    "google_contact_id", "google_synced_at", "google_photo_hash", "google_sync_error",
)

_REFUSALS = {
    "cutover": "Cutover has been confirmed, so importing a bundle is refused.",
    "local_changes": (
        "This CRM has changes made since the last import; importing would discard them."
    ),
}


class ImportRefusedError(Exception):
    """A bundle import was refused to protect data already in Hearth."""

    def __init__(self, reason: Literal["cutover", "local_changes"]) -> None:
        self.reason = reason
        super().__init__(_REFUSALS[reason])


class BackupInProgress(Exception):
    """A write gave up because a backup held the database for too long."""

    def __init__(self) -> None:
        super().__init__("A backup is running; try again in a moment")


def _place_cols(prefix: str) -> str:
    cols = [
        f"{prefix}_{f} {'REAL' if f in ('lat', 'lon') else 'TEXT'}" for f in PLACE_FIELDS
    ]
    return ",\n    ".join(cols)


_SCHEMA = f"""
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS household (
    id TEXT PRIMARY KEY,
    name_override TEXT,
    {_place_cols("address")},
    notes TEXT,
    photo_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS person (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT, phone2 TEXT, email TEXT, email2 TEXT,
    occupation TEXT, employer TEXT, how_i_know_them TEXT, notes TEXT,
    birthday TEXT,
    birth_year_unknown INTEGER NOT NULL DEFAULT 0,
    favorite INTEGER NOT NULL DEFAULT 0,
    close_friend INTEGER NOT NULL DEFAULT 0,
    website TEXT, linkedin TEXT, facebook TEXT, instagram TEXT,
    {_place_cols("address")},
    {_place_cols("school")},
    relationship_summary TEXT,
    summary_updated TEXT,
    photo_hash TEXT,
    household_id TEXT REFERENCES household(id) ON DELETE SET NULL,
    google_contact_id TEXT,
    google_synced_at TEXT,
    google_photo_hash TEXT,
    google_sync_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_group (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    photo_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS group_member (
    group_id TEXT NOT NULL REFERENCES contact_group(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, person_id)
);

CREATE TABLE IF NOT EXISTS relationship (
    id TEXT PRIMARY KEY,
    person_a_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    person_b_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interaction (
    id TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interaction_person (
    interaction_id TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (interaction_id, person_id)
);

CREATE TABLE IF NOT EXISTS change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    source TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL,
    before TEXT,
    after TEXT
);

CREATE INDEX IF NOT EXISTS idx_person_household ON person(household_id);
CREATE INDEX IF NOT EXISTS idx_group_member_person ON group_member(person_id);
CREATE INDEX IF NOT EXISTS idx_relationship_a ON relationship(person_a_id);
CREATE INDEX IF NOT EXISTS idx_relationship_b ON relationship(person_b_id);
CREATE INDEX IF NOT EXISTS idx_interaction_person_person ON interaction_person(person_id);
"""

# Child tables first so deletes never trip foreign keys.
_DATA_TABLES_DELETE_ORDER = (
    "interaction_person",
    "interaction",
    "relationship",
    "group_member",
    "contact_group",
    "person",
    "household",
)

def open_database(path: Path) -> sqlite3.Connection:
    """Open (creating if needed) the CRM database with WAL and foreign keys on.

    Raises RuntimeError when the file was written by a newer Hearth (a higher schema version).
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # isolation_level=None: transactions are managed explicitly with BEGIN/COMMIT.
    conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            row = conn.execute("SELECT value FROM meta WHERE key = 'schema_version'").fetchone()
        except sqlite3.OperationalError:  # a brand-new database has no meta table yet
            row = None
        if row is not None and int(row[0]) > SCHEMA_VERSION:
            raise RuntimeError(
                f"This Hearth database has schema version {row[0]}, but this version of Hearth"
                f" only understands up to version {SCHEMA_VERSION}. Update Hearth."
            )
        conn.executescript(_SCHEMA)
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)",
            (str(SCHEMA_VERSION),),
        )
    except BaseException:
        conn.close()
        raise
    return conn


@dataclass
class ChangeLogEntry:
    id: int
    at: datetime
    source: str
    entity: str
    entity_id: str | None
    action: str
    before: dict | None
    after: dict | None


@dataclass
class DeleteResult:
    """Every ID a delete removed, by kind (``group_member`` entries are ``group_id:person_id``)."""

    deleted: dict[str, list[str]] = field(default_factory=dict)

    def _add(self, kind: str, entity_id: str) -> None:
        self.deleted.setdefault(kind, []).append(entity_id)

    def _sorted(self) -> DeleteResult:
        self.deleted = {k: sorted(v) for k, v in sorted(self.deleted.items())}
        return self


def _json(obj: Any) -> str:
    return json.dumps(to_dict(obj))


class CRMRepository:
    """Reads and writes the CRM dataset.

    Two locks. ``_conn_lock`` guards every use of the connection; reads hold it briefly and writers hold it
    for their whole transaction.
    ``_write_gate`` is held by a writer around its whole transaction and by a backup from
    ``begin_backup`` to ``end_backup``. A writer takes the gate first, then the connection lock;
    nobody holds the connection lock while waiting for the gate. Reads take only the connection
    lock, so they keep working during a backup.
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._conn_lock = threading.Lock()
        # A plain Lock: begin_backup/end_backup may run on different executor threads.
        self._write_gate = threading.Lock()
        # True only while a backup holds the gate, so end_backup can never release a writer's.
        self._backup_held = False
        self.write_timeout = WRITE_GATE_TIMEOUT

    @contextmanager
    def _write_txn(self) -> Iterator[None]:
        """Hold the gate and the connection lock around one explicit transaction.

        Waits at most ``write_timeout`` seconds for the gate. Raises BackupInProgress when a
        backup still holds it then (TimeoutError if something else does), so a caller holding
        its own lock is never stuck behind a long backup.
        """
        if not self._write_gate.acquire(timeout=self.write_timeout):
            if self._backup_held:
                raise BackupInProgress
            raise TimeoutError("Hearth's database is busy (another write is running)")
        try:
            with self._conn_lock:
                self._conn.execute("BEGIN IMMEDIATE")
                try:
                    yield
                    self._conn.execute("COMMIT")
                except BaseException:
                    try:
                        self._conn.execute("ROLLBACK")
                    except sqlite3.Error as err:
                        # Keep raising the original exception, but never hide this one.
                        _LOGGER.error("Could not roll back a failed Hearth write: %s", err)
                    raise
        finally:
            self._write_gate.release()

    def close(self, timeout: float = 30.0) -> None:
        """Wait (up to ``timeout`` seconds) for a writer or backup, then close the connection."""
        if not self._write_gate.acquire(timeout=timeout):
            raise TimeoutError("Hearth's database is busy (a write or backup is running)")
        try:
            with self._conn_lock:
                self._conn.close()
        finally:
            self._write_gate.release()

    # -- whole-dataset writes -------------------------------------------

    def replace_all(
        self,
        data: CRMData,
        source: str,
        *,
        replace_existing: bool = False,
        me_person_id: str | None = None,
    ) -> None:
        """Replace every data row with ``data`` in one transaction and log it.

        ``meta`` and ``change_log`` survive. For an import (``source == "import"``) this raises
        ImportRefusedError("cutover") once cutover is confirmed, and
        ImportRefusedError("local_changes") when anything but an import changed the CRM since the
        last import, unless ``replace_existing``. An import also sets the ``me_person_id``
        setting to the given value (``None`` clears it), in the same transaction, because a bundle
        is the whole CRM. Other sources leave that setting alone.
        """
        with self._write_txn():
            conn = self._conn
            if source == IMPORT_SOURCE:
                if self._cutover_confirmed():
                    raise ImportRefusedError("cutover")
                if not replace_existing and self._has_changes_since_import():
                    raise ImportRefusedError("local_changes")
            for table in _DATA_TABLES_DELETE_ORDER:
                conn.execute(f"DELETE FROM {table}")
            self._insert_all(data)
            counts = {
                "person": len(data.people),
                "household": len(data.households),
                "contact_group": len(data.groups),
                "group_member": len(data.group_members),
                "relationship": len(data.relationships),
                "interaction": len(data.interactions),
            }
            self._log(source, "all", None, "replace_all", after=json.dumps(counts))
            if source == IMPORT_SOURCE:
                self._set_meta(META_ME_PERSON, me_person_id, source)

    def export_state(self) -> tuple[CRMData, str | None]:
        """The whole dataset and the ``me_person_id`` setting, read under one lock."""
        with self._conn_lock:
            return self._read_snapshot(), self._get_meta(META_ME_PERSON)

    def _log(
        self, source: str, entity: str, entity_id: str | None, action: str,
        *, before: str | None = None, after: str | None = None,
    ) -> None:
        self._conn.execute(
            "INSERT INTO change_log (at, source, entity, entity_id, action, before, after)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (datetime.now(UTC).isoformat(), source, entity, entity_id, action, before, after),
        )

    def has_changes_since_import(self) -> bool:
        """Whether anything other than an import changed the CRM since the last import.

        An edit that was later reverted still counts.
        """
        with self._conn_lock:
            return self._has_changes_since_import()

    def _has_changes_since_import(self) -> bool:
        row = self._conn.execute(
            "SELECT 1 FROM change_log WHERE source != ? AND id >"
            " COALESCE((SELECT MAX(id) FROM change_log WHERE source = ?), 0) LIMIT 1",
            (IMPORT_SOURCE, IMPORT_SOURCE),
        ).fetchone()
        return row is not None

    def get_meta(self, key: str) -> str | None:
        with self._conn_lock:
            return self._get_meta(key)

    def _get_meta(self, key: str) -> str | None:
        row = self._conn.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def set_meta(self, key: str, value: str | None, source: str) -> None:
        """Set (or, with ``None``, remove) a setting and log it as a change from ``source``."""
        with self._write_txn():
            self._set_meta(key, value, source)

    def _set_meta(self, key: str, value: str | None, source: str) -> None:
        before = self._get_meta(key)
        if before == value:
            return
        if value is None:
            self._conn.execute("DELETE FROM meta WHERE key = ?", (key,))
        else:
            self._conn.execute(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value)
            )
        self._log(
            source, "setting", key, "set",
            before=None if before is None else json.dumps(before),
            after=None if value is None else json.dumps(value),
        )

    def set_cutover_confirmed(self) -> None:
        """Record, in the database itself, that cutover happened. There is no undo."""
        with self._write_txn():
            self._conn.execute(
                "INSERT OR REPLACE INTO meta (key, value) VALUES (?, '1')", (_META_CUTOVER,)
            )

    def cutover_confirmed(self) -> bool:
        with self._conn_lock:
            return self._cutover_confirmed()

    def _cutover_confirmed(self) -> bool:
        return self._get_meta(_META_CUTOVER) == "1"

    def _insert_all(self, data: CRMData) -> None:
        conn = self._conn
        for h in data.households:
            insert_entity(conn, "household", h)
        for p in data.people:
            insert_entity(conn, "person", p)
        for g in data.groups:
            insert_entity(conn, "contact_group", g)
        for group_id, person_id in data.group_members:
            insert_row(conn, "group_member", ["group_id", "person_id"], (group_id, person_id))
        for r in data.relationships:
            insert_entity(conn, "relationship", r)
        for i in data.interactions:
            insert_entity(conn, "interaction", i)

    # -- entity-level writes --------------------------------------------

    def insert(self, kind: EntityKind, obj: Any, source: str) -> None:
        """Add one entity and log it. An interaction's people are written in order."""
        with self._write_txn():
            insert_entity(self._conn, kind, obj)
            self._log(source, kind, obj.id, "create", after=_json(obj))

    def update(self, kind: EntityKind, obj: Any, source: str) -> None:
        """Replace one entity's whole row (and an interaction's people); KeyError if missing.

        A contact group's memberships are left alone; use ``set_group_members``.
        """
        with self._write_txn():
            before = get_entity(self._conn, kind, obj.id)
            if before is None:
                raise KeyError(f"{kind} {obj.id!r} does not exist")
            update_entity(self._conn, kind, obj)
            self._log(source, kind, obj.id, "update", before=_json(before), after=_json(obj))

    def update_google_state(self, person_id: str, changes: dict[str, Any], source: str) -> None:
        """Change only a person's ``google_*`` fields, leaving ``updated_at`` alone.

        ``changes`` maps some of the four google field names to new values. The change is logged
        as an update whose before and after hold only those fields. KeyError if no such person.
        """
        unknown = set(changes) - set(GOOGLE_FIELDS)
        if unknown:
            raise ValueError(f"not google fields: {sorted(unknown)}")
        with self._write_txn():
            row = self._conn.execute(
                f"SELECT {', '.join(GOOGLE_FIELDS)} FROM person WHERE id = ?", (person_id,)
            ).fetchone()
            if row is None:
                raise KeyError(f"person {person_id!r} does not exist")
            before = dict(zip(GOOGLE_FIELDS, row, strict=True))
            after = dict(before)
            for name, value in changes.items():
                after[name] = value.isoformat() if isinstance(value, datetime) else value
            self._conn.execute(
                f"UPDATE person SET {', '.join(f'{n} = ?' for n in GOOGLE_FIELDS)} WHERE id = ?",
                (*after.values(), person_id),
            )
            self._log(
                source, "person", person_id, "update",
                before=json.dumps(before), after=json.dumps(after),
            )

    def set_group_members(self, group_id: str, person_ids: list[str], source: str) -> None:
        """Make ``person_ids`` the group's members, logged as one change; KeyError if no group."""
        with self._write_txn():
            self._set_members(group_id, person_ids, source)

    def save_group(
        self, group: Any, member_ids: list[str] | None, source: str, *, create: bool
    ) -> None:
        """Insert or update a group and (if given) set its members, all in one transaction.

        KeyError if updating a missing group; sqlite3.IntegrityError if a member does not exist,
        in which case nothing is written.
        """
        with self._write_txn():
            if create:
                insert_entity(self._conn, "contact_group", group)
                self._log(source, "contact_group", group.id, "create", after=_json(group))
            else:
                before = get_entity(self._conn, "contact_group", group.id)
                if before is None:
                    raise KeyError(f"contact_group {group.id!r} does not exist")
                update_entity(self._conn, "contact_group", group)
                self._log(source, "contact_group", group.id, "update",
                          before=_json(before), after=_json(group))
            if member_ids is not None:
                self._set_members(group.id, member_ids, source)

    def _set_members(self, group_id: str, person_ids: list[str], source: str) -> None:
        wanted = sorted(set(person_ids))
        conn = self._conn
        if get_entity(conn, "contact_group", group_id) is None:
            raise KeyError(f"contact_group {group_id!r} does not exist")
        before = [
            r[0]
            for r in conn.execute(
                "SELECT person_id FROM group_member WHERE group_id = ? ORDER BY person_id",
                (group_id,),
            )
        ]
        conn.execute("DELETE FROM group_member WHERE group_id = ?", (group_id,))
        for person_id in wanted:
            insert_row(conn, "group_member", ["group_id", "person_id"], (group_id, person_id))
        self._log(
            source, "contact_group", group_id, "set_members",
            before=json.dumps({"person_ids": before}),
            after=json.dumps({"person_ids": wanted}),
        )

    def delete(self, kind: EntityKind, entity_id: str, source: str) -> DeleteResult:
        """Delete one entity and what hangs off it, in one transaction.

        A person's relationships and group memberships go; interactions they shared keep the
        others, and ones where they were alone are deleted. A household's members stay, with no
        household. A group's memberships go. KeyError if the entity does not exist.
        """
        result = DeleteResult()
        now = datetime.now(UTC)
        with self._write_txn():
            conn = self._conn
            obj = get_entity(conn, kind, entity_id)
            if obj is None:
                raise KeyError(f"{kind} {entity_id!r} does not exist")
            if kind == "person":
                self._delete_person_ties(entity_id, source, result, now)
                if self._get_meta(META_ME_PERSON) == entity_id:
                    self._set_meta(META_ME_PERSON, None, source)
            elif kind == "household":
                self._release_household_members(entity_id, source, now)
            elif kind == "contact_group":
                for (person_id,) in conn.execute(
                    "SELECT person_id FROM group_member WHERE group_id = ? ORDER BY person_id",
                    (entity_id,),
                ).fetchall():
                    self._remove_member(entity_id, person_id, source, result)
            conn.execute(f"DELETE FROM {kind} WHERE id = ?", (entity_id,))
            self._log(source, kind, entity_id, "delete", before=_json(obj))
            result._add(kind, entity_id)
        return result._sorted()

    def _remove_member(
        self, group_id: str, person_id: str, source: str, result: DeleteResult
    ) -> None:
        self._conn.execute(
            "DELETE FROM group_member WHERE group_id = ? AND person_id = ?",
            (group_id, person_id),
        )
        key = f"{group_id}:{person_id}"
        self._log(
            source, "group_member", key, "delete",
            before=json.dumps({"group_id": group_id, "person_id": person_id}),
        )
        result._add("group_member", key)

    def _delete_person_ties(
        self, person_id: str, source: str, result: DeleteResult, now: datetime
    ) -> None:
        conn = self._conn
        relationships = [
            relationship_from_row(r)
            for r in conn.execute(
                f"SELECT {', '.join(RELATIONSHIP_COLUMNS)} FROM relationship"
                " WHERE person_a_id = ? OR person_b_id = ? ORDER BY id",
                (person_id, person_id),
            ).fetchall()
        ]
        for rel in relationships:
            conn.execute("DELETE FROM relationship WHERE id = ?", (rel.id,))
            self._log(source, "relationship", rel.id, "delete", before=_json(rel))
            result._add("relationship", rel.id)

        for (group_id,) in conn.execute(
            "SELECT group_id FROM group_member WHERE person_id = ? ORDER BY group_id",
            (person_id,),
        ).fetchall():
            self._remove_member(group_id, person_id, source, result)

        for (interaction_id,) in conn.execute(
            "SELECT interaction_id FROM interaction_person WHERE person_id = ?"
            " ORDER BY interaction_id",
            (person_id,),
        ).fetchall():
            interaction = get_entity(conn, "interaction", interaction_id)
            if interaction.person_ids == [person_id]:
                conn.execute("DELETE FROM interaction WHERE id = ?", (interaction_id,))
                self._log(source, "interaction", interaction_id, "delete",
                          before=_json(interaction))
                result._add("interaction", interaction_id)
            else:
                conn.execute(
                    "DELETE FROM interaction_person WHERE interaction_id = ? AND person_id = ?",
                    (interaction_id, person_id),
                )
                conn.execute(
                    "UPDATE interaction SET updated_at = ? WHERE id = ?",
                    (now.isoformat(), interaction_id),
                )
                remaining = replace(
                    interaction,
                    person_ids=[p for p in interaction.person_ids if p != person_id],
                    updated_at=now,
                )
                self._log(source, "interaction", interaction_id, "update",
                          before=_json(interaction), after=_json(remaining))

    def _release_household_members(
        self, household_id: str, source: str, now: datetime
    ) -> None:
        conn = self._conn
        members = [
            person_from_row(r)
            for r in conn.execute(
                f"SELECT {', '.join(PERSON_COLUMNS)} FROM person WHERE household_id = ?"
                " ORDER BY id",
                (household_id,),
            ).fetchall()
        ]
        for person in members:
            conn.execute(
                "UPDATE person SET household_id = NULL, updated_at = ? WHERE id = ?",
                (now.isoformat(), person.id),
            )
            self._log(source, "person", person.id, "update", before=_json(person),
                      after=_json(replace(person, household_id=None, updated_at=now)))

    # -- reads ----------------------------------------------------------

    def get(self, kind: EntityKind, entity_id: str) -> Any | None:
        """One entity as its model (an interaction with its ordered ``person_ids``), or None."""
        with self._conn_lock:
            return get_entity(self._conn, kind, entity_id)

    def snapshot(self) -> CRMData:
        """Read the whole dataset back, in insertion (rowid) order."""
        with self._conn_lock:
            return self._read_snapshot()

    def _read_snapshot(self) -> CRMData:
        conn = self._conn

        def rows(columns: list[str], table: str) -> list[tuple]:
            sql = f"SELECT {', '.join(columns)} FROM {table} ORDER BY rowid"
            return conn.execute(sql).fetchall()

        members: dict[str, list[str]] = {}
        for interaction_id, person_id in conn.execute(
            "SELECT interaction_id, person_id FROM interaction_person ORDER BY position"
        ):
            members.setdefault(interaction_id, []).append(person_id)
        return CRMData(
            people=[person_from_row(r) for r in rows(PERSON_COLUMNS, "person")],
            households=[household_from_row(r) for r in rows(HOUSEHOLD_COLUMNS, "household")],
            groups=[group_from_row(r) for r in rows(GROUP_COLUMNS, "contact_group")],
            group_members=[
                (r[0], r[1]) for r in rows(["group_id", "person_id"], "group_member")
            ],
            relationships=[
                relationship_from_row(r) for r in rows(RELATIONSHIP_COLUMNS, "relationship")
            ],
            interactions=[
                interaction_from_row(r, members.get(r[0], []))
                for r in rows(INTERACTION_COLUMNS, "interaction")
            ],
        )

    def changes(self, limit: int = 50) -> list[ChangeLogEntry]:
        """Return the newest change-log entries first."""
        with self._conn_lock:
            rows = self._conn.execute(
                "SELECT id, at, source, entity, entity_id, action, before, after"
                " FROM change_log ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            ChangeLogEntry(
                id=r[0], at=parse_dt(r[1]), source=r[2], entity=r[3], entity_id=r[4],
                action=r[5],
                before=json.loads(r[6]) if r[6] else None,
                after=json.loads(r[7]) if r[7] else None,
            )
            for r in rows
        ]

    # -- backup ---------------------------------------------------------

    def begin_backup(self, timeout: float = 60.0) -> None:
        """Block writes (reads continue) and flush the WAL so the database file is self-contained.

        Raises TimeoutError if a writer or another backup holds the gate for ``timeout`` seconds.
        """
        if not self._write_gate.acquire(timeout=timeout):
            raise TimeoutError("Timed out waiting for Hearth's database writes to finish")
        try:
            with self._conn_lock:
                busy = self._conn.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone()[0]
            if busy:
                raise sqlite3.OperationalError(
                    "WAL checkpoint was blocked; database not backup-safe"
                )
        except BaseException:
            self._write_gate.release()
            raise
        self._backup_held = True

    def end_backup(self) -> None:
        """Allow writes again; a no-op if no backup holds the gate."""
        if self._backup_held:
            self._backup_held = False
            self._write_gate.release()
