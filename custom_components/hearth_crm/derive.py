"""Derived values and the snapshot payload (pure: no Home Assistant imports, no I/O).

The one home for rules the panel, cards, entities and Claude all show: contact urgency,
birthdays, ages, household names and relationship labels. ``today`` is always passed in.
"""

from __future__ import annotations

import calendar
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal

from .enums import ConnectionType, InteractionType
from .models import CRMData, Interaction, Person
from .naming import household_name, relationship_label
from .serialize import to_dict

CLOSE_FRIEND_CADENCE_DAYS = 42
DUE_SOON_WINDOW_DAYS = 7

Urgency = Literal["ok", "due_soon", "overdue"]


@dataclass(frozen=True)
class ContactStatus:
    last_contacted: date | None
    days_since_contact: int | None
    urgency: Urgency


def contact_status(
    interactions: list[Interaction], close_friend: bool, today: date
) -> ContactStatus:
    """Only close friends can be due or overdue; none at all counts as overdue."""
    if not interactions:
        return ContactStatus(None, None, "overdue" if close_friend else "ok")
    last = max(i.date for i in interactions)
    days = (today - last).days
    urgency: Urgency = "ok"
    if close_friend and days > CLOSE_FRIEND_CADENCE_DAYS:
        urgency = "overdue"
    elif close_friend and days > CLOSE_FRIEND_CADENCE_DAYS - DUE_SOON_WINDOW_DAYS:
        urgency = "due_soon"
    return ContactStatus(last, days, urgency)


def _in_year(birthday: date, year: int) -> date:
    """The birthday in ``year``; a Feb 29 birthday falls on Mar 1 in non-leap years."""
    if birthday.month == 2 and birthday.day == 29 and not calendar.isleap(year):
        return date(year, 3, 1)
    return date(year, birthday.month, birthday.day)


def days_until_birthday(birthday: date, today: date) -> int:
    """Days until the next occurrence; 0 when it is today."""
    nxt = _in_year(birthday, today.year)
    if nxt < today:
        nxt = _in_year(birthday, today.year + 1)
    return (nxt - today).days


def age_on(birthday: date, today: date) -> int:
    """Completed years on ``today`` (a Feb 29 birthday counts as Mar 1 in non-leap years)."""
    years = today.year - birthday.year
    if today < _in_year(birthday, today.year):
        years -= 1
    return years


@dataclass(frozen=True)
class UpcomingBirthday:
    person_id: str
    name: str
    birthday: date
    days_until: int
    turning: int | None  # None when the birth year is unknown


def upcoming_birthdays(
    people: list[Person],
    today: date,
    *,
    within_days: int | None = None,
) -> list[UpcomingBirthday]:
    result: list[UpcomingBirthday] = []
    for person in people:
        if person.birthday is None:
            continue
        days = days_until_birthday(person.birthday, today)
        if within_days is not None and days > within_days:
            continue
        turning = None
        if not person.birth_year_unknown:
            turning = age_on(person.birthday, today) + (1 if days else 0)
        result.append(
            UpcomingBirthday(person.id, person.name, person.birthday, days, turning)
        )
    result.sort(key=lambda b: (b.days_until, b.name))
    return result


def build_snapshot(
    data: CRMData, *, me_person_id: str | None, today: date
) -> dict[str, Any]:
    """The JSON-serializable payload every surface renders from."""
    people_by_id = {p.id: p for p in data.people}
    members_by_household: dict[str, list[Person]] = defaultdict(list)
    for person in data.people:
        if person.household_id is not None:
            members_by_household[person.household_id].append(person)
    interactions_by_person: dict[str, list[Interaction]] = defaultdict(list)
    for interaction in data.interactions:
        for pid in set(interaction.person_ids):
            interactions_by_person[pid].append(interaction)
    group_members: dict[str, list[str]] = defaultdict(list)
    for group_id, person_id in data.group_members:
        group_members[group_id].append(person_id)

    names = {
        h.id: household_name(
            members_by_household.get(h.id, []), data.relationships, h.name_override
        )
        for h in data.households
    }

    people = []
    for person in data.people:
        row = to_dict(person)
        status = contact_status(
            interactions_by_person.get(person.id, []), person.close_friend, today
        )
        row["contact_status"] = {
            "last_contacted": status.last_contacted.isoformat()
            if status.last_contacted
            else None,
            "days_since_contact": status.days_since_contact,
            "urgency": status.urgency,
        }
        row["days_until_birthday"] = (
            days_until_birthday(person.birthday, today) if person.birthday else None
        )
        row["age"] = (
            age_on(person.birthday, today)
            if person.birthday and not person.birth_year_unknown
            else None
        )
        household = names.get(person.household_id) if person.household_id else None
        row["household_name"] = household.name if household else None
        people.append(row)

    households = []
    for household in data.households:
        row = to_dict(household)
        row["name"] = names[household.id].name
        row["name_status"] = names[household.id].status
        row["member_ids"] = sorted(p.id for p in members_by_household.get(household.id, []))
        households.append(row)

    groups = []
    for group in data.groups:
        row = to_dict(group)
        row["member_ids"] = sorted(group_members.get(group.id, []))
        groups.append(row)

    relationships = []
    for rel in data.relationships:
        row = to_dict(rel)
        a, b = people_by_id.get(rel.person_a_id), people_by_id.get(rel.person_b_id)
        row["label"] = relationship_label(
            a.name if a else rel.person_a_id, b.name if b else rel.person_b_id, rel.type
        )
        row["inverse_type"] = ConnectionType(rel.type).inverse.value
        relationships.append(row)

    return {
        "people": people,
        "households": households,
        "groups": groups,
        "relationships": relationships,
        "interactions": [to_dict(i) for i in data.interactions],
        "interaction_types": [t.value for t in InteractionType],
        "connection_types": [t.value for t in ConnectionType],
        "me_person_id": me_person_id,
        "today": today.isoformat(),
    }
