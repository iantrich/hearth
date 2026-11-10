"""Tests for JSON serialization of the models."""

from __future__ import annotations

import copy
import json
from datetime import datetime

import pytest

from custom_components.hearth_crm.models import Place
from custom_components.hearth_crm.serialize import (
    data_from_dict,
    data_to_dict,
    group_from_dict,
    household_from_dict,
    interaction_from_dict,
    person_from_dict,
    relationship_from_dict,
    to_dict,
)

PERSON = {
    "id": "p1",
    "name": "Alex Example",
    "created_at": "2026-01-05T12:30:00+00:00",
    "updated_at": "2026-02-06T08:15:30+00:00",
}


def test_round_trip_every_model(sample):
    assert data_from_dict(data_to_dict(sample)) == sample


def test_round_trip_survives_json(sample):
    text = json.dumps(data_to_dict(sample))
    assert data_from_dict(json.loads(text)) == sample


def test_data_to_dict_shape(sample):
    d = data_to_dict(sample)
    assert list(d) == [
        "people", "households", "groups", "group_members", "relationships", "interactions",
    ]
    assert d["group_members"] == [["g1", "p1"], ["g1", "p2"]]
    assert [p["id"] for p in d["people"]] == ["p1", "p2", "p3", "p4"]


def test_to_dict_formats_values(sample):
    person = to_dict(sample.people[0])
    assert person["birthday"] == "1980-03-04"
    assert person["created_at"] == "2026-01-05T12:30:00+00:00"
    assert person["address"]["city"] == "Springfield"
    assert to_dict(sample.people[1])["address"] is None
    assert to_dict(sample.relationships[0])["type"] == "Spouse"
    assert type(to_dict(sample.relationships[0])["type"]) is str
    assert to_dict(sample.interactions[0])["person_ids"] == ["p2", "p1"]


def test_to_dict_place_and_none():
    assert to_dict(Place(formatted="Somewhere"))["formatted"] == "Somewhere"
    assert to_dict(None) is None


def test_to_dict_rejects_unknown_type():
    with pytest.raises(TypeError):
        to_dict(object())


def test_to_dict_rejects_naive_timestamp(sample):
    sample.people[0].created_at = datetime(2026, 1, 1)
    with pytest.raises(ValueError, match="created_at"):
        to_dict(sample.people[0])


def test_bad_date_names_the_field():
    with pytest.raises(ValueError, match="birthday"):
        person_from_dict({**PERSON, "birthday": "05/01/2020"})


def test_naive_timestamp_is_rejected():
    with pytest.raises(ValueError, match="created_at"):
        person_from_dict({**PERSON, "created_at": "2026-01-05T12:30:00"})


def test_bad_timestamp_names_the_field():
    with pytest.raises(ValueError, match="updated_at"):
        person_from_dict({**PERSON, "updated_at": "yesterday"})


def test_unknown_connection_type_is_rejected():
    with pytest.raises(ValueError, match="type"):
        relationship_from_dict({
            "id": "r1", "person_a_id": "p1", "person_b_id": "p2", "type": "Nemesis",
            "created_at": PERSON["created_at"], "updated_at": PERSON["updated_at"],
        })


def test_unknown_interaction_type_is_rejected():
    with pytest.raises(ValueError, match="type"):
        interaction_from_dict({
            "id": "i1", "summary": "x", "date": "2026-01-01", "type": "Brunch",
            "created_at": PERSON["created_at"], "updated_at": PERSON["updated_at"],
        })


def test_wrong_type_names_the_field():
    with pytest.raises(ValueError, match="favorite"):
        person_from_dict({**PERSON, "favorite": "yes"})
    with pytest.raises(ValueError, match="name"):
        person_from_dict({**PERSON, "name": 5})
    with pytest.raises(ValueError, match="person_ids"):
        interaction_from_dict({
            "id": "i1", "summary": "x", "date": "2026-01-01", "type": "Trip",
            "created_at": PERSON["created_at"], "updated_at": PERSON["updated_at"],
            "person_ids": "p1",
        })


def test_missing_required_field_is_rejected():
    for key in PERSON:
        d = {k: v for k, v in PERSON.items() if k != key}
        with pytest.raises(ValueError, match=key):
            person_from_dict(d)


def test_missing_optional_fields_take_defaults():
    p = person_from_dict(PERSON)
    assert p.phone is None
    assert p.favorite is False
    assert p.address is None


def test_unknown_key_is_rejected_by_name():
    with pytest.raises(ValueError, match="nickname"):
        person_from_dict({**PERSON, "nickname": "Al"})
    with pytest.raises(ValueError, match="zip"):
        person_from_dict({**PERSON, "address": {"formatted": "x", "zip": "1"}})


def test_place_requires_formatted_key():
    with pytest.raises(ValueError, match="formatted"):
        person_from_dict({**PERSON, "address": {"city": "x"}})


def test_other_from_dicts_reject_unknown_keys():
    with pytest.raises(ValueError, match="bogus"):
        household_from_dict({
            "id": "h1", "created_at": PERSON["created_at"],
            "updated_at": PERSON["updated_at"], "bogus": 1,
        })
    with pytest.raises(ValueError, match="bogus"):
        group_from_dict({**PERSON, "bogus": 1})


def test_data_from_dict_rejects_unknown_and_missing_tables(sample):
    d = data_to_dict(sample)
    with pytest.raises(ValueError, match="extra"):
        data_from_dict({**d, "extra": []})
    del d["interactions"]
    with pytest.raises(ValueError, match="interactions"):
        data_from_dict(d)


def test_data_from_dict_rejects_bad_group_member(sample):
    d = copy.deepcopy(data_to_dict(sample))
    d["group_members"] = [["g1"]]
    with pytest.raises(ValueError, match="group_members"):
        data_from_dict(d)


def test_row_errors_name_table_and_index(sample):
    d = copy.deepcopy(data_to_dict(sample))
    d["people"][2]["birthday"] = "nope"
    with pytest.raises(ValueError, match=r"people\[2\].*birthday"):
        data_from_dict(d)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), -float("inf")])
def test_non_finite_coordinates_are_rejected(bad):
    with pytest.raises(ValueError, match="lat"):
        person_from_dict({**PERSON, "address": {"formatted": "x", "lat": bad}})


@pytest.mark.parametrize(("key", "bad"), [("lat", 90.5), ("lat", -91), ("lon", 180.1), ("lon", -181)])
def test_out_of_range_coordinates_are_rejected(key, bad):
    with pytest.raises(ValueError, match=key):
        person_from_dict({**PERSON, "address": {"formatted": "x", key: bad}})


def test_boundary_coordinates_are_accepted():
    p = person_from_dict({**PERSON, "address": {"formatted": "x", "lat": -90, "lon": 180}})
    assert (p.address.lat, p.address.lon) == (-90.0, 180.0)


def test_empty_ids_are_rejected():
    with pytest.raises(ValueError, match="id"):
        person_from_dict({**PERSON, "id": ""})
    with pytest.raises(ValueError, match="household_id"):
        person_from_dict({**PERSON, "household_id": ""})
    with pytest.raises(ValueError, match="person_ids"):
        interaction_from_dict({
            "id": "i1", "summary": "x", "date": "2026-01-01", "type": "Trip",
            "created_at": PERSON["created_at"], "updated_at": PERSON["updated_at"],
            "person_ids": [""],
        })


def test_empty_group_member_id_is_rejected(sample):
    d = copy.deepcopy(data_to_dict(sample))
    d["group_members"] = [["g1", ""]]
    with pytest.raises(ValueError, match="group_members"):
        data_from_dict(d)


def test_empty_photo_hash_becomes_none():
    assert person_from_dict({**PERSON, "photo_hash": ""}).photo_hash is None
