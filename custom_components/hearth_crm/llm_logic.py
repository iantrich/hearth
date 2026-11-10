"""Pure helpers for Claude's tools: search, similar names, ordering, dates.

No Home Assistant imports, so everything here is unit-testable. Every function takes the
snapshot dict from ``derive.build_snapshot``. Derived values (inverse types, days until a
birthday, age) always come from the snapshot, never from a table or date math here.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from difflib import SequenceMatcher


_UNKNOWN_YEAR = 2000  # A leap year, so "02-29" parses.
_TOKEN_RATIO = 0.8
_NAME_RATIO = 0.85
_MIN_PREFIX = 3


def _fold(text: str) -> str:
    """Lowercase and strip accents."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


def _by_name(person: dict) -> tuple[str, str]:
    return (_fold(person["name"]), person["id"])


def person_brief(snapshot: dict, person: dict) -> dict:
    status = person["contact_status"]
    return {
        "id": person["id"],
        "name": person["name"],
        "household_name": person["household_name"],
        "how_i_know_them": person["how_i_know_them"],
        "close_friend": person["close_friend"],
        "favorite": person["favorite"],
        "last_contacted": status["last_contacted"],
        "days_since_contact": status["days_since_contact"],
        "urgency": status["urgency"],
        "is_me": person["id"] == snapshot["me_person_id"],
    }


def person_briefs(snapshot: dict, person_ids: list[str]) -> list[dict]:
    """Briefs for the given people, sorted by name; ids that no longer exist are skipped."""
    by_id = {p["id"]: p for p in snapshot["people"]}
    people = sorted(
        (by_id[i] for i in set(person_ids) if i in by_id),
        key=lambda p: (p["name"].casefold(), p["id"]),
    )
    return [person_brief(snapshot, p) for p in people]


def _bounded(rows: list, limit: int) -> tuple[list, bool]:
    return rows[:limit], len(rows) > limit


def connection_type(link: dict, person_id: str) -> tuple[str, str] | None:
    """The other end of a link and what they are to ``person_id`` (the panel's connectionTo)."""
    if link["person_a_id"] == link["person_b_id"]:
        return None
    if link["person_a_id"] == person_id:
        return link["person_b_id"], link["type"]
    if link["person_b_id"] == person_id:
        return link["person_a_id"], link["inverse_type"]
    return None


def list_groups(snapshot: dict, *, query: str | None = None, limit: int = 25) -> dict:
    """Groups whose name contains ``query`` (accents and case ignored), empty ones included."""
    needle = _fold((query or "").strip())
    groups = sorted(
        (g for g in snapshot["groups"] if needle in _fold(g["name"] or "")),
        key=lambda g: (_fold(g["name"] or ""), g["id"]),
    )
    shown, truncated = _bounded(groups, limit)
    return {
        "total": len(groups),
        "returned": len(shown),
        "truncated": truncated,
        "groups": [
            {
                "id": g["id"],
                "name": g["name"],
                "description": g["description"],
                "member_count": len(set(g["member_ids"])),
            }
            for g in shown
        ],
    }


def search_people(
    snapshot: dict,
    *,
    query: str = "",
    how_i_know_them: str | None = None,
    group: str | None = None,
    household: str | None = None,
    limit: int = 25,
) -> dict:
    """Name search like the panel's, sorted by name."""
    people = sorted(snapshot["people"], key=_by_name)
    by_id = {p["id"]: p for p in people}
    needle = _fold(query.strip())
    matches = [p for p in people if needle in _fold(p["name"])]

    if how_i_know_them:
        want = _fold(how_i_know_them)
        matches = [p for p in matches if want in _fold(p["how_i_know_them"] or "")]
    if group:
        want = _fold(group)
        member_ids = {
            pid
            for g in snapshot["groups"]
            if want in _fold(g["name"] or "")
            for pid in g["member_ids"]
        }
        matches = [p for p in matches if p["id"] in member_ids]
    if household:
        want = _fold(household)
        matches = [p for p in matches if want in _fold(p["household_name"] or "")]

    connected: list[dict] = []
    if needle:
        direct = {p["id"]: p for p in matches}
        seen = set(direct)
        for link in snapshot["relationships"]:
            matched_id = next(
                (i for i in (link["person_a_id"], link["person_b_id"]) if i in direct), None
            )
            end = connection_type(link, matched_id) if matched_id else None
            if not end or end[0] in seen or end[0] not in by_id:
                continue
            seen.add(end[0])
            connected.append(
                {
                    "person": person_brief(snapshot, by_id[end[0]]),
                    "reason": f"{end[1]} of {direct[matched_id]['name']}",
                }
            )
        connected.sort(key=lambda c: (_fold(c["person"]["name"]), c["person"]["id"]))

    shown, truncated = _bounded(matches, limit)
    return {
        "total": len(matches),
        "returned": len(shown),
        "truncated": truncated,
        "people": [person_brief(snapshot, p) for p in shown],
        "connected": connected[:limit],
        "connected_total": len(connected),
        "connected_truncated": len(connected) > limit,
    }


def _consonants(word: str) -> str:
    return "".join(c for c in word if c not in "aeiouy")


def _tokens_match(a: str, b: str) -> bool:
    """Two name words are the same, one starts the other, or they sound or are spelled alike.

    Dictation mangles vowels most ("Mantana" for "Montana"), so words with the same three or
    more consonants in order count as alike.
    """
    if a == b:
        return True
    skeleton = _consonants(a)
    if len(skeleton) >= _MIN_PREFIX and skeleton == _consonants(b):
        return True
    short, long_ = sorted((a, b), key=len)
    if len(short) >= _MIN_PREFIX and long_.startswith(short):
        return True
    return SequenceMatcher(None, a, b).ratio() >= _TOKEN_RATIO


def _names_alike(wanted: list[str], other: list[str]) -> bool:
    if not wanted or not other or not _tokens_match(wanted[0], other[0]):
        return False
    if len(wanted) == 1 or len(other) == 1:
        return True
    # First names agree; the rest must share a word (last or middle name).
    return any(_tokens_match(w, o) for w in wanted[1:] for o in other[1:])


def similar_people(snapshot: dict, name: str, limit: int = 5) -> list[dict]:
    """People whose names look like ``name``: misheard, nicknamed or partial. Best first."""
    wanted = _fold(name).split()
    whole = " ".join(wanted)
    scored = []
    for person in snapshot["people"]:
        other = _fold(person["name"]).split()
        ratio = SequenceMatcher(None, whole, " ".join(other)).ratio()
        if _names_alike(wanted, other) or ratio >= _NAME_RATIO:
            scored.append((-ratio, _by_name(person), person))
    scored.sort(key=lambda s: s[:2])
    return [person_brief(snapshot, p) for *_, p in scored[:limit]]


def reach_out(snapshot: dict, limit: int = 25) -> dict:
    """Close friends who are overdue or due soon, most pressing first."""
    overdue: list[dict] = []
    due_soon: list[dict] = []
    for person in snapshot["people"]:
        if not person["close_friend"]:
            continue
        urgency = person["contact_status"]["urgency"]
        if urgency == "overdue":
            overdue.append(person)
        elif urgency == "due_soon":
            due_soon.append(person)

    def days(person: dict) -> int:
        return person["contact_status"]["days_since_contact"] or 0

    def pressing(person: dict) -> tuple:
        never = person["contact_status"]["days_since_contact"] is None
        return (not never, -days(person), _by_name(person))

    overdue.sort(key=pressing)
    due_soon.sort(key=lambda p: (-days(p), _by_name(p)))
    shown_overdue, overdue_cut = _bounded(overdue, limit)
    shown_due_soon, due_soon_cut = _bounded(due_soon, limit)
    return {
        "overdue": [person_brief(snapshot, p) for p in shown_overdue],
        "due_soon": [person_brief(snapshot, p) for p in shown_due_soon],
        "overdue_total": len(overdue),
        "due_soon_total": len(due_soon),
        "total": len(overdue) + len(due_soon),
        "returned": len(shown_overdue) + len(shown_due_soon),
        "truncated": overdue_cut or due_soon_cut,
    }


def upcoming(
    snapshot: dict, within_days: int = 30, limit: int = 25
) -> dict:
    """Birthdays within ``within_days``, soonest first (days come from the snapshot)."""
    rows = []
    for person in snapshot["people"]:
        until = person["days_until_birthday"]
        if until is None or until > within_days:
            continue
        rows.append((until, _by_name(person), person))
    rows.sort(key=lambda r: r[:2])
    shown, truncated = _bounded(rows, limit)
    birthdays = []
    for until, _, person in shown:
        age = person["age"]
        birthdays.append(
            {
                "person": person_brief(snapshot, person),
                "birthday": person["birthday"],
                "days_until": until,
                # ``age`` is completed years today, so it already counts a birthday that is today.
                "turning": None if age is None else (age if until == 0 else age + 1),
            }
        )
    return {
        "birthdays": birthdays,
        "total": len(rows),
        "returned": len(birthdays),
        "truncated": truncated,
    }


def find_relationship(snapshot: dict, person_id: str, other_id: str, type: str) -> dict | None:
    """An existing row saying ``other_id`` is ``type`` of ``person_id``, in either orientation."""
    for link in snapshot["relationships"]:
        end = connection_type(link, person_id)
        if end and end == (other_id, type):
            return link
    return None


def parse_birthday(text: str) -> tuple[date, bool]:
    """``YYYY-MM-DD``, or ``MM-DD`` when the year is unknown (returned as year 2000)."""
    raw = text.strip()
    try:
        if re.fullmatch(r"\d{2}-\d{2}", raw):
            return date.fromisoformat(f"{_UNKNOWN_YEAR}-{raw}"), True
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
            return date.fromisoformat(raw), False
    except ValueError:
        pass
    raise ValueError(
        f"Birthday {text!r} is not valid. Use YYYY-MM-DD, or MM-DD when the year is unknown."
    )


