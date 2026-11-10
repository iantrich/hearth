"""Household naming and relationship labels."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from .enums import ConnectionType
from .models import Person, Relationship

NameStatus = Literal["generated", "override", "needs_name", "not_a_household"]


@dataclass(frozen=True)
class HouseholdName:
    name: str | None
    status: NameStatus


def _clean(name: str) -> str:
    return " ".join(name.split())


def household_adults(
    members: list[Person], relationships: list[Relationship]
) -> list[Person]:
    """Members who are parents or spouses of another member, oldest first."""
    ids = {m.id for m in members}
    adult_ids: set[str] = set()
    for r in relationships:
        if r.person_a_id not in ids or r.person_b_id not in ids:
            continue
        if r.type is ConnectionType.CHILD:
            adult_ids.add(r.person_a_id)
        elif r.type is ConnectionType.PARENT:
            adult_ids.add(r.person_b_id)
        elif r.type is ConnectionType.SPOUSE:
            adult_ids.update((r.person_a_id, r.person_b_id))
    adults = [m for m in members if m.id in adult_ids]
    adults.sort(
        key=lambda m: (m.birthday is None, m.birthday or date.min, _clean(m.name))
    )
    return adults


def _two_adult_name(a: str, b: str) -> str:
    last_a, last_b = a.split()[-1], b.split()[-1]
    if last_a.casefold() == last_b.casefold():
        return f"{a.split()[0]} & {b.split()[0]} {last_a}"
    return f"{a} & {b}"


def household_name(
    members: list[Person],
    relationships: list[Relationship],
    override: str | None,
) -> HouseholdName:
    if override and override.strip():
        return HouseholdName(override.strip(), "override")
    if len(members) < 2:
        return HouseholdName(None, "not_a_household")
    adults = household_adults(members, relationships)
    names = [_clean(a.name) for a in adults]
    if not 1 <= len(names) <= 2 or not all(names):
        return HouseholdName(None, "needs_name")
    if len(names) == 1:
        return HouseholdName(f"{names[0]} Family", "generated")
    return HouseholdName(_two_adult_name(*names), "generated")


def household_name_candidates(
    members: list[Person],
    relationships: list[Relationship],
    override: str | None,
) -> list[str]:
    """Every acceptable name: the household name first, then the other adult order.

    The two adults' order doesn't matter, so a title naming the younger adult first is
    as correct as the generated (oldest-first) name. Empty when there is no name.
    """
    result = household_name(members, relationships, override)
    if result.name is None:
        return []
    if result.status != "generated":
        return [result.name]
    names = [_clean(a.name) for a in household_adults(members, relationships)]
    if len(names) != 2:
        return [result.name]
    swapped = _two_adult_name(names[1], names[0])
    return [result.name] if swapped == result.name else [result.name, swapped]


def relationship_label(a_name: str, b_name: str, type: ConnectionType) -> str:
    return f"{a_name} ↔ {b_name}" if type.symmetric else f"{a_name} → {b_name}"
