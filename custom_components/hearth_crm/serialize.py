"""JSON-friendly dict conversion for the Hearth models (no Home Assistant imports).

Dates are ``YYYY-MM-DD``, timestamps are ISO-8601 with an offset, enums are their string values
and a ``Place`` is a dict (or ``None``). Parsing is strict: required fields must be present,
unknown keys are rejected, and every error is a ``ValueError`` naming the offending field.
"""

from __future__ import annotations

import dataclasses
import math
import re
from datetime import date, datetime
from enum import Enum
from typing import Any

from .enums import ConnectionType, InteractionType
from .models import (
    ContactGroup,
    CRMData,
    Household,
    Interaction,
    Person,
    Place,
    Relationship,
)

_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")


def _fail(field: str, message: str) -> ValueError:
    return ValueError(f"{field}: {message}")


# --- value codecs: (encode, decode); decode gets (field name, raw value) -------------------------


def _enc_timestamp(name: str, value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise _fail(name, "timestamp must be timezone-aware")
    return value.isoformat()


def _dec_str(name: str, raw: Any) -> str:
    if not isinstance(raw, str):
        raise _fail(name, f"expected a string, got {type(raw).__name__}")
    return raw


def _dec_bool(name: str, raw: Any) -> bool:
    if not isinstance(raw, bool):
        raise _fail(name, f"expected true or false, got {type(raw).__name__}")
    return raw


def _dec_float(name: str, raw: Any) -> float:
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        raise _fail(name, f"expected a number, got {type(raw).__name__}")
    try:
        value = float(raw)
    except OverflowError:  # an int literal too large for a float
        raise _fail(name, "number is too large") from None
    if not math.isfinite(value):
        raise _fail(name, f"must be a finite number, got {raw!r}")
    return value


def _dec_date(name: str, raw: Any) -> date:
    if not isinstance(raw, str) or not _DATE_RE.fullmatch(raw):
        raise _fail(name, f"expected a YYYY-MM-DD date, got {raw!r}")
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise _fail(name, f"not a valid date: {raw!r}") from None


def _dec_timestamp(name: str, raw: Any) -> datetime:
    if not isinstance(raw, str):
        raise _fail(name, f"expected an ISO-8601 timestamp, got {type(raw).__name__}")
    try:
        value = datetime.fromisoformat(raw)
    except ValueError:
        raise _fail(name, f"not a valid timestamp: {raw!r}") from None
    if value.tzinfo is None or value.utcoffset() is None:
        raise _fail(name, f"timestamp must be timezone-aware: {raw!r}")
    return value


def _dec_str_list(name: str, raw: Any) -> list[str]:
    if not isinstance(raw, list):
        raise _fail(name, f"expected a list, got {type(raw).__name__}")
    items = [_dec_str(f"{name}[{i}]", item) for i, item in enumerate(raw)]
    if name.endswith("person_ids") and "" in items:
        raise _fail(name, "ids must not be empty")
    return items


def _dec_enum(cls: type[ConnectionType] | type[InteractionType]):
    def decode(name: str, raw: Any) -> Any:
        member = cls.parse(raw) if isinstance(raw, str) else None
        if member is None:
            raise _fail(name, f"unknown {cls.__name__} value {raw!r}")
        return member

    return decode


def _dec_place(name: str, raw: Any) -> Place:
    if not isinstance(raw, dict):
        raise _fail(name, f"expected an object, got {type(raw).__name__}")
    place = _from_dict(Place, raw, name)
    for key, limit in (("lat", 90), ("lon", 180)):
        value = getattr(place, key)
        if value is not None and not -limit <= value <= limit:
            raise _fail(f"{name}.{key}", f"must be between -{limit} and {limit}, got {value!r}")
    return place


# Annotation text (models use ``from __future__ import annotations``) -> decoder.
_DECODERS = {
    "str": _dec_str,
    "bool": _dec_bool,
    "float": _dec_float,
    "date": _dec_date,
    "datetime": _dec_timestamp,
    "list[str]": _dec_str_list,
    "Place": _dec_place,
    "ConnectionType": _dec_enum(ConnectionType),
    "InteractionType": _dec_enum(InteractionType),
}


def _decoder_for(annotation: str):
    base = annotation.removesuffix(" | None")
    decode = _DECODERS[base]
    if base == annotation:
        return decode
    return lambda name, raw: None if raw is None else decode(name, raw)


def _encode(name: str, value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if value is None or isinstance(value, bool | str | int | float):
        return value
    if isinstance(value, datetime):
        return _enc_timestamp(name, value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Place):
        return to_dict(value)
    if isinstance(value, list):
        return [_encode(f"{name}[{i}]", v) for i, v in enumerate(value)]
    raise TypeError(f"{name}: cannot serialize {type(value).__name__}")


_MODELS = (Person, Household, ContactGroup, Relationship, Interaction, Place)


def to_dict(obj: Any) -> dict[str, Any] | None:
    """Convert a model to a JSON-ready dict. ``None`` (an absent ``Place``) stays ``None``."""
    if obj is None:
        return None
    if type(obj) not in _MODELS:
        raise TypeError(f"cannot serialize {type(obj).__name__}")
    return {f.name: _encode(f.name, getattr(obj, f.name)) for f in dataclasses.fields(obj)}


# Fields older bundles and exports carry that Hearth no longer has: read and ignored, so those
# files still import. (A person's "hide_from_list" was dropped in 0.7.0.)
_RETIRED_FIELDS = {"Person": frozenset({"hide_from_list"})}


def _from_dict(cls: type, raw: dict[str, Any], where: str = "") -> Any:
    fields = {f.name: f for f in dataclasses.fields(cls)}
    retired = _RETIRED_FIELDS.get(cls.__name__, frozenset())
    raw = {k: v for k, v in raw.items() if k not in retired}
    prefix = f"{where}." if where else ""
    for key in raw:
        if key not in fields:
            raise ValueError(f"{prefix}{key}: unknown field")
    kwargs: dict[str, Any] = {}
    for name, f in fields.items():
        required = f.default is dataclasses.MISSING and f.default_factory is dataclasses.MISSING
        if name not in raw:
            if required:
                raise ValueError(f"{prefix}{name}: required field is missing")
            continue
        value = _decoder_for(f.type)(f"{prefix}{name}", raw[name])
        if value == "" and (name == "id" or name.endswith("_id")):
            raise ValueError(f"{prefix}{name}: must not be empty")
        if value == "" and name in ("photo_hash", "google_photo_hash"):
            value = None
        if value is None and required:
            raise ValueError(f"{prefix}{name}: must not be null")
        kwargs[name] = value
    return cls(**kwargs)


def _model_from_dict(cls: type, raw: Any) -> Any:
    if not isinstance(raw, dict):
        raise ValueError(f"expected an object, got {type(raw).__name__}")
    return _from_dict(cls, raw)


def person_from_dict(d: dict[str, Any]) -> Person:
    return _model_from_dict(Person, d)


def household_from_dict(d: dict[str, Any]) -> Household:
    return _model_from_dict(Household, d)


def group_from_dict(d: dict[str, Any]) -> ContactGroup:
    return _model_from_dict(ContactGroup, d)


def relationship_from_dict(d: dict[str, Any]) -> Relationship:
    return _model_from_dict(Relationship, d)


def interaction_from_dict(d: dict[str, Any]) -> Interaction:
    return _model_from_dict(Interaction, d)


_TABLES = (
    ("people", person_from_dict),
    ("households", household_from_dict),
    ("groups", group_from_dict),
    ("relationships", relationship_from_dict),
    ("interactions", interaction_from_dict),
)


def data_to_dict(data: CRMData) -> dict[str, Any]:
    """Convert a whole dataset; lists keep the ``CRMData`` order."""
    return {
        "people": [to_dict(p) for p in data.people],
        "households": [to_dict(h) for h in data.households],
        "groups": [to_dict(g) for g in data.groups],
        "group_members": [[g, p] for g, p in data.group_members],
        "relationships": [to_dict(r) for r in data.relationships],
        "interactions": [to_dict(i) for i in data.interactions],
    }


def data_from_dict(d: dict[str, Any]) -> CRMData:
    """Parse a dataset. Every table is required and unknown keys are rejected."""
    if not isinstance(d, dict):
        raise ValueError(f"expected an object, got {type(d).__name__}")
    allowed = {name for name, _ in _TABLES} | {"group_members"}
    for key in d:
        if key not in allowed:
            raise ValueError(f"{key}: unknown field")
    for key in sorted(allowed):
        if key not in d:
            raise ValueError(f"{key}: required field is missing")

    tables: dict[str, list[Any]] = {}
    for name, parse in _TABLES:
        rows = d[name]
        if not isinstance(rows, list):
            raise ValueError(f"{name}: expected a list, got {type(rows).__name__}")
        parsed = []
        for i, row in enumerate(rows):
            try:
                parsed.append(parse(row))
            except ValueError as err:
                raise ValueError(f"{name}[{i}].{err}") from None
        tables[name] = parsed

    members = d["group_members"]
    if not isinstance(members, list):
        raise ValueError(f"group_members: expected a list, got {type(members).__name__}")
    group_members: list[tuple[str, str]] = []
    for i, pair in enumerate(members):
        if (
            not isinstance(pair, list)
            or len(pair) != 2
            or not all(isinstance(x, str) and x for x in pair)
        ):
            raise ValueError(f"group_members[{i}]: expected [group_id, person_id]")
        group_members.append((pair[0], pair[1]))

    return CRMData(group_members=group_members, **tables)
