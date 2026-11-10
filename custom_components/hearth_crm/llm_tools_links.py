"""Claude's write tools for relationships, households and groups.

Every write goes through the service with source ``"claude"`` (``crm.run``) and then sends the
change notice (``crm.notify``), so open panels refresh. Results are read back from a fresh
snapshot, so derived values (relationship labels and inverse types, household names and
status) come from Python. Nothing here computes an inverse type: a link is read from either
side with ``llm_logic.connection_type`` and ``find_relationship``.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import probatio

from .const import TOOL_PREFIX
from .db import BackupInProgress
from .enums import ConnectionType
from .llm_base import (
    DEFAULT_LIMIT,
    ID_RULE,
    KIND_WORDS,
    SOURCE,
    WRITE_ADDITIVE,
    WRITE_DESTRUCTIVE,
    WRITE_UPDATE,
    HearthTool,
    ToolCRM,
    ToolError,
    find_record,
    replaces_text,
)
from .llm_logic import connection_type, find_relationship, person_brief, person_briefs
from .service import InvalidInput, NotFound

_LOGGER = logging.getLogger(__name__)

_TYPES = [t.value for t in ConnectionType]

_CLEARS = 'An empty string "" clears it.'
_NOTHING_TO_CHANGE = "Nothing to change: pass at least one field to set. Nothing was changed."
_BOTH_WAYS = "A person cannot be both added and removed in one call. Nothing was changed."

# The tools always store the viewer (person_id) as A, so the service's field names map back.
_LINK_FIELDS = {"person_a_id": "person_id", "person_b_id": "other_person_id"}

_WARNINGS = {
    "needs_name": "Ask the user to name this household",
    "not_a_household": "Only one adult and no children remain. Tell the user; do not delete it",
}

_PERSON_ID = "The person's id from a search or get result."


def _text_or_none(text: str) -> str | None:
    return text.strip() or None


def _place_or_none(text: str) -> dict | None:
    text = text.strip()
    return {"formatted": text} if text else None


def _light(snapshot: dict, person_ids: list[str]) -> list[dict]:
    by_id = {p["id"]: p for p in snapshot["people"]}
    return [{"id": i, "name": by_id[i]["name"]} for i in person_ids if i in by_id]


# -- relationships -----------------------------------------------------------------------


def _relationship_result(snapshot: dict, row: dict, person_id: str) -> dict:
    """The link as ``person_id`` sees it: ``other`` is ``type`` of ``person``."""
    other_id, link_type = connection_type(row, person_id)
    person = find_record(snapshot, "people", "person", person_id)
    other = find_record(snapshot, "people", "person", other_id)
    return {
        "relationship_id": row["id"],
        "label": row["label"],
        "person": person_brief(snapshot, person),
        "other": person_brief(snapshot, other),
        "type": link_type,
        "notes": row["notes"],
    }


async def _write_link(crm: ToolCRM, fn) -> dict:
    """A relationship write, with service field names given back as the tool's own."""
    try:
        return await crm.run(fn)
    except InvalidInput as err:
        raise InvalidInput(_LINK_FIELDS.get(err.field, err.field), err.message) from None


class AddRelationshipTool(HearthTool):
    name = f"{TOOL_PREFIX}add_relationship"
    title = "Add a relationship"
    description = (
        "Link two people. Direction: other_person_id IS the type OF person_id. For example, to "
        "record that Sam is Alex's child, pass person_id=Alex's id, other_person_id=Sam's id "
        "and type 'Child'. Types: " + ", ".join(_TYPES) + " (Pibling means aunt or uncle and "
        "Nibling niece or nephew; there are no Aunt, Uncle, Niece or Nephew types). One link "
        "reads correctly from both sides, so never add the reverse as well: if the same link "
        "already exists from either side, nothing is created and the result says "
        "already_existed. Look up the existing relationships first with get_person so "
        "nothing is duplicated. Then complete the family by calling again for each link that "
        "follows: a child of X is also a child of X's spouse, and a Sibling of X's other "
        "children; a sibling of X shares X's parents, and is a Pibling to X's children; when "
        "the user's spouse has siblings, each sibling and each sibling's spouse is a "
        "Sibling-in-law of the user, the siblings are Siblings of each other, and their "
        "children are the user's Niblings. Tell the user which links you added. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "person_id",
                description="The person the link is described from: " + _PERSON_ID,
            ): str,
            probatio.Required(
                "other_person_id",
                description="The person who IS the type of person_id: " + _PERSON_ID,
            ): str,
            probatio.Required(
                "type",
                description=f"What other_person_id is to person_id: one of {', '.join(_TYPES)}.",
            ): probatio.In(_TYPES),
            probatio.Optional("notes", description="Notes about this link."): str,
        }
    )
    annotations = WRITE_ADDITIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        person_id, other_id, link_type = args["person_id"], args["other_person_id"], args["type"]
        snapshot = await crm.snapshot()
        existing = find_relationship(snapshot, person_id, other_id, link_type)
        if existing is not None:
            return _relationship_result(snapshot, existing, person_id) | {
                "already_existed": True
            }
        fields = {
            "person_a_id": person_id,
            "person_b_id": other_id,
            "type": link_type,
            "notes": _text_or_none(args.get("notes", "")),
        }
        saved = await _write_link(crm, lambda s: s.create("relationship", fields, SOURCE))
        crm.notify("relationship", saved["id"], "create")
        snapshot = await crm.snapshot()
        row = find_record(snapshot, "relationships", "relationship", saved["id"])
        return _relationship_result(snapshot, row, person_id) | {"already_existed": False}


class UpdateRelationshipTool(HearthTool):
    name = f"{TOOL_PREFIX}update_relationship"
    title = "Update a relationship"
    description = (
        "Change a relationship as one of its people sees it, the way get_person lists it. "
        "person_id is that person; other_person_id and type say who the other person is and "
        "what they are to person_id (other_person_id IS the type OF person_id). Pass only "
        "what changes; notes \"\" clears the notes. A change that would make this link the "
        "same as another existing link is refused with \"That relationship already exists "
        "(<label>, relationship_id <id>). Nothing was changed.\" Types: " + ", ".join(_TYPES) + ". "
        + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "relationship_id",
                description="The relationship's id, from get_person's relationships.",
            ): str,
            probatio.Required(
                "person_id",
                description="The person whose side the change is described from; one end of "
                "the relationship. " + _PERSON_ID,
            ): str,
            probatio.Optional(
                "other_person_id",
                description="A new other person, who IS the type of person_id. " + _PERSON_ID,
            ): str,
            probatio.Optional(
                "type",
                description=f"A new type: what the other person is to person_id, one of "
                f"{', '.join(_TYPES)}.",
            ): probatio.In(_TYPES),
            probatio.Optional(
                "notes",
                description=f"New notes about this link. {replaces_text('get_person')} {_CLEARS}",
            ): str,
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        relationship_id, person_id = args["relationship_id"], args["person_id"]
        if not {"other_person_id", "type", "notes"} & args.keys():
            raise ToolError(_NOTHING_TO_CHANGE)
        snapshot = await crm.snapshot()
        row = find_record(snapshot, "relationships", "relationship", relationship_id)
        end = connection_type(row, person_id)
        if end is None:
            raise ToolError(
                "That person is not one end of this relationship. Pass as person_id the person "
                "whose get_person listed it. Nothing was changed."
            )
        other_id = args.get("other_person_id", end[0])
        link_type = args.get("type", end[1])
        changes: dict[str, Any] = {}
        if (other_id, link_type) != end:
            duplicate = find_relationship(snapshot, person_id, other_id, link_type)
            if duplicate is not None:
                raise ToolError(
                    f"That relationship already exists ({duplicate['label']}, relationship_id "
                    f"{duplicate['id']}). Nothing was changed."
                )
            # Both ends and the type go together, with the viewer as A, so the meaning is the
            # one chosen here whichever way the row was stored. The server re-derives the rest.
            changes |= {"person_a_id": person_id, "person_b_id": other_id, "type": link_type}
        if "notes" in args:
            changes["notes"] = _text_or_none(args["notes"])
        if changes:
            await _write_link(
                crm, lambda s: s.update("relationship", relationship_id, changes, SOURCE)
            )
            crm.notify("relationship", relationship_id, "update")
            snapshot = await crm.snapshot()
            row = find_record(snapshot, "relationships", "relationship", relationship_id)
        return _relationship_result(snapshot, row, person_id)


class RemoveRelationshipTool(HearthTool):
    name = f"{TOOL_PREFIX}remove_relationship"
    title = "Remove a relationship"
    description = (
        "Permanently remove one relationship. Confirm with the user first, saying which link "
        "(both people and the type) will be removed. The people themselves are kept. The "
        "result echoes what was removed. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "relationship_id",
                description="The relationship's id, from get_person's relationships.",
            ): str
        }
    )
    annotations = WRITE_DESTRUCTIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        relationship_id = args["relationship_id"]
        snapshot = await crm.snapshot()
        row = find_record(snapshot, "relationships", "relationship", relationship_id)
        removed = _relationship_result(snapshot, row, row["person_a_id"])
        await crm.run(lambda s: s.delete("relationship", relationship_id, SOURCE))
        crm.notify("relationship", relationship_id, "delete")
        return {"deleted": removed}


# -- households --------------------------------------------------------------------------


def _household_result(snapshot: dict, household_id: str) -> dict:
    row = find_record(snapshot, "households", "household", household_id)
    result = {
        "id": row["id"],
        "name": row["name"],
        "name_status": row["name_status"],
        "name_override": row["name_override"],
        "address": row["address"],
        "notes": row["notes"],
        "members": person_briefs(snapshot, row["member_ids"]),
    }
    if warning := _WARNINGS.get(row["name_status"]):
        result["warning"] = warning
    return result


def _joining(
    snapshot: dict, person_ids: list[str], household_id: str | None, move: bool
) -> list[str]:
    """The people who must change household to join; refuses a move unless ``move``.

    ``household_id`` is None for a household not created yet. Checks everyone before any
    write, so a refusal changes nothing.
    """
    households = {h["id"]: h for h in snapshot["households"]}
    joining = []
    for person_id in dict.fromkeys(person_ids):
        person = find_record(snapshot, "people", "person", person_id)
        current = person["household_id"]
        if household_id is not None and current == household_id:
            continue
        if current is not None and not move:
            name = households[current]["name"]
            where = f"the household '{name}'" if name else f"an unnamed household (id {current})"
            raise ToolError(
                f"{person['name']} is already in {where}. To move them, ask the user and call "
                "again with move=true. To add someone to that household instead, use "
                "update_household."
            )
        joining.append(person_id)
    return joining


@dataclass
class _Step:
    """One committed-on-its-own write in a household change, named for the model."""

    label: str
    write: Callable[[Any], Any]
    entity: str
    entity_id: str


@dataclass
class _Partial:
    """How far a household change got when one of its writes failed."""

    saved: list[str]
    failed: str
    reason: str
    not_tried: list[str]


def _reason(err: Exception) -> str:
    """Why a write failed, in words the model can relay."""
    if isinstance(err, NotFound):
        return f"that {KIND_WORDS.get(err.kind, err.kind)} no longer exists in Hearth"
    if isinstance(err, BackupInProgress):
        return "Home Assistant started a backup; try again in a minute"
    if isinstance(err, InvalidInput):
        return f"{err.field}: {err.message}"
    _LOGGER.exception("Hearth household write failed")
    return "unexpected error"


async def _run_steps(crm: ToolCRM, steps: list[_Step], *, committed: bool) -> _Partial | None:
    """Run the writes in order, notifying each one that commits.

    Stops at the first failure. When nothing has committed yet (``committed`` false and the
    first write fails) the error is raised as it is, since then nothing was changed;
    otherwise the result says what was saved and what was not.
    """
    saved: list[str] = []
    for index, step in enumerate(steps):
        try:
            await crm.run(step.write)
        except Exception as err:
            if not committed and not saved:
                raise
            return _Partial(saved, step.label, _reason(err), [s.label for s in steps[index + 1 :]])
        crm.notify(step.entity, step.entity_id, "update")
        saved.append(step.label)
    return None


def _member_step(label: str, person_id: str, household_id: str | None) -> _Step:
    changes = {"household_id": household_id}
    return _Step(
        label, lambda s: s.update("person", person_id, changes, SOURCE), "person", person_id
    )


def _names(snapshot: dict, person_ids: list[str]) -> dict[str, str]:
    return {p["id"]: p["name"] for p in snapshot["people"] if p["id"] in set(person_ids)}


_HOUSEHOLD_RULES = (
    "Rules: a person belongs to at most one household; if one of these people already has a "
    "household, add the others to it with update_household rather than creating another. A "
    "single adult with no children is not a household. Hearth names a household from its "
    "adults (e.g. 'Sam & Alex Rivera' or 'Sam Rivera Family'), so set name_override only for "
    "a name Hearth cannot produce. Someone already in another household is moved only with "
    "move=true, after the user agrees. The result gives the name and name_status; when it "
    "has a warning, act on it. Households are never deleted through these tools. "
)
_MOVE = (
    "True only after the user agrees to move people out of the household they are in now. "
    "Default false."
)


class CreateHouseholdTool(HearthTool):
    name = f"{TOOL_PREFIX}create_household"
    title = "Create a household"
    description = (
        "Create a household (people who live together) and put the given people in it. "
        + _HOUSEHOLD_RULES
        + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "person_ids",
                description="Ids of the people who live there (at least one), from search or "
                "get results.",
            ): probatio.All([str], probatio.Length(min=1, msg="needs at least one person id")),
            probatio.Optional(
                "name_override",
                description="A name to use instead of the generated one, only when Hearth "
                "cannot produce the right name.",
            ): str,
            probatio.Optional(
                "address", description="The household's address as free text, e.g. '12 Elm St'."
            ): str,
            probatio.Optional("notes", description="Free-form notes about the household."): str,
            probatio.Optional("move", default=False, description=_MOVE): bool,
        }
    )
    annotations = WRITE_ADDITIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        snapshot = await crm.snapshot()
        joining = _joining(snapshot, args["person_ids"], None, args["move"])
        names = _names(snapshot, joining)
        fields = {
            "name_override": _text_or_none(args.get("name_override", "")),
            "address": _place_or_none(args.get("address", "")),
            "notes": _text_or_none(args.get("notes", "")),
        }
        saved = await crm.run(lambda s: s.create("household", fields, SOURCE))
        household_id = saved["id"]
        crm.notify("household", household_id, "create")
        steps = [_member_step(names[p], p, household_id) for p in joining]
        partial = await _run_steps(crm, steps, committed=True)
        if partial is not None:
            members = " and ".join(partial.saved) if partial.saved else "no members yet"
            not_tried = (
                f" {', '.join(partial.not_tried)} {'was' if len(partial.not_tried) == 1 else 'were'}"
                " not added either."
                if partial.not_tried
                else ""
            )
            raise ToolError(
                f"The household was created (id {household_id}) with {members}, but "
                f"{partial.failed} could not be added: {partial.reason}.{not_tried} Call "
                f"update_household with household_id {household_id} to finish, adding only "
                "the people not added. Do not create another household."
            )
        return _household_result(await crm.snapshot(), household_id)


class UpdateHouseholdTool(HearthTool):
    name = f"{TOOL_PREFIX}update_household"
    title = "Update a household"
    description = (
        "Change a household's details or members. Only what is passed changes; an empty "
        "string clears a text field, and name_override \"\" goes back to the generated name. "
        "Removing someone leaves them in no household. " + _HOUSEHOLD_RULES + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "household_id",
                description="The household's id, from a person's 'household' in get_person.",
            ): str,
            probatio.Optional(
                "name_override",
                description="A name to use instead of the generated one, only when Hearth "
                f"cannot produce the right name. {_CLEARS}",
            ): str,
            probatio.Optional(
                "address", description=f"The household's address as free text. {_CLEARS}"
            ): str,
            probatio.Optional(
                "notes",
                description=f"Notes about the household. {replaces_text('get_household')} "
                f"{_CLEARS}",
            ): str,
            probatio.Optional(
                "add_person_ids", description="Ids of people to add to the household."
            ): [str],
            probatio.Optional(
                "remove_person_ids",
                description="Ids of members to take out of the household.",
            ): [str],
            probatio.Optional("move", default=False, description=_MOVE): bool,
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        household_id = args["household_id"]
        changes: dict[str, Any] = {}
        if "name_override" in args:
            changes["name_override"] = _text_or_none(args["name_override"])
        if "address" in args:
            changes["address"] = _place_or_none(args["address"])
        if "notes" in args:
            changes["notes"] = _text_or_none(args["notes"])
        add = args.get("add_person_ids", [])
        remove = list(dict.fromkeys(args.get("remove_person_ids", [])))
        if not changes and not add and not remove:
            raise ToolError(_NOTHING_TO_CHANGE)
        if set(add) & set(remove):
            raise ToolError(_BOTH_WAYS)

        snapshot = await crm.snapshot()
        find_record(snapshot, "households", "household", household_id)
        for person_id in remove:
            person = find_record(snapshot, "people", "person", person_id)
            if person["household_id"] != household_id:
                raise ToolError(f"{person['name']} is not in this household. Nothing was changed.")
        joining = _joining(snapshot, add, household_id, args["move"])

        names = _names(snapshot, [*remove, *joining])
        steps = []
        if changes:
            steps.append(
                _Step(
                    f"the household's {', '.join(changes)}",
                    lambda s: s.update("household", household_id, changes, SOURCE),
                    "household",
                    household_id,
                )
            )
        steps += [_member_step(f"taking out {names[p]}", p, None) for p in remove]
        steps += [_member_step(f"adding {names[p]}", p, household_id) for p in joining]
        partial = await _run_steps(crm, steps, committed=False)
        if partial is not None:
            not_saved = "; ".join([f"{partial.failed} ({partial.reason})", *partial.not_tried])
            raise ToolError(
                f"The household (id {household_id}) was only partly updated. Saved: "
                f"{'; '.join(partial.saved)}. Not saved: {not_saved}. Call update_household "
                f"with household_id {household_id} again for only what was not saved."
            )
        return _household_result(await crm.snapshot(), household_id)


# -- groups ------------------------------------------------------------------------------


def _group_result(snapshot: dict, group_id: str) -> dict:
    row = find_record(snapshot, "groups", "contact_group", group_id)
    members = person_briefs(snapshot, row["member_ids"])
    shown = members[:DEFAULT_LIMIT]
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "members": shown,
        "total": len(members),
        "returned": len(shown),
        "truncated": len(members) > len(shown),
    }


def _check_people(snapshot: dict, person_ids: list[str]) -> None:
    known = {p["id"] for p in snapshot["people"]}
    for person_id in person_ids:
        if person_id not in known:
            raise ToolError(f"There is no person with id {person_id!r}. Nothing was changed.")


class CreateGroupTool(HearthTool):
    name = f"{TOOL_PREFIX}create_group"
    title = "Create a group"
    description = (
        "Create a group of people who share a context, e.g. a book club, a team or a church. "
        "Call list_groups first, so you do not create a group that already exists. Change its "
        "members later with set_group_members. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required("name", description="The group's name."): probatio.All(
                str, probatio.Length(min=1, msg="must not be empty")
            ),
            probatio.Optional("description", description="What the group is."): str,
            probatio.Optional(
                "person_ids", default=list, description="Ids of the first members, if any."
            ): [str],
        }
    )
    annotations = WRITE_ADDITIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        members = list(dict.fromkeys(args["person_ids"]))
        _check_people(await crm.snapshot(), members)
        fields = {
            "name": args["name"],
            "description": _text_or_none(args.get("description", "")),
            "member_ids": members,
        }
        saved = await crm.run(lambda s: s.create("contact_group", fields, SOURCE))
        crm.notify("contact_group", saved["id"], "create")
        return _group_result(await crm.snapshot(), saved["id"])


class UpdateGroupTool(HearthTool):
    name = f"{TOOL_PREFIX}update_group"
    title = "Update a group"
    description = (
        "Rename a group or change its description. Only what is passed changes; description "
        "\"\" clears it. Change members with set_group_members. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "group_id",
                description="The group's id, from list_groups or a person's 'groups' in get_person.",
            ): str,
            probatio.Optional("name", description="A new name."): probatio.All(
                str, probatio.Length(min=1, msg="must not be empty")
            ),
            probatio.Optional("description", description=f"A new description. {_CLEARS}"): str,
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        group_id = args["group_id"]
        changes: dict[str, Any] = {}
        if "name" in args:
            changes["name"] = args["name"]
        if "description" in args:
            changes["description"] = _text_or_none(args["description"])
        if not changes:
            raise ToolError(_NOTHING_TO_CHANGE)
        await crm.run(lambda s: s.update("contact_group", group_id, changes, SOURCE))
        crm.notify("contact_group", group_id, "update")
        return _group_result(await crm.snapshot(), group_id)


class SetGroupMembersTool(HearthTool):
    name = f"{TOOL_PREFIX}set_group_members"
    title = "Change a group's members"
    description = (
        "Add people to a group and take people out of it. The changes apply to the group's "
        "membership as it is when this runs, not to an earlier read, so members added in the "
        "meantime are kept: pass only who to add and who to remove, never the whole list. "
        "Removing someone who is not a member, or adding a member, changes nothing. An "
        "unknown id refuses the whole call. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "group_id",
                description="The group's id, from list_groups or a person's 'groups' in get_person.",
            ): str,
            probatio.Optional(
                "add_person_ids", default=list, description="Ids of people to add to the group."
            ): [str],
            probatio.Optional(
                "remove_person_ids",
                default=list,
                description="Ids of people to take out of the group.",
            ): [str],
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        group_id = args["group_id"]
        add = list(dict.fromkeys(args["add_person_ids"]))
        remove = set(args["remove_person_ids"])
        if not add and not remove:
            raise ToolError(_NOTHING_TO_CHANGE)
        if set(add) & remove:
            raise ToolError(_BOTH_WAYS)

        def apply(service) -> tuple[list[str], list[str]]:
            # Read the membership now, in the same executor job as the write.
            snapshot = service.snapshot()
            current = find_record(snapshot, "groups", "contact_group", group_id)["member_ids"]
            _check_people(snapshot, [*add, *remove])
            added = [p for p in add if p not in current]
            removed = [p for p in current if p in remove]
            if added or removed:
                members = [p for p in current if p not in remove] + added
                service.update("contact_group", group_id, {"member_ids": members}, SOURCE)
            return added, removed

        added, removed = await crm.run(apply)
        if added or removed:
            crm.notify("contact_group", group_id, "update")
        snapshot = await crm.snapshot()
        return _group_result(snapshot, group_id) | {
            "added": _light(snapshot, added),
            "removed": _light(snapshot, removed),
        }


LINK_TOOLS: list[type[HearthTool]] = [
    AddRelationshipTool,
    UpdateRelationshipTool,
    RemoveRelationshipTool,
    CreateHouseholdTool,
    UpdateHouseholdTool,
    CreateGroupTool,
    UpdateGroupTool,
    SetGroupMembersTool,
]
