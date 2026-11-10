"""Tests for entity-level writes and deletes on CRMRepository."""

from __future__ import annotations

import sqlite3
from dataclasses import replace
from datetime import date

import pytest

from custom_components.hearth_crm.db import CRMRepository, open_database
from custom_components.hearth_crm.enums import ConnectionType, InteractionType
from custom_components.hearth_crm.models import (
    ContactGroup,
    CRMData,
    Household,
    Interaction,
    Person,
    Place,
    Relationship,
)
from custom_components.hearth_crm.serialize import to_dict
from tests.conftest import T0, T1, sample_data


@pytest.fixture
def repo(tmp_path):
    conn = open_database(tmp_path / "db.sqlite")
    yield CRMRepository(conn)
    conn.close()


def person(pid: str, **kw) -> Person:
    return Person(id=pid, name=f"Person {pid}", created_at=T0, updated_at=T0, **kw)


def seeded(repo, data: CRMData) -> None:
    repo.replace_all(data, source="import")


def test_insert_get_round_trip_every_kind(repo):
    data = sample_data()
    seeded(repo, CRMData(people=data.people, households=data.households, groups=data.groups))
    rel = data.relationships[0]
    interaction = data.interactions[0]  # people ["p2", "p1"]: order must survive
    repo.insert("relationship", rel, "panel")
    repo.insert("interaction", interaction, "panel")
    assert repo.get("relationship", "r1") == rel
    assert repo.get("interaction", "i1") == interaction
    assert repo.get("person", "p1") == data.people[0]
    assert repo.get("household", "h1") == data.households[0]
    assert repo.get("contact_group", "g1") == data.groups[0]
    assert repo.get("person", "nope") is None
    new = person("p9", address=Place(formatted="1 Test Rd"), favorite=True,
                 birthday=date(1990, 1, 2))
    repo.insert("person", new, "panel")
    assert repo.get("person", "p9") == new


def test_insert_update_log_before_and_after(repo):
    p = person("p1")
    repo.insert("person", p, "panel")
    changed = replace(p, name="New Name", updated_at=T1, notes="n")
    repo.update("person", changed, "claude")
    update, create = repo.changes()
    assert (create.source, create.entity, create.entity_id, create.action) == (
        "panel", "person", "p1", "create")
    assert create.before is None and create.after == to_dict(p)
    assert (update.source, update.entity, update.entity_id, update.action) == (
        "claude", "person", "p1", "update")
    assert update.before == to_dict(p) and update.after == to_dict(changed)
    assert repo.get("person", "p1") == changed


def test_update_replaces_interaction_people_in_order(repo):
    seeded(repo, sample_data())
    i = repo.get("interaction", "i1")
    changed = replace(i, person_ids=["p3", "p1", "p4"])
    repo.update("interaction", changed, "panel")
    assert repo.get("interaction", "i1").person_ids == ["p3", "p1", "p4"]
    assert repo.changes()[0].before["person_ids"] == ["p2", "p1"]


def test_update_missing_raises_key_error(repo):
    with pytest.raises(KeyError):
        repo.update("person", person("ghost"), "panel")
    assert repo.changes() == []


def test_update_group_leaves_memberships(repo):
    seeded(repo, sample_data())
    g = repo.get("contact_group", "g1")
    repo.update("contact_group", replace(g, name="Renamed"), "panel")
    assert repo.snapshot().group_members == [("g1", "p1"), ("g1", "p2")]


def test_failed_insert_rolls_back_and_logs_nothing(repo):
    seeded(repo, sample_data())
    count = len(repo.changes())
    bad = Relationship(id="rx", person_a_id="p1", person_b_id="missing",
                       type=ConnectionType.FRIEND, created_at=T0, updated_at=T0)
    with pytest.raises(Exception, match="FOREIGN KEY"):
        repo.insert("relationship", bad, "panel")
    assert repo.get("relationship", "rx") is None
    assert len(repo.changes()) == count


def test_set_group_members_replaces(repo):
    seeded(repo, sample_data())
    repo.set_group_members("g1", ["p3", "p2", "p3"], "panel")
    assert sorted(repo.snapshot().group_members) == [("g1", "p2"), ("g1", "p3")]
    entry = repo.changes()[0]
    assert (entry.entity, entry.entity_id, entry.action) == ("contact_group", "g1", "set_members")
    assert entry.before == {"person_ids": ["p1", "p2"]}
    assert entry.after == {"person_ids": ["p2", "p3"]}
    assert len([c for c in repo.changes() if c.source == "panel"]) == 1
    with pytest.raises(KeyError):
        repo.set_group_members("nope", [], "panel")


def person_delete_data() -> CRMData:
    def inter(iid, pids):
        return Interaction(id=iid, summary=iid, date=date(2026, 1, 1),
                           type=InteractionType.CATCH_UP, created_at=T0, updated_at=T0,
                           person_ids=pids)

    return CRMData(
        people=[person("p1", household_id="h1"), person("p2", household_id="h1")],
        households=[Household(id="h1", created_at=T0, updated_at=T0)],
        groups=[ContactGroup(id="g", name="G", created_at=T0, updated_at=T0)],
        group_members=[("g", "p1"), ("g", "p2")],
        relationships=[
            Relationship(id="r1", person_a_id="p1", person_b_id="p2",
                         type=ConnectionType.SPOUSE, created_at=T0, updated_at=T0),
            Relationship(id="r0", person_a_id="p2", person_b_id="p1",
                         type=ConnectionType.FRIEND, created_at=T0, updated_at=T0),
        ],
        interactions=[inter("i1", ["p2", "p1"]), inter("i2", ["p1"])],
    )


def test_delete_person_semantics(repo):
    seeded(repo, person_delete_data())
    result = repo.delete("person", "p1", "panel")
    assert result.deleted == {"person": ["p1"], "relationship": ["r0", "r1"],
                              "group_member": ["g:p1"], "interaction": ["i2"]}
    data = repo.snapshot()
    assert [p.id for p in data.people] == ["p2"]
    assert data.relationships == []
    assert data.group_members == [("g", "p2")]
    assert [i.id for i in data.interactions] == ["i1"]
    assert repo.get("interaction", "i1").person_ids == ["p2"]
    assert repo.get("interaction", "i2") is None


def test_delete_person_logs_one_row_per_removed_entity(repo):
    seeded(repo, person_delete_data())
    before = repo.get("person", "p1")
    repo.delete("person", "p1", "claude")
    logged = [c for c in repo.changes() if c.source == "claude"]
    by_entity = sorted((c.entity, c.entity_id, c.action) for c in logged)
    assert by_entity == [
        ("group_member", "g:p1", "delete"),
        ("interaction", "i1", "update"),  # shared: loses p1
        ("interaction", "i2", "delete"),
        ("person", "p1", "delete"),
        ("relationship", "r0", "delete"),
        ("relationship", "r1", "delete"),
    ]
    person_row = next(c for c in logged if c.entity == "person")
    assert person_row.before == to_dict(before) and person_row.after is None
    solo = next(c for c in logged if (c.entity, c.entity_id) == ("interaction", "i2"))
    assert solo.before["person_ids"] == ["p1"] and solo.after is None
    member = next(c for c in logged if c.entity == "group_member")
    assert member.before == {"group_id": "g", "person_id": "p1"}
    shared = next(c for c in logged if (c.entity, c.entity_id) == ("interaction", "i1"))
    assert shared.before["person_ids"] == ["p2", "p1"] and shared.after["person_ids"] == ["p2"]


def test_delete_person_is_one_transaction(repo, monkeypatch):
    seeded(repo, person_delete_data())
    before = repo.snapshot()
    count = len(repo.changes(limit=100))
    original = repo._log

    def failing_log(source, entity, *args, **kw):
        if entity == "person":
            raise RuntimeError("boom")
        original(source, entity, *args, **kw)

    monkeypatch.setattr(repo, "_log", failing_log)
    with pytest.raises(RuntimeError):
        repo.delete("person", "p1", "panel")
    monkeypatch.undo()
    assert repo.snapshot() == before
    assert len(repo.changes(limit=100)) == count


def test_delete_household_keeps_members(repo):
    seeded(repo, person_delete_data())
    result = repo.delete("household", "h1", "panel")
    assert result.deleted == {"household": ["h1"]}
    assert [p.household_id for p in repo.snapshot().people] == [None, None]
    assert len(repo.snapshot().people) == 2
    assert repo.get("household", "h1") is None
    logged = [(c.entity, c.entity_id, c.action) for c in repo.changes() if c.source == "panel"]
    assert sorted(logged) == [("household", "h1", "delete"), ("person", "p1", "update"),
                              ("person", "p2", "update")]


def test_delete_group_removes_memberships_only(repo):
    seeded(repo, person_delete_data())
    result = repo.delete("contact_group", "g", "panel")
    assert result.deleted == {"contact_group": ["g"], "group_member": ["g:p1", "g:p2"]}
    data = repo.snapshot()
    assert data.groups == [] and data.group_members == [] and len(data.people) == 2


def test_delete_relationship_and_interaction(repo):
    seeded(repo, person_delete_data())
    assert repo.delete("relationship", "r1", "panel").deleted == {"relationship": ["r1"]}
    assert repo.delete("interaction", "i1", "panel").deleted == {"interaction": ["i1"]}
    data = repo.snapshot()
    assert [r.id for r in data.relationships] == ["r0"]
    assert [i.id for i in data.interactions] == ["i2"]
    assert len(data.people) == 2
    assert repo._conn.execute(
        "SELECT COUNT(*) FROM interaction_person WHERE interaction_id = 'i1'").fetchone() == (0,)
    entry = repo.changes()[0]
    assert entry.before["person_ids"] == ["p2", "p1"] and entry.after is None


@pytest.mark.parametrize(
    "kind", ["person", "household", "contact_group", "relationship", "interaction"]
)
def test_delete_missing_raises_key_error(repo, kind):
    with pytest.raises(KeyError):
        repo.delete(kind, "ghost", "panel")
    assert repo.changes() == []


def test_delete_me_person_clears_the_setting_and_export_round_trips(repo, tmp_path):
    from custom_components.hearth_crm.bundle import read_bundle, write_bundle
    from custom_components.hearth_crm.db import META_ME_PERSON

    repo.replace_all(person_delete_data(), source="import", me_person_id="p1")
    repo.delete("person", "p1", "panel")
    data, me = repo.export_state()
    assert me is None
    write_bundle(tmp_path / "out.zip", data, lambda h: b"", me_person_id=me)
    assert read_bundle(tmp_path / "out.zip").me_person_id is None
    setting = next(c for c in repo.changes() if c.entity == "setting")
    assert (setting.source, setting.entity_id, setting.after) == ("panel", META_ME_PERSON, None)


def test_delete_other_person_keeps_the_me_setting(repo):
    repo.replace_all(person_delete_data(), source="import", me_person_id="p2")
    repo.delete("person", "p1", "panel")
    assert repo.export_state()[1] == "p2"


@pytest.mark.parametrize("op", ["get", "insert", "update", "delete"])
def test_unknown_kind_raises_value_error(repo, op):
    calls = {
        "get": lambda: repo.get("bogus", "x"),
        "insert": lambda: repo.insert("bogus", person("x"), "panel"),
        "update": lambda: repo.update("bogus", person("x"), "panel"),
        "delete": lambda: repo.delete("bogus", "x", "panel"),
    }
    with pytest.raises(ValueError, match="bogus"):
        calls[op]()
    assert repo.changes() == []


def test_cascade_updates_bump_updated_at(repo):
    seeded(repo, person_delete_data())
    repo.delete("person", "p1", "panel")
    shared = repo.get("interaction", "i1")
    assert shared.updated_at > T0
    row = next(c for c in repo.changes() if (c.entity, c.entity_id) == ("interaction", "i1"))
    assert row.after["updated_at"] == shared.updated_at.isoformat()
    assert row.before["updated_at"] == T0.isoformat()

    seeded2 = person_delete_data()
    repo.replace_all(seeded2, source="sync")
    repo.delete("household", "h1", "panel")
    member = repo.get("person", "p2")
    assert member.household_id is None and member.updated_at > T0
    row = next(c for c in repo.changes() if (c.entity, c.entity_id) == ("person", "p2"))
    assert row.after["updated_at"] == member.updated_at.isoformat()


def test_failed_rollback_does_not_mask_the_original_error(repo):
    class Conn:
        def __init__(self, real):
            self.real = real

        def execute(self, sql, *a):
            if sql == "ROLLBACK":
                raise sqlite3.OperationalError("rollback failed")
            return self.real.execute(sql, *a)

    real = repo._conn
    repo._conn = Conn(real)
    try:
        with pytest.raises(RuntimeError, match="original"):
            with repo._write_txn():
                raise RuntimeError("original")
    finally:
        repo._conn = real
        real.execute("ROLLBACK")
