"""Pure schedule maths for reminders (no Home Assistant imports).

Repeat dates are counted from the anchor (the first due date), in local
wall-clock time, so they never drift and keep their clock time across
daylight saving.
"""

from __future__ import annotations

import calendar
import dataclasses
from datetime import UTC, date, datetime, timedelta, tzinfo
from typing import Literal

from .enums import ReminderUnit
from .models import Reminder

ReminderState = Literal["done", "someday", "overdue", "due_today", "upcoming"]


def localize(naive: datetime, tz: tzinfo) -> datetime:
    """Attach tz to a naive local time; a gap time moves forward, a repeated hour takes the first."""
    return naive.replace(tzinfo=tz).astimezone(UTC).astimezone(tz)


def _add_months(day: date, months: int) -> date:
    index = day.year * 12 + (day.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    return day.replace(
        year=year, month=month, day=min(day.day, calendar.monthrange(year, month)[1])
    )


def occurrence(
    anchor: datetime, every: int, unit: ReminderUnit, k: int, tz: tzinfo
) -> datetime:
    """The k-th scheduled instant (k=0 is the anchor)."""
    start = anchor.astimezone(tz)
    steps = every * k
    if unit is ReminderUnit.DAY:
        day = start.date() + timedelta(days=steps)
    elif unit is ReminderUnit.WEEK:
        day = start.date() + timedelta(weeks=steps)
    elif unit is ReminderUnit.MONTH:
        day = _add_months(start.date(), steps)
    else:
        day = _add_months(start.date(), steps * 12)
    return localize(datetime.combine(day, start.time()), tz)


def _repeats(reminder: Reminder) -> bool:
    return bool(
        reminder.repeat_every and reminder.repeat_unit and reminder.anchor_at
    )


def _latest_k(reminder: Reminder, moment: datetime, tz: tzinfo) -> int:
    """Largest k with occurrence(k) <= moment, or -1 if moment precedes the anchor."""
    anchor = reminder.anchor_at
    every = reminder.repeat_every
    unit = reminder.repeat_unit
    assert anchor is not None and every is not None and unit is not None
    if moment < anchor:
        return -1
    first = anchor.astimezone(tz).date()
    last = moment.astimezone(tz).date()
    if unit is ReminderUnit.DAY:
        estimate = (last - first).days // every
    elif unit is ReminderUnit.WEEK:
        estimate = (last - first).days // (7 * every)
    else:
        months = (last.year - first.year) * 12 + last.month - first.month
        estimate = months // (every * (12 if unit is ReminderUnit.YEAR else 1))
    k = max(estimate, 0)
    while k > 0 and occurrence(anchor, every, unit, k, tz) > moment:
        k -= 1
    while occurrence(anchor, every, unit, k + 1, tz) <= moment:
        k += 1
    return k


def next_after(reminder: Reminder, moment: datetime, tz: tzinfo) -> datetime | None:
    """First scheduled instant strictly after moment; None for a one-time reminder."""
    if not _repeats(reminder):
        return None
    k = _latest_k(reminder, moment, tz) + 1
    return occurrence(
        reminder.anchor_at, reminder.repeat_every, reminder.repeat_unit, k, tz
    )


def due_occurrence(reminder: Reminder, now: datetime, tz: tzinfo) -> datetime | None:
    """The scheduled instant that should notify now, if any."""
    due = reminder.due_at
    if reminder.done_at is not None or due is None or now < due:
        return None
    if _repeats(reminder):
        k = _latest_k(reminder, now, tz)
        if k < 0:
            return None
        candidate = occurrence(
            reminder.anchor_at, reminder.repeat_every, reminder.repeat_unit, k, tz
        )
        if candidate < due:
            return None
    else:
        candidate = due
    if reminder.notified_for is not None and candidate <= reminder.notified_for:
        return None
    return candidate


def completed(reminder: Reminder, now: datetime, tz: tzinfo) -> Reminder:
    """Mark done: one-time gets done_at; repeating moves to its next future date."""
    if _repeats(reminder) and reminder.due_at is not None:
        return dataclasses.replace(
            reminder, due_at=next_after(reminder, max(now, reminder.due_at), tz)
        )
    return dataclasses.replace(reminder, done_at=now)


def reminder_state(reminder: Reminder, today: date, tz: tzinfo) -> ReminderState:
    if reminder.done_at is not None:
        return "done"
    if reminder.due_at is None:
        return "someday"
    due_day = reminder.due_at.astimezone(tz).date()
    if due_day < today:
        return "overdue"
    if due_day == today:
        return "due_today"
    return "upcoming"
