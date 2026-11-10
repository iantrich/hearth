"""Plain data models for Hearth (no Home Assistant imports)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from .enums import ConnectionType, InteractionType


@dataclass(frozen=True)
class Place:
    formatted: str | None
    street: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None
    lat: float | None = None
    lon: float | None = None


@dataclass
class Person:
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    phone: str | None = None
    phone2: str | None = None
    email: str | None = None
    email2: str | None = None
    occupation: str | None = None
    employer: str | None = None
    how_i_know_them: str | None = None
    notes: str | None = None
    birthday: date | None = None
    birth_year_unknown: bool = False
    favorite: bool = False
    close_friend: bool = False
    website: str | None = None
    linkedin: str | None = None
    facebook: str | None = None
    instagram: str | None = None
    address: Place | None = None
    school: Place | None = None
    relationship_summary: str | None = None
    summary_updated: date | None = None
    photo_hash: str | None = None
    household_id: str | None = None
    google_contact_id: str | None = None
    google_synced_at: datetime | None = None
    google_photo_hash: str | None = None
    google_sync_error: str | None = None


@dataclass
class Household:
    id: str
    created_at: datetime
    updated_at: datetime
    name_override: str | None = None
    address: Place | None = None
    notes: str | None = None
    photo_hash: str | None = None


@dataclass
class ContactGroup:
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    description: str | None = None
    photo_hash: str | None = None


@dataclass
class Relationship:
    id: str
    person_a_id: str
    person_b_id: str
    type: ConnectionType
    created_at: datetime
    updated_at: datetime
    notes: str | None = None


@dataclass
class Interaction:
    id: str
    summary: str
    date: date
    type: InteractionType
    created_at: datetime
    updated_at: datetime
    notes: str | None = None
    person_ids: list[str] = field(default_factory=list)


@dataclass
class CRMData:
    people: list[Person] = field(default_factory=list)
    households: list[Household] = field(default_factory=list)
    groups: list[ContactGroup] = field(default_factory=list)
    group_members: list[tuple[str, str]] = field(default_factory=list)
    relationships: list[Relationship] = field(default_factory=list)
    interactions: list[Interaction] = field(default_factory=list)
