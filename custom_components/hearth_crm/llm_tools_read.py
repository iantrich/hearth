"""Claude's read tools: search, look up and list the caller's own CRM.

Every tool reads one ``crm.snapshot()`` and shapes it with ``llm_logic``, so derived values
(household names, relationship labels, contact urgency, age, days until a birthday) always
come from Python and never from the model. Results are plain JSON-ready dicts.
"""

from __future__ import annotations

from typing import Any

import probatio

from .const import TOOL_PREFIX
from .llm_base import (
    HIDDEN_PERSON_FIELDS,
    ID_RULE,
    READ_ONLY,
    STORED_DATA_RULE,
    HearthTool,
    ToolCRM,
    ToolError,
    find_record,
    limit_param,
)
from .llm_logic import (
    connection_type,
    list_groups,
    person_brief,
    person_briefs,
    reach_out,
    search_people,
    upcoming,
)

ME = "me"
DEFAULT_WITHIN_DAYS = 30
MAX_WITHIN_DAYS = 366
DEFAULT_INTERACTIONS = 5
MAX_INTERACTIONS = 25

def _attendees(snapshot: dict, person_ids: list[str]) -> list[dict]:
    """Light ``{id, name}`` entries, so a big gathering cannot flood a result. Sorted by name."""
    by_id = {p["id"]: p for p in snapshot["people"]}
    people = sorted(
        (by_id[i] for i in set(person_ids) if i in by_id),
        key=lambda p: (p["name"].casefold(), p["id"]),
    )
    return [{"id": p["id"], "name": p["name"]} for p in people]


def _person_id(crm: ToolCRM, person_id: str) -> str:
    if person_id != ME:
        return person_id
    if not crm.me_person_id:
        raise ToolError(
            'The user has no "me" person set in Hearth, so "me" cannot be looked up. '
            "Ask who they are, or have them set it in the Hearth panel."
        )
    return crm.me_person_id


class SearchPeopleTool(HearthTool):
    name = f"{TOOL_PREFIX}search_people"
    title = "Search people"
    description = (
        "Search the user's Hearth people by name. "
        "An empty query matches everyone, so results are capped by limit and the result says "
        "when it was truncated: narrow the search instead of paging. 'connected' lists people "
        "related to a name match, with the reason. Search before assuming anyone is new, and "
        "use the returned ids in other tools. " + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Optional(
                "query", default="", description="Part of a person's name. Accents and case are ignored."
            ): str,
            probatio.Optional(
                "how_i_know_them",
                description="Keep only people whose 'how I know them' text contains this.",
            ): str,
            probatio.Optional(
                "group", description="Keep only members of groups whose name contains this."
            ): str,
            probatio.Optional(
                "household", description="Keep only people whose household name contains this."
            ): str,
            **limit_param("How many people to return at most (1-100, default 25)."),
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        return search_people(
            await crm.snapshot(),
            query=args["query"],
            how_i_know_them=args.get("how_i_know_them"),
            group=args.get("group"),
            household=args.get("household"),
            limit=args["limit"],
        )


class GetPersonTool(HearthTool):
    name = f"{TOOL_PREFIX}get_person"
    title = "Get a person"
    description = (
        "Everything Hearth holds about one person: details, household and its members, "
        "relationships (each says what the other person is to this one), groups, and recent "
        "interactions. Before the user meets someone, call this and give a short brief: how "
        "they know the person, their family, the relationship summary and the last few "
        "interactions (attendees as id and name only; call get_person on one for more). "
        "It returns every relationship and every household member. A high interaction_limit "
        "returns long note text, so keep it small unless the user needs more. " + ID_RULE + ' Use person_id "me" for the user themselves. ' + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "person_id",
                description=f'The person\'s id from a search or get result, or "{ME}" for the user.',
            ): str,
            probatio.Optional(
                "interaction_limit",
                default=DEFAULT_INTERACTIONS,
                description="How many recent interactions to include (1-25, default 5).",
            ): probatio.All(int, probatio.Range(min=1, max=MAX_INTERACTIONS)),
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        snapshot = await crm.snapshot()
        person = find_record(snapshot, "people", "person", _person_id(crm, args["person_id"]))
        pid = person["id"]
        result = {k: v for k, v in person.items() if k not in HIDDEN_PERSON_FIELDS}

        household = None
        row = next((h for h in snapshot["households"] if h["id"] == person["household_id"]), None)
        if row is not None:
            household = {
                "id": row["id"],
                "name": row["name"],
                "name_status": row["name_status"],
                "members": person_briefs(snapshot, row["member_ids"]),
            }
        result["household"] = household

        by_id = {p["id"]: p for p in snapshot["people"]}
        relationships = []
        for link in snapshot["relationships"]:
            end = connection_type(link, pid)
            if end is None or end[0] not in by_id:
                continue
            relationships.append(
                {
                    "relationship_id": link["id"],
                    "other": person_brief(snapshot, by_id[end[0]]),
                    "type": end[1],
                    "label": link["label"],
                    "notes": link["notes"],
                }
            )
        relationships.sort(key=lambda r: (r["other"]["name"].casefold(), r["relationship_id"]))
        result["relationships"] = relationships

        result["groups"] = [
            {"id": g["id"], "name": g["name"]}
            for g in sorted(snapshot["groups"], key=lambda g: ((g["name"] or "").casefold(), g["id"]))
            if pid in g["member_ids"]
        ]

        mine = [i for i in snapshot["interactions"] if pid in i["person_ids"]]
        mine.sort(key=lambda i: (i["date"], i["created_at"], i["id"]), reverse=True)
        result["recent_interactions"] = [
            {
                "id": i["id"],
                "date": i["date"],
                "type": i["type"],
                "summary": i["summary"],
                "notes": i["notes"],
                "people": _attendees(snapshot, i["person_ids"]),
                "people_count": len(set(i["person_ids"])),
            }
            for i in mine[: args["interaction_limit"]]
        ]
        return result


class GetHouseholdTool(HearthTool):
    name = f"{TOOL_PREFIX}get_household"
    title = "Get a household"
    description = (
        "One household: its name (derived by Hearth from its members, unless overridden), "
        "name_status, the name override, address, notes and members. " + ID_RULE + " " + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "household_id",
                description="The household's id, from a person's 'household' in get_person.",
            ): str
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        snapshot = await crm.snapshot()
        row = find_record(snapshot, "households", "household", args["household_id"])
        return {
            "id": row["id"],
            "name": row["name"],
            "name_status": row["name_status"],
            "name_override": row["name_override"],
            "address": row["address"],
            "notes": row["notes"],
            "members": person_briefs(snapshot, row["member_ids"]),
        }


class GetGroupTool(HearthTool):
    name = f"{TOOL_PREFIX}get_group"
    title = "Get a group"
    description = (
        "One group: its name, description and members. Members are capped by limit and the "
        "result says when it was truncated. " + ID_RULE + " " + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Required(
                "group_id",
                description="The group's id, from list_groups or a person's 'groups' in get_person.",
            ): str,
            **limit_param("How many members to return at most (1-100, default 25)."),
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        snapshot = await crm.snapshot()
        row = find_record(snapshot, "groups", "contact_group", args["group_id"])
        members = person_briefs(snapshot, row["member_ids"])
        return {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "members": members[: args["limit"]],
            "total": len(members),
            "returned": min(len(members), args["limit"]),
            "truncated": len(members) > args["limit"],
        }


class ListGroupsTool(HearthTool):
    name = f"{TOOL_PREFIX}list_groups"
    title = "List groups"
    description = (
        "Find the user's Hearth groups by name, including empty ones, sorted by name, with each "
        "group's description and member count. This is how to find a group's id before "
        "get_group, update_group or set_group_members. Call it before create_group so no "
        "duplicate group is made. Capped by limit; the result says when it was truncated. "
        + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Optional(
                "query",
                description="Part of a group's name. Accents and case are ignored. Leave it out "
                "to list every group.",
            ): probatio.Maybe(str),
            **limit_param("How many groups to return at most (1-100, default 25)."),
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        return list_groups(await crm.snapshot(), query=args.get("query"), limit=args["limit"])


class WhoToReachOutToTool(HearthTool):
    name = f"{TOOL_PREFIX}who_to_reach_out_to"
    title = "Who to reach out to"
    description = (
        "Who the user is overdue or due to contact, from the close-friend rotation: visible "
        "close friends only, most pressing first, split into 'overdue' and 'due_soon'. "
        "It matches what the Hearth panel shows. Each list is capped by limit, with "
        "overdue_total and due_soon_total giving the full counts."
    )
    parameters = probatio.Schema(
        {**limit_param("How many people to return at most in each list (1-100, default 25).")}
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        return reach_out(await crm.snapshot(), args["limit"])


class UpcomingBirthdaysTool(HearthTool):
    name = f"{TOOL_PREFIX}upcoming_birthdays"
    title = "Upcoming birthdays"
    description = (
        "Birthdays coming up, soonest first, with days until and the age they turn. Capped by limit."
    )
    parameters = probatio.Schema(
        {
            probatio.Optional(
                "within_days",
                default=DEFAULT_WITHIN_DAYS,
                description="Look this many days ahead (0-366, default 30).",
            ): probatio.All(int, probatio.Range(min=0, max=MAX_WITHIN_DAYS)),
            **limit_param("How many birthdays to return at most (1-100, default 25)."),
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        return upcoming(
            await crm.snapshot(),
            within_days=args["within_days"],
            limit=args["limit"],
        )


READ_TOOLS: list[type[HearthTool]] = [
    SearchPeopleTool,
    GetPersonTool,
    GetHouseholdTool,
    GetGroupTool,
    ListGroupsTool,
    WhoToReachOutToTool,
    UpcomingBirthdaysTool,
]
