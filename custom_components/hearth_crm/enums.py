"""Enumerations for Hearth."""

from __future__ import annotations

from enum import StrEnum
from typing import Self


class _Parsable(StrEnum):
    @classmethod
    def parse(cls, raw: str | None) -> Self | None:
        """Return the member for an exact value, or None if unknown or missing."""
        try:
            return cls(raw)
        except ValueError:
            return None


class ConnectionType(_Parsable):
    """How person B relates to person A (B is the type of A)."""

    SPOUSE = "Spouse"
    EX_SPOUSE = "Ex-Spouse"
    PARTNER = "Partner"
    SIBLING = "Sibling"
    PARENT = "Parent"
    CHILD = "Child"
    GRANDPARENT = "Grandparent"
    GRANDCHILD = "Grandchild"
    PIBLING = "Pibling"
    NIBLING = "Nibling"
    FRIEND = "Friend"
    COLLEGE_FRIEND = "College Friend"
    NEIGHBOR = "Neighbor"
    COWORKER = "Coworker"
    FORMER_COWORKER = "Former Coworker"
    MENTOR = "Mentor"
    MENTEE = "Mentee"
    EMPLOYER = "Employer"
    EMPLOYEE = "Employee"
    EXTENDED_FAMILY = "Extended Family"
    IN_LAW = "In-Law"
    SIBLING_IN_LAW = "Sibling-in-law"
    PARENT_IN_LAW = "Parent-in-law"
    CHILD_IN_LAW = "Child-in-law"
    OTHER = "Other"

    @property
    def inverse(self) -> ConnectionType:
        """The type seen from the other person's side."""
        return _INVERSES.get(self, self)

    @property
    def symmetric(self) -> bool:
        """True if the type reads the same from both sides."""
        return self.inverse is self


_INVERSE_PAIRS = (
    (ConnectionType.PARENT, ConnectionType.CHILD),
    (ConnectionType.GRANDPARENT, ConnectionType.GRANDCHILD),
    (ConnectionType.PIBLING, ConnectionType.NIBLING),
    (ConnectionType.PARENT_IN_LAW, ConnectionType.CHILD_IN_LAW),
    (ConnectionType.MENTOR, ConnectionType.MENTEE),
    (ConnectionType.EMPLOYER, ConnectionType.EMPLOYEE),
)
_INVERSES = {a: b for a, b in _INVERSE_PAIRS} | {b: a for a, b in _INVERSE_PAIRS}


class InteractionType(_Parsable):
    """Kinds of logged interactions."""

    CATCH_UP = "Catch-up"
    TRIP = "Trip"
    PROMOTION = "Promotion"
    LIFE_EVENT = "Life Event"
    HEALTH = "Health"
    MILESTONE = "Milestone"
    OTHER = "Other"


class ReminderUnit(_Parsable):
    """Units a repeating reminder steps in."""

    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    YEAR = "year"
