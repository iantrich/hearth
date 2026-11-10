"""Pure rules for the Google Contacts sync: who needs what, and the payload.

No Home Assistant imports. The sync code feeds people and households in and
acts on the answers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .models import Household, Person, Place

# The only People API fields the sync ever touches.
UPDATE_FIELDS = "names,phoneNumbers,emailAddresses,addresses"

# google_sync_error values the planner acts on.
ERROR_CONTACT_MISSING = "contact missing"
# A create got no clear answer, so Google may hold the contact already; recreating it
# could duplicate it. Clearing the person's Google contact (which clears the error) retries.
ERROR_CREATE_UNCERTAIN = "create uncertain"


def split_name(name: str) -> tuple[str, str | None]:
    """Split on the last word after collapsing whitespace.

    A one-word name is a given name only. No suffix or particle detection.
    """
    words = name.split()
    if len(words) < 2:
        return (words[0] if words else "", None)
    return (" ".join(words[:-1]), words[-1])


def _has_text(value: str | None) -> bool:
    return bool(value and value.strip())


@dataclass(frozen=True)
class Eligibility:
    eligible: bool
    reason: Literal["hidden", "no_name", "no_contact_details"] | None = None


def eligibility(person: Person) -> Eligibility:
    """Hidden people, nameless people and people with no phone or email
    (any of the four) are not synced."""
    if person.hide_from_list:
        return Eligibility(False, "hidden")
    if not _has_text(person.name):
        return Eligibility(False, "no_name")
    if not any(
        _has_text(v) for v in (person.phone, person.phone2, person.email, person.email2)
    ):
        return Eligibility(False, "no_contact_details")
    return Eligibility(True, None)


def _place_has_content(place: Place | None) -> bool:
    return place is not None and any(
        _has_text(v)
        for v in (
            place.formatted,
            place.street,
            place.city,
            place.state,
            place.postal_code,
            place.country,
        )
    )


def _own_household(person: Person, household: Household | None) -> Household | None:
    """The household only if the person still belongs to it."""
    if household is not None and household.id == person.household_id:
        return household
    return None


def effective_address(person: Person, household: Household | None) -> Place | None:
    """The person's own address when it has content, else the household's.

    A household the person does not belong to is ignored.
    """
    household = _own_household(person, household)
    if _place_has_content(person.address):
        return person.address
    if household is not None and _place_has_content(household.address):
        return household.address
    return None


def person_body(person: Person, household: Household | None) -> dict:
    """A People API Person with only the four synced fields, each omitted
    when empty."""
    household = _own_household(person, household)
    body: dict = {}

    given, family = split_name(person.name)
    if given:
        name: dict = {"givenName": given}
        if family:
            name["familyName"] = family
        body["names"] = [name]

    phones = [
        {"value": value.strip(), "type": kind}
        for value, kind in ((person.phone, "mobile"), (person.phone2, "other"))
        if _has_text(value)
    ]
    if phones:
        body["phoneNumbers"] = phones

    emails = [
        {"value": value.strip(), "type": "other"}
        for value in (person.email, person.email2)
        if _has_text(value)
    ]
    if emails:
        body["emailAddresses"] = emails

    place = effective_address(person, household)
    if place is not None:
        address: dict = {}
        for key, value in (
            ("formattedValue", place.formatted),
            ("streetAddress", place.street),
            ("city", place.city),
            ("region", place.state),
            ("postalCode", place.postal_code),
            ("country", place.country),
        ):
            if _has_text(value):
                address[key] = value.strip()
        if address:
            body["addresses"] = [address]

    return body


@dataclass(frozen=True)
class Work:
    kind: Literal["create", "update", "photo_only", "skip", "blocked", "none"]
    photo: bool = False


def plan_for(person: Person, household: Household | None) -> Work:
    """Decide what one person needs.

    A person with a stored id is never created again, however stale; a person
    without one is created (never matched by phone, email or name) unless an
    earlier create may already have succeeded.
    """
    household = _own_household(person, household)
    error = person.google_sync_error
    if person.google_contact_id and error == ERROR_CONTACT_MISSING:
        return Work("blocked")
    if not person.google_contact_id and error == ERROR_CREATE_UNCERTAIN:
        return Work("blocked")

    synced_at = person.google_synced_at
    stale = (
        synced_at is None
        or person.updated_at > synced_at
        or (household is not None and household.updated_at > synced_at)
    )

    if not eligibility(person).eligible:
        return Work("skip" if stale else "none")

    if not person.google_contact_id:
        return Work("create", photo=bool(person.photo_hash))

    photo = bool(person.photo_hash) and person.photo_hash != person.google_photo_hash
    if stale:
        return Work("update", photo=photo)
    if photo:
        return Work("photo_only", photo=True)
    return Work("none")
