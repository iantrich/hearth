from datetime import datetime, timedelta, timezone

from custom_components.hearth_crm.google_payload import (
    ERROR_CONTACT_MISSING,
    ERROR_CREATE_UNCERTAIN,
    UPDATE_FIELDS,
    effective_address,
    eligibility,
    person_body,
    plan_for,
    split_name,
)
from custom_components.hearth_crm.models import Household, Person, Place

T0 = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
LATER = T0 + timedelta(hours=1)


def make_person(**kw) -> Person:
    base = dict(
        id="p1", name="Ana Lopez", created_at=T0, updated_at=T0, phone="555-0101",
        household_id="h1",
    )
    base.update(kw)
    return Person(**base)


def make_household(**kw) -> Household:
    base = dict(id="h1", created_at=T0, updated_at=T0)
    base.update(kw)
    return Household(**base)


def test_update_fields_constant():
    assert UPDATE_FIELDS == "names,phoneNumbers,emailAddresses,addresses"


def test_split_name_by_the_last_word():
    assert split_name("Ana Maria de la Cruz") == ("Ana Maria de la", "Cruz")
    assert split_name("Sam") == ("Sam", None)
    assert split_name("  Sam   Rowe  ") == ("Sam", "Rowe")


def test_eligibility_skips_hidden_nameless_and_contactless_people():
    assert eligibility(make_person()).eligible
    assert eligibility(make_person(hide_from_list=True)).reason == "hidden"
    assert eligibility(make_person(name="  ")).reason == "no_name"
    contactless = make_person(phone=None, phone2=" ", email="", email2=None)
    result = eligibility(contactless)
    assert not result.eligible and result.reason == "no_contact_details"


def test_phone2_or_email2_alone_make_a_person_eligible():
    assert eligibility(make_person(phone=None, phone2="555-0102")).eligible
    assert eligibility(make_person(phone=None, email2="a@example.test")).eligible


def test_person_body_maps_types_and_omits_empty_fields():
    body = person_body(
        make_person(phone2="555-0102", email="a@example.test", email2="b@example.test"),
        None,
    )
    assert body == {
        "names": [{"givenName": "Ana", "familyName": "Lopez"}],
        "phoneNumbers": [
            {"value": "555-0101", "type": "mobile"},
            {"value": "555-0102", "type": "other"},
        ],
        "emailAddresses": [
            {"value": "a@example.test", "type": "other"},
            {"value": "b@example.test", "type": "other"},
        ],
    }
    minimal = person_body(make_person(name="Sam"), None)
    assert minimal == {
        "names": [{"givenName": "Sam"}],
        "phoneNumbers": [{"value": "555-0101", "type": "mobile"}],
    }


def test_person_body_address_parts_only_when_known():
    place = Place(formatted="1 Elm St, Springfield, NE", street="1 Elm St", state="NE")
    body = person_body(make_person(address=place), None)
    assert body["addresses"] == [
        {"formattedValue": "1 Elm St, Springfield, NE", "streetAddress": "1 Elm St", "region": "NE"}
    ]


def test_address_falls_back_to_the_household():
    hh_place = Place(formatted="9 Oak Ave", city="Springfield")
    hh = make_household(address=hh_place)
    assert effective_address(make_person(), hh) is hh_place
    assert effective_address(make_person(address=Place(formatted=None)), hh) is hh_place
    assert person_body(make_person(), hh)["addresses"] == [
        {"formattedValue": "9 Oak Ave", "city": "Springfield"}
    ]
    assert effective_address(make_person(), make_household()) is None


def test_a_persons_own_address_beats_the_household():
    own = Place(formatted="1 Elm St")
    hh = make_household(address=Place(formatted="9 Oak Ave"))
    assert effective_address(make_person(address=own), hh) is own


def test_a_household_change_makes_members_stale():
    person = make_person(google_contact_id="c1", google_synced_at=LATER)
    assert plan_for(person, make_household(updated_at=T0)).kind == "none"
    changed = make_household(updated_at=LATER + timedelta(minutes=1))
    assert plan_for(person, changed).kind == "update"


def test_a_person_who_left_the_household_stops_using_its_address():
    hh = make_household(address=Place(formatted="9 Oak Ave"), updated_at=LATER)
    person = make_person(household_id=None)
    assert effective_address(person, hh) is None
    assert "addresses" not in person_body(person, hh)
    synced = make_person(household_id=None, google_contact_id="c1", google_synced_at=T0 + timedelta(minutes=30))
    assert plan_for(synced, hh).kind == "none"


def test_a_household_the_person_does_not_belong_to_is_ignored():
    hh = make_household(id="h2", address=Place(formatted="9 Oak Ave"), updated_at=LATER)
    person = make_person(household_id="h1", google_contact_id="c1", google_synced_at=T0 + timedelta(minutes=30))
    assert effective_address(person, hh) is None
    assert "addresses" not in person_body(person, hh)
    assert plan_for(person, hh).kind == "none"


def test_address_parts_are_trimmed_and_blank_parts_dropped():
    place = Place(formatted="  1 Elm St  ", state=" NE ", city="   ")
    body = person_body(make_person(address=place), None)
    assert body["addresses"] == [{"formattedValue": "1 Elm St", "region": "NE"}]


def test_contact_missing_with_no_id_plans_create():
    person = make_person(google_sync_error=ERROR_CONTACT_MISSING)
    assert plan_for(person, None).kind == "create"


def test_error_constants_are_the_stored_strings():
    assert ERROR_CONTACT_MISSING == "contact missing"
    assert ERROR_CREATE_UNCERTAIN == "create uncertain"


def test_an_uncertain_create_with_no_id_is_blocked_not_recreated():
    person = make_person(google_sync_error=ERROR_CREATE_UNCERTAIN)
    assert plan_for(person, None).kind == "blocked"
    stale = make_person(
        google_sync_error=ERROR_CREATE_UNCERTAIN, google_synced_at=T0, updated_at=LATER,
        photo_hash="h",
    )
    assert plan_for(stale, None).kind == "blocked"


def test_clearing_an_uncertain_create_plans_create_again():
    person = make_person(google_sync_error=None)
    assert plan_for(person, None).kind == "create"


def test_no_id_with_another_error_still_plans_create():
    person = make_person(google_sync_error="HTTP 400 INVALID_ARGUMENT")
    assert plan_for(person, None).kind == "create"


def test_an_uncertain_create_error_on_a_person_with_an_id_does_not_block():
    person = make_person(
        google_contact_id="c1", google_sync_error=ERROR_CREATE_UNCERTAIN,
        google_synced_at=T0, updated_at=LATER,
    )
    assert plan_for(person, None).kind == "update"


def test_blocked_wins_when_fresh_or_ineligible():
    fresh = make_person(google_contact_id="c1", google_sync_error=ERROR_CONTACT_MISSING, google_synced_at=LATER)
    assert plan_for(fresh, None).kind == "blocked"
    ineligible = make_person(
        google_contact_id="c1", google_sync_error=ERROR_CONTACT_MISSING,
        hide_from_list=True, google_synced_at=T0, updated_at=LATER,
    )
    assert plan_for(ineligible, None).kind == "blocked"


def test_equal_timestamps_are_not_stale():
    person = make_person(google_contact_id="c1", google_synced_at=T0, updated_at=T0)
    assert plan_for(person, None).kind == "none"


def test_ineligible_person_with_id_and_changed_photo_plans_none():
    person = make_person(
        hide_from_list=True, google_contact_id="c1", google_synced_at=LATER,
        photo_hash="new", google_photo_hash="old",
    )
    assert plan_for(person, None).kind == "none"


def test_plan_for_covers_every_kind():
    never = make_person()
    assert plan_for(never, None).kind == "create"
    assert plan_for(make_person(photo_hash="h"), None).photo is True
    assert plan_for(never, None).photo is False

    stale = make_person(google_contact_id="c1", google_synced_at=T0, updated_at=LATER)
    assert plan_for(stale, None).kind == "update"

    stale_photo = make_person(
        google_contact_id="c1", google_synced_at=T0, updated_at=LATER,
        photo_hash="new", google_photo_hash="old",
    )
    assert plan_for(stale_photo, None).photo is True

    photo_only = make_person(
        google_contact_id="c1", google_synced_at=LATER, photo_hash="new", google_photo_hash="old"
    )
    work = plan_for(photo_only, None)
    assert (work.kind, work.photo) == ("photo_only", True)

    hidden_stale = make_person(hide_from_list=True, google_synced_at=T0, updated_at=LATER)
    assert plan_for(hidden_stale, None).kind == "skip"
    assert plan_for(make_person(hide_from_list=True), None).kind == "skip"
    hidden_fresh = make_person(hide_from_list=True, google_synced_at=LATER)
    assert plan_for(hidden_fresh, None).kind == "none"

    blocked = make_person(
        google_contact_id="c1", google_sync_error=ERROR_CONTACT_MISSING,
        google_synced_at=T0, updated_at=LATER,
    )
    assert plan_for(blocked, None).kind == "blocked"

    unchanged = make_person(
        google_contact_id="c1", google_synced_at=LATER,
        photo_hash="same", google_photo_hash="same",
    )
    assert plan_for(unchanged, None).kind == "none"


def test_an_eligible_person_with_an_id_is_never_planned_as_create():
    for synced_at in (None, T0, LATER):
        for error in (None, "boom"):
            person = make_person(
                google_contact_id="c1", google_synced_at=synced_at,
                google_sync_error=error, updated_at=LATER, photo_hash="x",
            )
            assert plan_for(person, make_household(updated_at=LATER)).kind != "create"
