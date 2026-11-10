"""Row-level SQL for Hearth's entities (no Home Assistant imports).

Each entity kind has a table, an ordered column list, a function turning a model into row values
and one turning a row back into a model. ``CRMRepository`` owns locking and transactions; these
functions only run SQL on a connection the caller already holds.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Literal

from .enums import ConnectionType, InteractionType
from .models import ContactGroup, Household, Interaction, Person, Place, Relationship

EntityKind = Literal["person", "household", "contact_group", "relationship", "interaction"]

PLACE_FIELDS = ("formatted", "street", "city", "state", "postal_code", "country", "lat", "lon")

PERSON_SCALARS = (
    "phone", "phone2", "email", "email2", "occupation", "employer", "how_i_know_them",
    "notes", "birthday", "birth_year_unknown", "favorite", "close_friend",
    "website", "linkedin", "facebook", "instagram", "relationship_summary", "summary_updated",
    "photo_hash", "household_id", "google_contact_id", "google_synced_at",
    "google_photo_hash", "google_sync_error",
)
_PERSON_BOOLS = ("birth_year_unknown", "favorite", "close_friend")


def dt(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def d(value: date | None) -> str | None:
    return value.isoformat() if value else None


def parse_dt(raw: str | None) -> datetime | None:
    return datetime.fromisoformat(raw) if raw else None


def parse_d(raw: str | None) -> date | None:
    return date.fromisoformat(raw) if raw else None


def place_names(prefix: str) -> list[str]:
    return [f"{prefix}_{f}" for f in PLACE_FIELDS]


def place_values(place: Place | None) -> tuple[Any, ...]:
    if place is None:
        return (None,) * len(PLACE_FIELDS)
    return tuple(getattr(place, f) for f in PLACE_FIELDS)


def place_from(values: tuple[Any, ...]) -> Place | None:
    if all(v is None for v in values):
        return None
    return Place(**dict(zip(PLACE_FIELDS, values, strict=True)))


# -- person ----------------------------------------------------------------------------------

PERSON_COLUMNS = [
    "id", "name", *PERSON_SCALARS, *place_names("address"), *place_names("school"),
    "created_at", "updated_at",
]


def person_values(p: Person) -> tuple[Any, ...]:
    scalars = {
        **{k: getattr(p, k) for k in PERSON_SCALARS},
        "birthday": d(p.birthday),
        "summary_updated": d(p.summary_updated),
        "google_synced_at": dt(p.google_synced_at),
        **{k: int(getattr(p, k)) for k in _PERSON_BOOLS},
    }
    return (
        p.id, p.name, *(scalars[k] for k in PERSON_SCALARS),
        *place_values(p.address), *place_values(p.school), dt(p.created_at), dt(p.updated_at),
    )


def person_from_row(row: tuple) -> Person:
    v = dict(zip(PERSON_COLUMNS, row, strict=True))
    plain = {
        k: v[k]
        for k in PERSON_SCALARS
        if k not in ("birthday", "summary_updated", "google_synced_at", *_PERSON_BOOLS)
    }
    return Person(
        id=v["id"],
        name=v["name"],
        created_at=parse_dt(v["created_at"]),
        updated_at=parse_dt(v["updated_at"]),
        **plain,
        birthday=parse_d(v["birthday"]),
        summary_updated=parse_d(v["summary_updated"]),
        google_synced_at=parse_dt(v["google_synced_at"]),
        **{k: bool(v[k]) for k in _PERSON_BOOLS},
        address=place_from(tuple(v[c] for c in place_names("address"))),
        school=place_from(tuple(v[c] for c in place_names("school"))),
    )


# -- household -------------------------------------------------------------------------------

HOUSEHOLD_COLUMNS = [
    "id", "name_override", *place_names("address"), "notes", "photo_hash",
    "created_at", "updated_at",
]


def household_values(h: Household) -> tuple[Any, ...]:
    return (h.id, h.name_override, *place_values(h.address), h.notes, h.photo_hash,
            dt(h.created_at), dt(h.updated_at))


def household_from_row(r: tuple) -> Household:
    return Household(id=r[0], name_override=r[1], address=place_from(r[2:10]), notes=r[10],
                     photo_hash=r[11], created_at=parse_dt(r[12]), updated_at=parse_dt(r[13]))


# -- contact group ---------------------------------------------------------------------------

GROUP_COLUMNS = ["id", "name", "description", "photo_hash", "created_at", "updated_at"]


def group_values(g: ContactGroup) -> tuple[Any, ...]:
    return (g.id, g.name, g.description, g.photo_hash, dt(g.created_at), dt(g.updated_at))


def group_from_row(r: tuple) -> ContactGroup:
    return ContactGroup(id=r[0], name=r[1], description=r[2], photo_hash=r[3],
                        created_at=parse_dt(r[4]), updated_at=parse_dt(r[5]))


# -- relationship ----------------------------------------------------------------------------

RELATIONSHIP_COLUMNS = ["id", "person_a_id", "person_b_id", "type", "notes",
                        "created_at", "updated_at"]


def relationship_values(r: Relationship) -> tuple[Any, ...]:
    return (r.id, r.person_a_id, r.person_b_id, str(r.type), r.notes,
            dt(r.created_at), dt(r.updated_at))


def relationship_from_row(r: tuple) -> Relationship:
    return Relationship(id=r[0], person_a_id=r[1], person_b_id=r[2], type=ConnectionType(r[3]),
                        notes=r[4], created_at=parse_dt(r[5]), updated_at=parse_dt(r[6]))


# -- interaction (its people live in interaction_person) -------------------------------------

INTERACTION_COLUMNS = ["id", "summary", "date", "type", "notes", "created_at", "updated_at"]


def interaction_values(i: Interaction) -> tuple[Any, ...]:
    return (i.id, i.summary, d(i.date), str(i.type), i.notes, dt(i.created_at), dt(i.updated_at))


def interaction_from_row(r: tuple, person_ids: list[str]) -> Interaction:
    return Interaction(id=r[0], summary=r[1], date=date.fromisoformat(r[2]),
                       type=InteractionType(r[3]), notes=r[4], created_at=parse_dt(r[5]),
                       updated_at=parse_dt(r[6]), person_ids=person_ids)


# -- generic row operations ------------------------------------------------------------------


@dataclass(frozen=True)
class _Spec:
    table: str
    columns: list[str]
    values: Callable[[Any], tuple[Any, ...]]


_SPECS: dict[str, _Spec] = {
    "person": _Spec("person", PERSON_COLUMNS, person_values),
    "household": _Spec("household", HOUSEHOLD_COLUMNS, household_values),
    "contact_group": _Spec("contact_group", GROUP_COLUMNS, group_values),
    "relationship": _Spec("relationship", RELATIONSHIP_COLUMNS, relationship_values),
    "interaction": _Spec("interaction", INTERACTION_COLUMNS, interaction_values),
}

_FROM_ROW: dict[str, Callable[[tuple], Any]] = {
    "person": person_from_row,
    "household": household_from_row,
    "contact_group": group_from_row,
    "relationship": relationship_from_row,
}


def insert_row(conn: sqlite3.Connection, table: str, columns: list[str], values: tuple) -> None:
    marks = ", ".join("?" * len(columns))
    conn.execute(f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({marks})", values)


def interaction_person_ids(conn: sqlite3.Connection, interaction_id: str) -> list[str]:
    return [
        r[0]
        for r in conn.execute(
            "SELECT person_id FROM interaction_person WHERE interaction_id = ?"
            " ORDER BY position",
            (interaction_id,),
        )
    ]


def _write_interaction_people(conn: sqlite3.Connection, i: Interaction) -> None:
    for position, person_id in enumerate(i.person_ids):
        insert_row(conn, "interaction_person", ["interaction_id", "person_id", "position"],
                   (i.id, person_id, position))


def _spec(kind: str) -> _Spec:
    try:
        return _SPECS[kind]
    except KeyError:
        raise ValueError(f"unknown entity kind {kind!r}") from None


def get_entity(conn: sqlite3.Connection, kind: EntityKind, entity_id: str) -> Any | None:
    spec = _spec(kind)
    row = conn.execute(
        f"SELECT {', '.join(spec.columns)} FROM {spec.table} WHERE id = ?", (entity_id,)
    ).fetchone()
    if row is None:
        return None
    if kind == "interaction":
        return interaction_from_row(row, interaction_person_ids(conn, entity_id))
    return _FROM_ROW[kind](row)


def insert_entity(conn: sqlite3.Connection, kind: EntityKind, obj: Any) -> None:
    spec = _spec(kind)
    insert_row(conn, spec.table, spec.columns, spec.values(obj))
    if kind == "interaction":
        _write_interaction_people(conn, obj)


def update_entity(conn: sqlite3.Connection, kind: EntityKind, obj: Any) -> None:
    """Replace the whole row (and an interaction's people). Raises KeyError if it is missing."""
    spec = _spec(kind)
    sets = ", ".join(f"{c} = ?" for c in spec.columns[1:])
    values = spec.values(obj)
    cur = conn.execute(f"UPDATE {spec.table} SET {sets} WHERE id = ?", (*values[1:], values[0]))
    if cur.rowcount == 0:
        raise KeyError(f"{kind} {obj.id!r} does not exist")
    if kind == "interaction":
        conn.execute("DELETE FROM interaction_person WHERE interaction_id = ?", (obj.id,))
        _write_interaction_people(conn, obj)
