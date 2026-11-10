"""Tests for household naming and relationship labels."""

from __future__ import annotations

from datetime import date, datetime, timezone

from custom_components.hearth_crm.enums import ConnectionType as CT
from custom_components.hearth_crm.models import Person, Relationship
from custom_components.hearth_crm.naming import (
    HouseholdName,
    household_name,
    household_name_candidates,
    relationship_label,
)

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)


def p(id: str, name: str, birthday: date | None = None) -> Person:
    return Person(id=id, name=name, birthday=birthday, created_at=NOW, updated_at=NOW)


def rel(a: str, b: str, type: CT) -> Relationship:
    return Relationship(
        id=f"{a}-{b}", person_a_id=a, person_b_id=b, type=type,
        created_at=NOW, updated_at=NOW,
    )


def test_shared_last_name():
    m = [p("1", "Alex Rivera"), p("2", "Jordan Rivera")]
    assert household_name(m, [rel("1", "2", CT.SPOUSE)], None).name == "Alex & Jordan Rivera"


def test_different_last_names():
    m = [p("1", "Alex Rivera"), p("2", "Jordan Lee")]
    assert household_name(m, [rel("1", "2", CT.SPOUSE)], None).name == "Alex Rivera & Jordan Lee"


def test_multi_word_name_sharing_final_word():
    m = [
        p("1", "Maria Elena Santos de Cruz", date(1980, 1, 1)),
        p("2", "Leo Cruz", date(1982, 1, 1)),
    ]
    assert household_name(m, [rel("1", "2", CT.SPOUSE)], None).name == "Maria & Leo Cruz"


def test_single_parent_gets_family_suffix():
    m = [p("1", "Sam Ortiz"), p("2", "Kim Ortiz")]
    assert household_name(m, [rel("1", "2", CT.CHILD)], None) == HouseholdName(
        "Sam Ortiz Family", "generated"
    )


def test_partner_is_not_an_adult():
    m = [p("1", "Sam Ortiz"), p("2", "Kim Ortiz"), p("3", "Riley Moss")]
    rels = [rel("1", "3", CT.PARTNER), rel("1", "2", CT.CHILD)]
    assert household_name(m, rels, None).name == "Sam Ortiz Family"


def test_parent_link_direction():
    m = [p("1", "Kim Ortiz"), p("2", "Sam Ortiz")]
    assert household_name(m, [rel("1", "2", CT.PARENT)], None).name == "Sam Ortiz Family"


def test_three_generations_middle_counts_as_adult_and_three_adults_needs_name():
    m = [p("1", "Gran Ortiz", date(1950, 1, 1)), p("2", "Sam Ortiz", date(1975, 1, 1)),
         p("3", "Kim Ortiz", date(2005, 1, 1))]
    rels = [rel("1", "2", CT.CHILD), rel("2", "3", CT.CHILD)]
    assert household_name(m, rels, None).name == "Gran & Sam Ortiz"
    m3 = m + [p("4", "Pat Moss")]
    rels3 = rels + [rel("2", "4", CT.SPOUSE)]
    assert household_name(m3, rels3, None) == HouseholdName(None, "needs_name")


def test_override_wins_and_is_stripped():
    m = [p("1", "Alex Rivera")]
    assert household_name(m, [], "  The Riveras ") == HouseholdName("The Riveras", "override")


def test_blank_override_is_ignored():
    m = [p("1", "Alex Rivera")]
    assert household_name(m, [], "   ").status == "not_a_household"


def test_single_member_is_not_a_household():
    assert household_name([p("1", "Alex Rivera")], [], None) == HouseholdName(
        None, "not_a_household"
    )


def test_two_members_no_links_needs_name():
    m = [p("1", "Alex Rivera"), p("2", "Jordan Lee")]
    assert household_name(m, [], None) == HouseholdName(None, "needs_name")


def test_links_to_non_members_ignored():
    m = [p("1", "Alex Rivera"), p("2", "Jordan Lee")]
    assert household_name(m, [rel("1", "9", CT.CHILD)], None).status == "needs_name"


def test_adult_via_multiple_links_counts_once():
    m = [p("1", "Sam Ortiz"), p("2", "Kim Ortiz"), p("3", "Lee Ortiz")]
    rels = [rel("1", "2", CT.CHILD), rel("1", "3", CT.CHILD)]
    assert household_name(m, rels, None).name == "Sam Ortiz Family"


def test_blank_adult_name_needs_name():
    m = [p("1", "   "), p("2", "Kim Ortiz")]
    assert household_name(m, [rel("1", "2", CT.CHILD)], None).status == "needs_name"


def test_whitespace_normalized():
    m = [p("1", "Alex  Rivera "), p("2", "Jordan Rivera")]
    assert household_name(m, [rel("1", "2", CT.SPOUSE)], None).name == "Alex & Jordan Rivera"


def test_case_insensitive_last_name():
    m = [p("1", "Alex McKay"), p("2", "Jo Mckay")]
    assert household_name(m, [rel("1", "2", CT.SPOUSE)], None).name == "Alex & Jo McKay"


def test_order_older_first():
    m = [
        p("1", "Jordan Lee", date(1990, 1, 1)),
        p("2", "Alex Rivera", date(1980, 1, 1)),
    ]
    assert household_name(m, [rel("1", "2", CT.SPOUSE)], None).name == "Alex Rivera & Jordan Lee"


def test_order_no_birthday_last_then_name():
    m = [p("1", "Zed Lee"), p("2", "Amy Lee"), p("3", "Bo Lee", date(2000, 1, 1))]
    rels = [rel("1", "2", CT.SPOUSE), rel("2", "3", CT.SPOUSE)]
    # three adults here; use two instead
    assert household_name(m[:2], rels[:1], None).name == "Amy & Zed Lee"
    m2 = [p("1", "Zed Lee"), p("3", "Bo Lee", date(2000, 1, 1))]
    assert household_name(m2, [rel("1", "3", CT.SPOUSE)], None).name == "Bo & Zed Lee"


def test_relationship_labels():
    assert relationship_label("A", "B", CT.CHILD) == "A → B"
    assert relationship_label("A", "B", CT.SPOUSE) == "A ↔ B"


def test_candidates_accept_either_adult_order_shared_last_name():
    m = [p("1", "Alex Rivera", date(1985, 1, 1)), p("2", "Jordan Rivera", date(1980, 1, 1))]
    rels = [rel("1", "2", CT.SPOUSE)]
    assert household_name(m, rels, None).name == "Jordan & Alex Rivera"
    assert household_name_candidates(m, rels, None) == [
        "Jordan & Alex Rivera", "Alex & Jordan Rivera"]


def test_candidates_accept_either_adult_order_different_last_names():
    m = [p("1", "Alex Rivera", date(1985, 1, 1)), p("2", "Jordan Lee", date(1980, 1, 1))]
    rels = [rel("1", "2", CT.SPOUSE)]
    assert household_name_candidates(m, rels, None) == [
        "Jordan Lee & Alex Rivera", "Alex Rivera & Jordan Lee"]


def test_candidates_single_adult_override_and_no_name():
    kids = [p("1", "Alex Rivera"), p("2", "Sam Rivera")]
    assert household_name_candidates(kids, [rel("1", "2", CT.CHILD)], None) == [
        "Alex Rivera Family"]
    assert household_name_candidates(kids, [], " The Riveras ") == ["The Riveras"]
    assert household_name_candidates(kids, [], None) == []
