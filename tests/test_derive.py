"""Tests for derived contact status, birthdays and the snapshot payload."""

from __future__ import annotations

import copy
import json
from datetime import date, datetime, timedelta, timezone

from custom_components.hearth_crm.derive import (
    age_on,
    build_snapshot,
    contact_status,
    days_until_birthday,
    upcoming_birthdays,
)
from custom_components.hearth_crm.enums import ConnectionType, InteractionType
from custom_components.hearth_crm.models import Interaction, Person

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
T = date(2026, 6, 15)


def i(days_ago: int) -> Interaction:
    return Interaction(
        id=f"i{days_ago}", summary="x", date=T - timedelta(days=days_ago),
        type=InteractionType.CATCH_UP, created_at=NOW, updated_at=NOW,
    )


def p(id: str, name: str, birthday: date | None = None, **kw) -> Person:
    return Person(id=id, name=name, birthday=birthday, created_at=NOW, updated_at=NOW, **kw)


def test_close_friend_with_no_interactions_is_overdue():
    s = contact_status([], True, T)
    assert (s.last_contacted, s.days_since_contact, s.urgency) == (None, None, "overdue")


def test_due_soon_after_35_days_overdue_after_42():
    assert contact_status([i(days_ago=35)], True, T).urgency == "ok"
    assert contact_status([i(days_ago=36)], True, T).urgency == "due_soon"
    assert contact_status([i(days_ago=42)], True, T).urgency == "due_soon"
    assert contact_status([i(days_ago=43)], True, T).urgency == "overdue"


def test_uses_latest_interaction():
    s = contact_status([i(days_ago=100), i(days_ago=3), i(days_ago=50)], True, T)
    assert (s.last_contacted, s.days_since_contact, s.urgency) == (
        T - timedelta(days=3), 3, "ok")


def test_non_close_friend_is_always_ok():
    assert contact_status([], False, T).urgency == "ok"
    s = contact_status([i(days_ago=400)], False, T)
    assert (s.days_since_contact, s.urgency) == (400, "ok")


def test_feb_29_birthday_falls_on_mar_1():
    assert days_until_birthday(date(2000, 2, 29), date(2027, 2, 28)) == 1
    assert days_until_birthday(date(2000, 2, 29), date(2027, 3, 1)) == 0
    assert days_until_birthday(date(2000, 2, 29), date(2028, 2, 28)) == 1  # leap year: Feb 29
    assert days_until_birthday(date(2000, 2, 29), date(2028, 3, 1)) == 365


def test_days_until_birthday_today_and_wraparound():
    assert days_until_birthday(date(1990, 6, 15), T) == 0
    assert days_until_birthday(date(1990, 6, 14), T) == 364


def test_age_on():
    assert age_on(date(1990, 6, 15), T) == 36
    assert age_on(date(1990, 6, 16), T) == 35
    assert age_on(date(2000, 2, 29), date(2027, 2, 28)) == 26
    assert age_on(date(2000, 2, 29), date(2027, 3, 1)) == 27


def test_upcoming_birthdays_sorted_with_turning():
    people = [
        p("a", "Zed", date(1990, 6, 20)),
        p("b", "Amy", date(1985, 6, 20)),
        p("c", "Bob", date(2000, 6, 15)),
        p("d", "NoBday"),
    ]
    result = upcoming_birthdays(people, T)
    assert [(b.name, b.days_until, b.turning) for b in result] == [
        ("Bob", 0, 26), ("Amy", 5, 41), ("Zed", 5, 36)]
    assert result[0].person_id == "c" and result[0].birthday == date(2000, 6, 15)


def test_upcoming_birthdays_within_days():
    people = [p("a", "A", date(1990, 6, 20)), p("b", "B", date(1990, 9, 1))]
    assert [b.person_id for b in upcoming_birthdays(people, T, within_days=5)] == ["a"]


def test_turning_is_none_when_year_unknown():
    people = [p("a", "A", date(1990, 6, 20), birth_year_unknown=True)]
    assert upcoming_birthdays(people, T)[0].turning is None


def test_snapshot_is_json_serializable_and_carries_derived_fields(sample):
    snap = build_snapshot(sample, me_person_id="p1", today=date(2026, 3, 1))
    json.dumps(snap, allow_nan=False)
    assert snap["me_person_id"] == "p1"
    assert snap["today"] == "2026-03-01"
    people = {x["id"]: x for x in snap["people"]}
    assert [x["id"] for x in snap["people"]] == ["p1", "p2", "p3", "p4"]
    assert people["p1"]["age"] == 45 and people["p1"]["days_until_birthday"] == 3
    assert people["p2"]["age"] is None and people["p2"]["days_until_birthday"] is not None
    assert people["p3"]["days_until_birthday"] is None and people["p3"]["age"] is None
    assert people["p1"]["contact_status"] == {
        "last_contacted": "2026-01-20", "days_since_contact": 40, "urgency": "ok"}
    # p3 is a close friend, last contact Feb 1 (28 days): ok
    assert people["p3"]["contact_status"]["urgency"] == "ok"
    assert people["p4"]["contact_status"] == {
        "last_contacted": None, "days_since_contact": None, "urgency": "ok"}
    assert people["p1"]["household_name"] == "The Examples"
    assert snap["groups"][0]["member_ids"] == ["p1", "p2"]
    assert snap["relationships"][0]["label"] == "Alex Example ↔ Blair Example"
    assert snap["relationships"][1]["label"] == "Alex Example → Casey Example"
    assert snap["relationships"][0]["type"] == ConnectionType.SPOUSE.value
    assert [x["id"] for x in snap["interactions"]] == ["i1", "i2"]


def test_snapshot_household_name_matches_naming(sample):
    sample.households[0].name_override = None
    snap = build_snapshot(sample, me_person_id=None, today=T)
    h = snap["households"][0]
    assert (h["name"], h["name_status"]) == ("Alex & Blair Example", "generated")
    assert h["member_ids"] == ["p1", "p2", "p3", "p4"]
    assert snap["me_person_id"] is None
    assert all(x["household_name"] == "Alex & Blair Example" for x in snap["people"])

    sample.households[0].name_override = "The Examples"
    h = build_snapshot(sample, me_person_id=None, today=T)["households"][0]
    assert (h["name"], h["name_status"]) == ("The Examples", "override")


def test_snapshot_person_without_household_or_name(sample):
    sample.people[3].household_id = None
    sample.people[0].household_id = "missing"
    snap = build_snapshot(sample, me_person_id=None, today=T)
    people = {x["id"]: x for x in snap["people"]}
    assert people["p4"]["household_name"] is None
    assert people["p1"]["household_name"] is None
    # a household that has no name gives its members None
    sample.households[0].name_override = None
    for pid in ("p1", "p4"):
        next(x for x in sample.people if x.id == pid).household_id = None
    sample.people[1].household_id = "h1"
    sample.people[2].household_id = "h1"
    snap = build_snapshot(sample, me_person_id=None, today=T)
    assert snap["households"][0]["name_status"] == "needs_name"
    assert {x["id"]: x["household_name"] for x in snap["people"]}["p2"] is None


def test_snapshot_dataclass_unchanged(sample):
    before = copy.deepcopy(sample)
    build_snapshot(sample, me_person_id=None, today=T)
    assert sample == before


def test_days_until_birthday_dec_31_to_jan_1():
    assert days_until_birthday(date(1990, 1, 1), date(2026, 12, 31)) == 1
    assert days_until_birthday(date(1990, 12, 31), date(2026, 12, 31)) == 0


def test_upcoming_birthdays_feb_29_edge_cases():
    people = [p("a", "A", date(2000, 2, 29))]
    r = upcoming_birthdays(people, date(2027, 2, 28))[0]
    assert (r.days_until, r.turning) == (1, 27)
    r = upcoming_birthdays(people, date(2028, 2, 29))[0]
    assert (r.days_until, r.turning) == (0, 28)


def test_future_dated_interaction_is_negative_days_and_ok():
    s = contact_status([i(days_ago=-5)], True, T)
    assert (s.days_since_contact, s.urgency) == (-5, "ok")


def test_snapshot_includes_derived_values_for_a_child(sample):
    sample.people[3].birthday = date(2015, 3, 10)
    snap = build_snapshot(sample, me_person_id=None, today=date(2026, 3, 1))
    row = {x["id"]: x for x in snap["people"]}["p4"]
    assert "hide_from_list" not in row
    assert (row["age"], row["days_until_birthday"]) == (10, 9)


def test_turning_none_when_year_unknown_and_birthday_today():
    people = [p("a", "A", T, birth_year_unknown=True)]
    r = upcoming_birthdays(people, T)[0]
    assert (r.days_until, r.turning) == (0, None)


def test_snapshot_relationship_has_inverse_type(sample):
    snap = build_snapshot(sample, me_person_id=None, today=date(2026, 3, 1))
    rel = next(r for r in snap["relationships"] if r["type"] == "Child")
    assert rel["inverse_type"] == "Parent"


def test_snapshot_lists_type_choices(sample):
    snap = build_snapshot(sample, me_person_id=None, today=date(2026, 3, 1))
    assert snap["interaction_types"][0] == "Catch-up"
    assert snap["interaction_types"] == [t.value for t in InteractionType]
    assert snap["connection_types"] == [t.value for t in ConnectionType]
