"""Claude's write tools for people, interactions and relationship summaries.

Every write goes through the service with source ``"claude"`` (``crm.run``) and then sends the
change notice (``crm.notify``), so open panels refresh. Results are read back from a fresh
snapshot, so derived values (household names, contact status, age) come from Python.
"""

from __future__ import annotations

from typing import Any

import probatio

from .const import TOOL_PREFIX
from .enums import InteractionType
from .llm_base import (
    HIDDEN_PERSON_FIELDS,
    ID_RULE,
    STORED_DATA_RULE,
    WRITE_ADDITIVE,
    WRITE_DESTRUCTIVE,
    WRITE_UPDATE,
    HearthTool,
    ToolCRM,
    ToolError,
    find_record,
    replaces_text,
)
from .llm_logic import parse_birthday, person_brief, similar_people

_TEXT_FIELDS = (
    "phone", "phone2", "email", "email2", "occupation", "employer", "how_i_know_them", "notes",
    "website", "linkedin", "facebook", "instagram",
)
_PLACE_FIELDS = ("address", "school")
_FLAGS = ("favorite", "close_friend")

_INTERACTION_TYPES = [t.value for t in InteractionType]
_DEFAULT_TYPE = InteractionType.CATCH_UP.value

_CLEARS = 'An empty string "" clears it.'
_NOTHING_TO_CHANGE = "Nothing to change: pass at least one field to set. Nothing was changed."
NEXT_STEP = (
    "Rewrite each person's relationship summary with set_relationship_summary, "
    "folding in only what this interaction covered."
)

# The person fields both create_person and update_person take, with their descriptions.
_PERSON_FIELDS: dict[str, tuple[str, Any]] = {
    "phone": ("Main phone number.", str),
    "phone2": ("A second phone number.", str),
    "email": ("Main email address.", str),
    "email2": ("A second email address.", str),
    "occupation": ("Their job or role, e.g. 'Nurse'.", str),
    "employer": ("Where they work.", str),
    "how_i_know_them": (
        "How the user knows this person, in a few words, e.g. 'College roommate' or "
        "'Neighbor on Elm St'. Set it whenever the connection is known.",
        str,
    ),
    "notes": (
        "The user's own notes about the person. Do not write your own summaries here: what you "
        "write about the relationship goes in set_relationship_summary, and a meetup goes in "
        "log_interaction.",
        str,
    ),
    "birthday": (
        "Birthday as YYYY-MM-DD, or MM-DD when the year is unknown (e.g. '02-29'). Never guess "
        "a year.",
        str,
    ),
    "favorite": ("Mark as a favorite.", bool),
    "close_friend": (
        "A close friend: Hearth then reminds the user to keep in touch on a rotation.", bool
    ),
    "website": ("Website URL.", str),
    "linkedin": ("LinkedIn profile URL.", str),
    "facebook": ("Facebook profile URL.", str),
    "instagram": ("Instagram handle or URL.", str),
    "address": (
        "Home address as free text, e.g. '12 Elm St, Springfield'. Replaces any address held.",
        str,
    ),
    "school": ("School they attend or attended, as free text.", str),
}


def _person_schema(*, clearing: bool) -> dict:
    """The optional person fields; on update each text field says that "" clears it."""
    schema = {}
    for key, (description, kind) in _PERSON_FIELDS.items():
        if clearing and key == "notes":
            description = f"{description} {replaces_text('get_person')}"
        if clearing and kind is str:
            description = f"{description} {_CLEARS}"
        schema[probatio.Optional(key, description=description)] = kind
    return schema


def _person_changes(args: dict[str, Any]) -> dict:
    """The service fields for the person fields present in ``args``. "" clears a text field."""
    changes: dict[str, Any] = {}
    if "name" in args:
        changes["name"] = args["name"]
    for key in _TEXT_FIELDS:
        if key in args:
            changes[key] = args[key].strip() or None
    for key in _PLACE_FIELDS:
        if key in args:
            text = args[key].strip()
            changes[key] = {"formatted": text} if text else None
    for key in _FLAGS:
        if key in args:
            changes[key] = args[key]
    if "birthday" in args:
        raw = args["birthday"].strip()
        if raw:
            try:
                birthday, year_unknown = parse_birthday(raw)
            except ValueError as err:
                raise ToolError(f"birthday: {err} Nothing was changed.") from None
            changes["birthday"] = birthday.isoformat()
            changes["birth_year_unknown"] = year_unknown
        else:
            changes["birthday"] = None
            changes["birth_year_unknown"] = False
    return changes


def _person_result(snapshot: dict, person_id: str) -> dict:
    """The saved person as Hearth now holds them, with the brief's derived values."""
    person = find_record(snapshot, "people", "person", person_id)
    record = {k: v for k, v in person.items() if k not in HIDDEN_PERSON_FIELDS}
    return record | person_brief(snapshot, person)


def _people(snapshot: dict, person_ids: list[str]) -> list[dict]:
    """Light ``{id, name, household_name}`` entries, sorted by name."""
    by_id = {p["id"]: p for p in snapshot["people"]}
    people = sorted(
        (by_id[i] for i in set(person_ids) if i in by_id),
        key=lambda p: (p["name"].casefold(), p["id"]),
    )
    return [{"id": p["id"], "name": p["name"], "household_name": p["household_name"]} for p in people]


def _interaction_result(snapshot: dict, interaction: dict) -> dict:
    return interaction | {"people": _people(snapshot, interaction["person_ids"])}


def _household_words(person: dict) -> str:
    """The person's household name, or which kind of nameless they are."""
    if person["household_name"]:
        return person["household_name"]
    return "unnamed household" if person["household_id"] else "no household"


def _candidates(snapshot: dict, matches: list[dict]) -> str:
    by_id = {p["id"]: p for p in snapshot["people"]}
    return ", ".join(
        f"{m['name']} (id {m['id']}, {_household_words(by_id[m['id']])}, "
        f"{m['how_i_know_them'] or 'unknown'})"
        for m in matches
    )


class CreatePersonTool(HearthTool):
    name = f"{TOOL_PREFIX}create_person"
    title = "Create a person"
    description = (
        "Add a new person to the user's Hearth. Search first: names often come from voice "
        "dictation and may be misheard. If Hearth already has people with similar names this "
        "refuses and lists them; ask the user whether it is one of them, and only call again "
        "with confirm_new=true once the user says this is someone new. Set how_i_know_them "
        "when the connection to the user is known. If the birth year is unknown, pass the "
        "birthday as MM-DD. Add family links with the relationship tools and households with the "
        "household tools afterwards."
    )
    parameters = probatio.Schema(
        {
            probatio.Required("name", description="The person's full name."): str,
            **_person_schema(clearing=False),
            probatio.Optional(
                "confirm_new",
                default=False,
                description=(
                    "True only after the user has confirmed this is a new person and not one "
                    "of the similar names Hearth listed. Default false."
                ),
            ): bool,
        }
    )
    annotations = WRITE_ADDITIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        fields = _person_changes(args)
        if not args["confirm_new"]:
            snapshot = await crm.snapshot()
            matches = similar_people(snapshot, args["name"])
            if matches:
                raise ToolError(
                    "Hearth already has people with similar names: "
                    f"{_candidates(snapshot, matches)}. "
                    "Ask the user whether this is one of them. If this really is a new person, "
                    "call again with confirm_new=true."
                )
        saved = await crm.run(lambda s: s.create("person", fields, "claude"))
        crm.notify("person", saved["id"], "create")
        return _person_result(await crm.snapshot(), saved["id"])


class UpdatePersonTool(HearthTool):
    name = f"{TOOL_PREFIX}update_person"
    title = "Update a person"
    description = (
        "Change some of a person's details. Only the fields passed change; an empty string "
        "clears an optional text field, and birthday \"\" clears the birthday. Pass name to "
        "rename; the result carries the household name that follows from it. To record a "
        "meetup use log_interaction, and to rewrite the relationship summary use "
        "set_relationship_summary. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "person_id", description="The person's id from a search or get result."
            ): str,
            probatio.Optional("name", description="A new full name, to rename the person."): str,
            **_person_schema(clearing=True),
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        person_id = args["person_id"]
        changes = _person_changes(args)
        if not changes:
            raise ToolError(_NOTHING_TO_CHANGE)
        await crm.run(lambda s: s.update("person", person_id, changes, "claude"))
        crm.notify("person", person_id, "update")
        return _person_result(await crm.snapshot(), person_id)


class LogInteractionTool(HearthTool):
    name = f"{TOOL_PREFIX}log_interaction"
    title = "Log an interaction"
    description = (
        "Record a meetup, call, trip or life event with one or more people. Put the write-up in "
        "notes: notes is what the Hearth panel shows, and summary is only a short title. Record "
        "only what the user said about this interaction. Leave the user out of person_ids: "
        "list only the other people, or the user's own summary gets rewritten. Types: "
        + ", ".join(_INTERACTION_TYPES)
        + ". The result gives each person's current relationship summary; then rewrite each "
        "one with set_relationship_summary, folding in only what this interaction covered. "
        + ID_RULE
        + " "
        + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "person_ids",
                description="Ids of everyone in the interaction (at least one), from search or get results.",
            ): probatio.All([str], probatio.Length(min=1, msg="needs at least one person id")),
            probatio.Required(
                "summary", description="A short title, e.g. 'Coffee downtown' (up to 300 characters)."
            ): probatio.All(str, probatio.Length(min=1, msg="must not be empty")),
            probatio.Optional(
                "type",
                default=_DEFAULT_TYPE,
                description=f"The kind of interaction: one of {', '.join(_INTERACTION_TYPES)}. Default {_DEFAULT_TYPE}.",
            ): probatio.In(_INTERACTION_TYPES),
            probatio.Optional(
                "date", description="When it happened, as YYYY-MM-DD. Default today."
            ): str,
            probatio.Optional(
                "notes",
                description="The write-up of what happened and what was talked about. The panel shows this.",
            ): str,
        }
    )
    annotations = WRITE_ADDITIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        fields = {
            "person_ids": list(dict.fromkeys(args["person_ids"])),
            "summary": args["summary"],
            "type": args["type"],
            "date": args.get("date") or crm.today.isoformat(),
            "notes": (args.get("notes") or "").strip() or None,
        }
        saved = await crm.run(lambda s: s.create("interaction", fields, "claude"))
        crm.notify("interaction", saved["id"], "create")
        snapshot = await crm.snapshot()
        by_id = {p["id"]: p for p in snapshot["people"]}
        people = sorted(
            (by_id[i] for i in saved["person_ids"] if i in by_id),
            key=lambda p: (p["name"].casefold(), p["id"]),
        )
        return saved | {
            "people": [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "household_name": p["household_name"],
                    "relationship_summary": p["relationship_summary"],
                    "summary_updated": p["summary_updated"],
                    "contact_status": p["contact_status"],
                }
                for p in people
            ],
            "next_step": NEXT_STEP,
        }


class UpdateInteractionTool(HearthTool):
    name = f"{TOOL_PREFIX}update_interaction"
    title = "Update an interaction"
    description = (
        "Correct a logged interaction. Only the fields passed change; notes \"\" clears the "
        "notes. The write-up belongs in notes, which the panel shows. Types: "
        + ", ".join(_INTERACTION_TYPES)
        + ". "
        + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "interaction_id",
                description="The interaction's id, from get_person's recent_interactions.",
            ): str,
            probatio.Optional("summary", description="A new short title."): probatio.All(
                str, probatio.Length(min=1, msg="must not be empty")
            ),
            probatio.Optional(
                "type", description=f"A new kind: one of {', '.join(_INTERACTION_TYPES)}."
            ): probatio.In(_INTERACTION_TYPES),
            probatio.Optional("date", description="A new date, as YYYY-MM-DD."): str,
            probatio.Optional(
                "notes",
                description=f"New write-up text. {replaces_text('get_person')} {_CLEARS}",
            ): str,
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        interaction_id = args["interaction_id"]
        changes = {k: args[k] for k in ("summary", "type", "date") if k in args}
        if "notes" in args:
            changes["notes"] = args["notes"].strip() or None
        if not changes:
            raise ToolError(_NOTHING_TO_CHANGE)
        saved = await crm.run(lambda s: s.update("interaction", interaction_id, changes, "claude"))
        crm.notify("interaction", interaction_id, "update")
        return _interaction_result(await crm.snapshot(), saved)


class DeleteInteractionTool(HearthTool):
    name = f"{TOOL_PREFIX}delete_interaction"
    title = "Delete an interaction"
    description = (
        "Permanently delete one logged interaction. Confirm with the user first, saying which "
        "interaction (date, title and people) will be removed. The result echoes what was "
        "removed. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "interaction_id",
                description="The interaction's id, from get_person's recent_interactions.",
            ): str
        }
    )
    annotations = WRITE_DESTRUCTIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        interaction_id = args["interaction_id"]
        snapshot = await crm.snapshot()
        removed = _interaction_result(
            snapshot, find_record(snapshot, "interactions", "interaction", interaction_id)
        )
        await crm.run(lambda s: s.delete("interaction", interaction_id, "claude"))
        crm.notify("interaction", interaction_id, "delete")
        return {"deleted": removed}


class SetRelationshipSummaryTool(HearthTool):
    name = f"{TOOL_PREFIX}set_relationship_summary"
    title = "Set a relationship summary"
    description = (
        "Replace a person's relationship summary: a short, durable description of the user's "
        "relationship with them and their common ground. Rules: durable facts only, no dates, "
        "and no recap of a specific meetup (that belongs in an interaction's notes). Write in "
        "the first person from the user's side, e.g. 'Michael and I both love hiking', never "
        "'<the user's name> and Michael...'. Avoid phrasing that could read as the person and "
        "some third party. After logging an interaction, fold in only what it covered and keep "
        "the rest. Hearth stamps summary_updated when the text changes. " + ID_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "person_id", description="The person's id from a search or get result."
            ): str,
            probatio.Required(
                "summary", description=f"The whole new summary, replacing the old one. {_CLEARS}"
            ): str,
        }
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        person_id = args["person_id"]
        changes = {"relationship_summary": args["summary"].strip() or None}
        await crm.run(lambda s: s.update("person", person_id, changes, "claude"))
        crm.notify("person", person_id, "update")
        return _person_result(await crm.snapshot(), person_id)


PEOPLE_TOOLS: list[type[HearthTool]] = [
    CreatePersonTool,
    UpdatePersonTool,
    LogInteractionTool,
    UpdateInteractionTool,
    DeleteInteractionTool,
    SetRelationshipSummaryTool,
]
