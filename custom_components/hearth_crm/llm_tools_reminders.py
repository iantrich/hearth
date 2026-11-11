"""Claude's tools for reminders: set one about a person, list, finish and delete them.

Writes go through the service with source ``"claude"`` and then send the change notice. Results
echo the reminder row from the snapshot (its state and local due date and time) with a brief of
the person it is about.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import probatio

from .const import TOOL_PREFIX
from .enums import ReminderUnit
from .llm_base import (
    ID_RULE,
    READ_ONLY,
    STORED_DATA_RULE,
    WRITE_ADDITIVE,
    WRITE_DESTRUCTIVE,
    WRITE_UPDATE,
    HearthTool,
    ToolCRM,
    ToolError,
    find_record,
    limit_param,
)
from .llm_logic import person_brief

_UNITS = [u.value for u in ReminderUnit]
_DEFAULT_TIME = "08:00"


def _echo(snapshot: dict, row: dict) -> dict:
    """The reminder row with a brief of its person."""
    person = next((p for p in snapshot["people"] if p["id"] == row["person_id"]), None)
    return {
        "reminder": row,
        "person": person_brief(snapshot, person) if person is not None else None,
    }


def _due_at(due: str | None) -> str | None:
    """The naive local ``YYYY-MM-DDTHH:MM`` the service reads in Home Assistant's zone."""
    if not due:
        return None
    text = due if "T" in due else f"{due}T{_DEFAULT_TIME}"
    try:
        return datetime.strptime(text, "%Y-%m-%dT%H:%M").strftime("%Y-%m-%dT%H:%M")
    except ValueError:
        raise ToolError(
            'due: use "YYYY-MM-DD" (08:00 that day) or "YYYY-MM-DDTHH:MM" (local time), '
            "or leave it out for Someday. Nothing was changed."
        ) from None


def _no_person_message(me_person_id: str | None) -> str:
    message = (
        "A reminder needs a person: ask the user who it is about, then pass that person's id as "
        "person_id."
    )
    if me_person_id:
        message += (
            f' If the user says it is for themselves, the "This is me" person is id '
            f"{me_person_id}."
        )
    return message + " Nothing was changed."


class CreateReminderTool(HearthTool):
    name = f"{TOOL_PREFIX}create_reminder"
    title = "Create a reminder"
    description = (
        "Remind the user about a person, e.g. 'follow up with Tyler in two weeks'. A reminder "
        "needs a person: if the user did not name one, ask who it is about before calling "
        "(the user's own person is allowed only when they say so). A reminder is not an "
        "interaction; use hearth_crm__log_interaction for something that happened. Set due for a date, or "
        "leave it out for a Someday reminder with no date. Repeats (repeat_every with "
        "repeat_unit, and a due date) run until the reminder is deleted: marking one done moves "
        "it to its next date. Work out dates from today's date given above. The result gives the "
        "reminder's state, due_date and due_time, and the person. " + ID_RULE + " "
        + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Optional(
                "person_id",
                description="Id of the person the reminder is about (required), from search or get results.",
            ): str,
            probatio.Optional(
                "note", description="What to remember or do, e.g. 'Ask how the move went'."
            ): str,
            probatio.Optional(
                "due",
                description=(
                    'When it is due: "YYYY-MM-DD" means 08:00 that day, "YYYY-MM-DDTHH:MM" is that '
                    "local time. Leave it out for Someday (no date)."
                ),
            ): str,
            probatio.Optional(
                "repeat_every",
                description="Repeat every this many units (1-999). Needs repeat_unit and due.",
            ): probatio.All(int, probatio.Range(min=1, max=999)),
            probatio.Optional(
                "repeat_unit",
                description=f"The repeat unit: one of {', '.join(_UNITS)}. Needs repeat_every and due.",
            ): probatio.In(_UNITS),
            probatio.Optional(
                "interaction_id",
                description="Id of the interaction this follows up on, if any.",
            ): str,
        }
    )
    annotations = WRITE_ADDITIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        if not args.get("person_id"):
            raise ToolError(_no_person_message(crm.me_person_id))
        if ("repeat_every" in args) != ("repeat_unit" in args):
            raise ToolError(
                "repeat_every and repeat_unit go together: pass both or neither. "
                "Nothing was changed."
            )
        due = _due_at(args.get("due"))
        if "repeat_every" in args and due is None:
            raise ToolError("A repeat needs a due date: pass due too. Nothing was changed.")
        fields: dict[str, Any] = {
            "person_id": args["person_id"],
            "note": (args.get("note") or "").strip() or None,
            "due_at": due,
        }
        if "repeat_every" in args:
            fields["repeat_every"] = args["repeat_every"]
            fields["repeat_unit"] = args["repeat_unit"]
        if args.get("interaction_id"):
            fields["interaction_id"] = args["interaction_id"]
        saved = await crm.run(lambda s: s.create("reminder", fields, "claude"))
        crm.notify("reminder", saved["id"], "create")
        row = await crm.run(lambda s: s.reminder_row(saved["id"]))
        return _echo(await crm.snapshot(), row)


class ListRemindersTool(HearthTool):
    name = f"{TOOL_PREFIX}list_reminders"
    title = "List reminders"
    description = (
        "List the user's reminders, open ones first by due time (Someday last). Done ones are "
        "left out unless include_done is true. Each has its state (overdue, due_today, upcoming, "
        "someday, done), due_date, due_time and the person. " + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {
            probatio.Optional(
                "person_id", description="Only this person's reminders, from search or get results."
            ): str,
            probatio.Optional(
                "include_done", default=False, description="Also list done reminders. Default false."
            ): bool,
            **limit_param("How many reminders to return at most (1-100, default 25)."),
        }
    )
    annotations = READ_ONLY

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        snapshot = await crm.snapshot()
        rows = [
            r
            for r in snapshot["reminders"]
            if (args["include_done"] or r["state"] != "done")
            and (not args.get("person_id") or r["person_id"] == args["person_id"])
        ]
        return {
            "reminders": [
                {**r, "person": _echo(snapshot, r)["person"]} for r in rows[: args["limit"]]
            ],
            "truncated": len(rows) > args["limit"],
        }


class CompleteReminderTool(HearthTool):
    name = f"{TOOL_PREFIX}complete_reminder"
    title = "Mark a reminder done"
    description = (
        "Mark a reminder done. A one-time reminder is finished; a repeating one moves to its "
        "next scheduled date and stays open. The result gives the reminder's new state and due "
        "date. " + ID_RULE + " " + STORED_DATA_RULE
    )
    parameters = probatio.Schema(
        {probatio.Required("reminder_id", description="The reminder's id, from list_reminders."): str}
    )
    annotations = WRITE_UPDATE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        reminder_id = args["reminder_id"]
        await crm.run(lambda s: s.complete_reminder(reminder_id, "claude"))
        crm.notify("reminder", reminder_id, "update")
        row = await crm.run(lambda s: s.reminder_row(reminder_id))
        return _echo(await crm.snapshot(), row)


class DeleteReminderTool(HearthTool):
    name = f"{TOOL_PREFIX}delete_reminder"
    title = "Delete a reminder"
    description = (
        "Permanently delete one reminder, repeating ones included (a repeat runs until it is "
        "deleted). Confirm with the user first, saying which reminder (person, note and due "
        "date). The result echoes what was removed. " + ID_RULE
    )
    parameters = probatio.Schema(
        {probatio.Required("reminder_id", description="The reminder's id, from list_reminders."): str}
    )
    annotations = WRITE_DESTRUCTIVE

    async def _run(self, crm: ToolCRM, args: dict[str, Any]) -> dict:
        reminder_id = args["reminder_id"]
        snapshot = await crm.snapshot()
        removed = _echo(snapshot, find_record(snapshot, "reminders", "reminder", reminder_id))
        await crm.run(lambda s: s.delete("reminder", reminder_id, "claude"))
        crm.notify("reminder", reminder_id, "delete")
        return {"deleted": removed}


REMINDER_TOOLS: list[type[HearthTool]] = [
    CreateReminderTool,
    ListRemindersTool,
    CompleteReminderTool,
    DeleteReminderTool,
]
