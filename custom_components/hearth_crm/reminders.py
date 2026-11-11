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


def _utc(moment: datetime) -> datetime:
    """Normalise to UTC: aware datetimes sharing a tzinfo compare by wall clock and ignore fold."""
    return moment.astimezone(UTC)


def _latest_k(
    anchor: datetime, every: int, unit: ReminderUnit, moment: datetime, tz: tzinfo
) -> int:
    """Largest k with occurrence(k) <= moment, or -1 if moment precedes the anchor."""
    instant = _utc(moment)
    if instant < _utc(anchor):
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
    while k > 0 and _utc(occurrence(anchor, every, unit, k, tz)) > instant:
        k -= 1
    while _utc(occurrence(anchor, every, unit, k + 1, tz)) <= instant:
        k += 1
    return k


def next_after(reminder: Reminder, moment: datetime, tz: tzinfo) -> datetime | None:
    """First scheduled instant strictly after moment; None for a one-time reminder."""
    if not _repeats(reminder):
        return None
    anchor, every, unit = reminder.anchor_at, reminder.repeat_every, reminder.repeat_unit
    k = _latest_k(anchor, every, unit, moment, tz) + 1
    return occurrence(anchor, every, unit, k, tz)


def due_occurrence(reminder: Reminder, now: datetime, tz: tzinfo) -> datetime | None:
    """The scheduled instant that should notify now, if any."""
    due = reminder.due_at
    if reminder.done_at is not None or due is None or _utc(now) < _utc(due):
        return None
    if _repeats(reminder):
        anchor, every, unit = (
            reminder.anchor_at,
            reminder.repeat_every,
            reminder.repeat_unit,
        )
        k = _latest_k(anchor, every, unit, now, tz)
        if k < 0:
            return None
        candidate = occurrence(anchor, every, unit, k, tz)
        if _utc(candidate) < _utc(due):
            return None
    else:
        candidate = due
    notified = reminder.notified_for
    if notified is not None and _utc(candidate) <= _utc(notified):
        return None
    return candidate


def completed(reminder: Reminder, now: datetime, tz: tzinfo) -> Reminder:
    """Mark done: one-time gets done_at; repeating moves to its next future date."""
    if _repeats(reminder) and reminder.due_at is not None:
        return dataclasses.replace(
            reminder, due_at=next_after(
                reminder,
                now if _utc(now) >= _utc(reminder.due_at) else reminder.due_at,
                tz,
            ),
        )
    return dataclasses.replace(reminder, done_at=now)


def reminder_state(reminder: Reminder, today: date, tz: tzinfo) -> ReminderState:
    """Where the reminder sits relative to today's local date."""
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
