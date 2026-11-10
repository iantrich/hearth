"""Tests for the pure search, similar-name, ordering and date helpers (invented people only)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from custom_components.hearth_crm.derive import build_snapshot
from custom_components.hearth_crm.enums import ConnectionType, InteractionType
from custom_components.hearth_crm.llm_logic import (
    find_relationship,
    parse_birthday,
    reach_out,
    search_people,
    similar_people,
    upcoming,
)
from custom_components.hearth_crm.models import (
    ContactGroup,
    CRMData,
    Household,
    Interaction,
    Person,
    Relationship,
)

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
TODAY = date(2026, 6, 15)


def person(id: str, name: str, **kw) -> Person:
    return Person(id=id, name=name, created_at=NOW, updated_at=NOW, **kw)


def snap(people, *, relationships=(), groups=(), group_members=(), households=(),
         interactions=(), me=None):
    data = CRMData(
        people=list(people), relationships=list(relationships), groups=list(groups),
        group_members=list(group_members), households=list(households),
        interactions=list(interactions),
    )
    return build_snapshot(data, me_person_id=me, today=TODAY)


def link(id, a, b, type):
    return Relationship(id=id, person_a_id=a, person_b_id=b, type=type,
                        created_at=NOW, updated_at=NOW)


def contacted(id, person_id, days_ago):
    return Interaction(id=id, summary="x", date=TODAY - timedelta(days=days_ago),
                       type=InteractionType.CATCH_UP, created_at=NOW, updated_at=NOW,
                       person_ids=[person_id])


def names(briefs):
    return [b["name"] for b in briefs]


# Intended similar. The pairs after the first block document the rule's deliberate reach:
# words that differ only in vowels (same 3+ consonants), prefixes, or one letter are flagged,
# because a false positive costs one confirmation while a miss creates a duplicate.
SIMILAR = [
    ("Lorenzo Mantana", "Lorenzo Montana Ruiz"),  # misheard surname
    ("Jon Smith", "John Smith"),
    ("Sara Lee", "Sarah Lee"),
    ("Chris Park", "Christopher Park"),  # nickname as a prefix
    ("Alex", "Alex Chen"),  # first name only
    ("Alex Chen", "Alex Chen"),
    ("Martin Reed", "Morton Reed"),
    ("Peter Hall", "Pieter Hill"),
    ("Carla Mendez", "Carlo Mendoza"),
    ("Ray Tran", "Ray Tron"),
    ("Sam Hill", "Samantha Holly"),
    ("Eric Stone", "Erica Stein"),
    ("Mary Smith", "Mario Smith"),
    ("Kim Lee", "Kim Le"),
    ("Jane Marie Zed", "Jane Marie Park"),  # only the middle name agrees
    ("Al Bo Chen", "Albo Chen"),  # first words differ; the whole name is nearly identical
]
DIFFERENT = [
    ("Alex Rivera", "Alex Chen"),
    ("Maria Lopez", "Mario Gomez"),
    ("Dana Ortiz", "Dan Ortega"),
    ("Sam Hill", "Tom Hill"),
    ("Jane Marie Zed", "Jane Rose Park"),
    ("Priya Nair", "Owen Walsh"),
    ("Hector Vale", "Heidi Brandt"),
]


@pytest.mark.parametrize(("heard", "existing"), SIMILAR)
def test_similar_people_flags_misheard_and_nickname_pairs(heard, existing):
    assert names(similar_people(snap([person("p1", existing)]), heard)) == [existing]


@pytest.mark.parametrize(("heard", "existing"), DIFFERENT)
def test_similar_people_ignores_different_people(heard, existing):
    assert similar_people(snap([person("p1", existing)]), heard) == []


def test_similar_people_ignores_accents_and_case():
    s = snap([person("p1", "José Núñez")])
    assert names(similar_people(s, "JOSE NUNEZ")) == ["José Núñez"]


def test_similar_people_orders_best_first_and_limits():
    s = snap([person("p1", "Alex Chen Wu"), person("p2", "Alex Chen"), person("p3", "Alex Cho")])
    assert names(similar_people(s, "Alex Chen"))[0] == "Alex Chen"
    assert len(similar_people(s, "Alex Chen", limit=2)) == 2


def test_search_people_caps_results_and_says_it_truncated():
    s = snap([person(f"p{i}", f"Anna {i:02}") for i in range(60)])
    result = search_people(s, query="a", limit=25)
    assert (result["total"], result["returned"], result["truncated"]) == (60, 25, True)
    assert len(result["people"]) == 25
    assert (result["connected_total"], result["connected_truncated"]) == (0, False)


def test_search_people_says_when_connected_people_were_cut():
    people = [person("hub", "Hub Ng")] + [person(f"k{i}", f"Kid {i}") for i in range(3)]
    s = snap(people, relationships=[link(f"r{i}", "hub", f"k{i}", ConnectionType.CHILD)
                                    for i in range(3)])
    result = search_people(s, query="hub", limit=2)
    assert len(result["connected"]) == 2
    assert (result["connected_total"], result["connected_truncated"]) == (3, True)


def test_search_people_filters_by_group_household_and_how_i_know_them_together():
    people = [
        person("p1", "Ana Ruiz", household_id="h1", how_i_know_them="Book club"),
        person("p2", "Ana Wu", household_id="h1", how_i_know_them="Neighbors"),
        person("p3", "Ana Day", household_id="h2", how_i_know_them="Book club"),
    ]
    s = snap(
        people,
        households=[Household(id="h1", created_at=NOW, updated_at=NOW, name_override="The Ruiz Family"),
                    Household(id="h2", created_at=NOW, updated_at=NOW, name_override="Day Home")],
        groups=[ContactGroup(id="g1", name="Hikers", created_at=NOW, updated_at=NOW)],
        group_members=[("g1", "p1"), ("g1", "p2")],
    )
    result = search_people(s, group="hik", household="RUIZ", how_i_know_them="book")
    assert names(result["people"]) == ["Ana Ruiz"]
    assert result["people"][0]["household_name"] == "The Ruiz Family"
    assert names(search_people(s, group="hik")["people"]) == ["Ana Ruiz", "Ana Wu"]
    # With a query too: all four filters must hold.
    assert names(search_people(s, query="ruiz", group="hik", household="ruiz",
                               how_i_know_them="book")["people"]) == ["Ana Ruiz"]
    assert search_people(s, query="wu", group="hik", household="ruiz",
                         how_i_know_them="book")["people"] == []
    assert search_people(s, query="day", group="hik")["people"] == []


def test_search_people_is_accent_insensitive():
    s = snap([person("p1", "Zoë Kid")])
    result = search_people(s, query="zoe")
    assert names(result["people"]) == ["Zoë Kid"]
    assert "hidden" not in result["people"][0]


def test_search_people_connected_matches_read_from_the_matched_persons_side():
    people = [person("phil", "Phil Ford"), person("josie", "Josie Ford"), person("kay", "Kay Ford")]
    # Josie (B) is Phil's Child, so Phil (A) is Josie's Parent.
    s = snap(people, relationships=[link("r1", "phil", "josie", ConnectionType.CHILD)])
    by_phil = search_people(s, query="phil")
    assert [(c["person"]["name"], c["reason"]) for c in by_phil["connected"]] == [
        ("Josie Ford", "Child of Phil Ford")]
    by_josie = search_people(s, query="josie")
    assert [(c["person"]["name"], c["reason"]) for c in by_josie["connected"]] == [
        ("Phil Ford", "Parent of Josie Ford")]
    assert search_people(s)["connected"] == []


def test_reach_out_orders_never_contacted_first_then_most_overdue():
    people = [person(i, i.title(), close_friend=True) for i in ("a", "b", "c", "d", "e", "n")]
    people.append(person("far", "Not Close"))
    s = snap(people, interactions=[
        contacted("i1", "a", 50), contacted("i2", "b", 80), contacted("i3", "c", 40),
        contacted("i4", "d", 36), contacted("i5", "e", 10)])
    result = reach_out(s)
    assert names(result["overdue"]) == ["N", "B", "A"]  # never contacted, then 80d, then 50d
    assert names(result["due_soon"]) == ["C", "D"]
    assert (result["overdue_total"], result["due_soon_total"], result["total"]) == (3, 2, 5)
    assert (result["returned"], result["truncated"]) == (5, False)


def test_reach_out_applies_the_limit_to_each_list():
    people = [person(f"o{i}", f"Old {i}", close_friend=True) for i in range(3)]
    people += [person(f"d{i}", f"Soon {i}", close_friend=True) for i in range(3)]
    s = snap(people, interactions=(
        [contacted(f"i{i}", f"o{i}", 60 + i) for i in range(3)]
        + [contacted(f"j{i}", f"d{i}", 36 + i) for i in range(3)]))
    result = reach_out(s, limit=2)
    assert names(result["overdue"]) == ["Old 2", "Old 1"]
    assert names(result["due_soon"]) == ["Soon 2", "Soon 1"]
    assert (result["overdue_total"], result["due_soon_total"], result["total"]) == (3, 3, 6)
    assert (result["returned"], result["truncated"]) == (4, True)
    one_cut = reach_out(s, limit=3)
    assert one_cut["truncated"] is False


def test_upcoming_uses_the_snapshots_days_until():
    people = [
        person("p1", "Ada Soon", birthday=date(1990, 6, 20)),
        person("p2", "Bo Today", birthday=date(1985, 6, 15)),
        person("p3", "Cy NoYear", birthday=date(2000, 7, 1), birth_year_unknown=True),
        person("p4", "Di Kid", birthday=date(2014, 6, 18)),
        person("p5", "Ed Far", birthday=date(1990, 12, 1)),
        person("p6", "Flo None"),
    ]
    s = snap(people)
    result = upcoming(s)
    assert [(b["person"]["name"], b["days_until"], b["turning"], b["birthday"])
            for b in result["birthdays"]] == [
        ("Bo Today", 0, 41, "1985-06-15"),
        ("Di Kid", 3, 12, "2014-06-18"),
        ("Ada Soon", 5, 36, "1990-06-20"),
        ("Cy NoYear", 16, None, "2000-07-01"),
    ]
    assert upcoming(s, within_days=1)["total"] == 1
    assert upcoming(s, limit=1)["truncated"] is True
    assert (result["total"], result["returned"]) == (4, 4)


def test_find_relationship_matches_either_orientation():
    people = [person("phil", "Phil"), person("josie", "Josie")]
    row = link("r1", "phil", "josie", ConnectionType.CHILD)
    s = snap(people, relationships=[row])
    assert find_relationship(s, "phil", "josie", "Child")["id"] == "r1"
    assert find_relationship(s, "josie", "phil", "Parent")["id"] == "r1"
    assert find_relationship(s, "josie", "phil", "Child") is None
    assert find_relationship(s, "phil", "josie", "Parent") is None
    assert find_relationship(s, "phil", "other", "Child") is None


def test_parse_birthday_forms_and_errors():
    assert parse_birthday("1990-03-04") == (date(1990, 3, 4), False)
    assert parse_birthday("03-04") == (date(2000, 3, 4), True)
    assert parse_birthday("02-29") == (date(2000, 2, 29), True)
    for bad in ("tomorrow", "13-40", "1990-02-30", "", "19900304", "1990-W10-1", "0304"):
        with pytest.raises(ValueError, match=r"YYYY-MM-DD.*MM-DD"):
            parse_birthday(bad)
