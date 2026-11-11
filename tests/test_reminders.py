"""Tests for the pure reminder schedule maths."""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from custom_components.hearth_crm.enums import ReminderUnit
from custom_components.hearth_crm.models import Reminder
from custom_components.hearth_crm.reminders import (
    completed,
    due_occurrence,
    localize,
    next_after,
    occurrence,
    reminder_state,
)

TZ = ZoneInfo("America/Chicago")
STAMP = datetime(2026, 1, 1, tzinfo=timezone.utc)


def local(y, m, d, hh=8, mm=0):
    return datetime(y, m, d, hh, mm, tzinfo=TZ)


def make(**kw) -> Reminder:
    base = dict(
        id="r1", person_id="p1", created_at=STAMP, updated_at=STAMP, note="Call Alex Example"
    )
    base.update(kw)
    return Reminder(**base)


def repeating(due, anchor=None, **kw) -> Reminder:
    return make(
        due_at=due,
        anchor_at=anchor or due,
        repeat_every=2,
        repeat_unit=ReminderUnit.WEEK,
        **kw,
    )


def test_occurrence_keeps_the_local_clock_time_across_daylight_saving():
    anchor = local(2026, 11, 1)
    got = occurrence(anchor, 1, ReminderUnit.WEEK, 2, TZ)
    assert got == local(2026, 11, 15)
    assert got.astimezone(TZ).hour == 8
    # Daily across the March 2027 spring-forward stays at 08:00 local.
    daily = local(2027, 3, 10)
    after = occurrence(daily, 1, ReminderUnit.DAY, 5, TZ)
    assert after == local(2027, 3, 15)
    assert after.astimezone(TZ).hour == 8
    assert after.utcoffset() != daily.utcoffset()


def test_month_steps_count_from_the_anchor_and_clamp():
    anchor = local(2026, 1, 31)
    assert occurrence(anchor, 1, ReminderUnit.MONTH, 1, TZ) == local(2026, 2, 28)
    assert occurrence(anchor, 1, ReminderUnit.MONTH, 2, TZ) == local(2026, 3, 31)
    assert occurrence(anchor, 1, ReminderUnit.MONTH, 3, TZ) == local(2026, 4, 30)
    leap = local(2028, 2, 29)
    assert occurrence(leap, 1, ReminderUnit.YEAR, 1, TZ) == local(2029, 2, 28)


def test_localize_moves_a_gap_time_forward():
    assert localize(datetime(2027, 3, 14, 2, 30), TZ) == local(2027, 3, 14, 3, 30)
    repeated = localize(datetime(2026, 11, 1, 1, 30), TZ)
    assert repeated.utcoffset() == timedelta(hours=-5)  # the first 01:30 (CDT)
    assert repeated.astimezone(timezone.utc) == datetime(
        2026, 11, 1, 6, 30, tzinfo=timezone.utc
    )


def test_next_after_is_the_first_scheduled_date_strictly_after():
    r = repeating(local(2026, 11, 10))
    assert next_after(r, local(2026, 11, 10), TZ) == local(2026, 11, 24)
    assert next_after(r, local(2026, 11, 24, 7, 59), TZ) == local(2026, 11, 24)
    assert next_after(r, local(2026, 11, 24), TZ) == local(2026, 12, 8)
    assert next_after(r, local(2026, 11, 1), TZ) == local(2026, 11, 10)
    assert next_after(make(due_at=local(2026, 11, 10)), local(2026, 11, 1), TZ) is None


def test_due_occurrence_for_a_one_time_reminder():
    due = local(2026, 12, 1)
    r = make(due_at=due)
    assert due_occurrence(r, local(2026, 12, 1, 7, 59), TZ) is None
    assert due_occurrence(r, due, TZ) == due
    assert due_occurrence(r, local(2026, 12, 5), TZ) == due
    assert due_occurrence(replace(r, notified_for=due), local(2026, 12, 5), TZ) is None
    assert due_occurrence(replace(r, done_at=due), local(2026, 12, 5), TZ) is None
    assert due_occurrence(make(due_at=None), local(2026, 12, 5), TZ) is None


def test_due_occurrence_for_a_repeating_reminder_fires_each_scheduled_date_until_done():
    first = local(2026, 11, 10)
    r = repeating(first)
    assert due_occurrence(r, local(2026, 11, 10), TZ) == first
    notified = replace(r, notified_for=first)
    assert due_occurrence(notified, local(2026, 11, 20), TZ) is None
    assert due_occurrence(notified, local(2026, 11, 24), TZ) == local(2026, 11, 24)
    late = replace(r, notified_for=local(2026, 11, 24))
    assert due_occurrence(late, local(2026, 12, 20), TZ) == local(2026, 12, 8)
    caught_up = replace(r, notified_for=local(2026, 12, 8))
    assert due_occurrence(caught_up, local(2026, 12, 20), TZ) is None


def test_done_before_the_due_date_does_not_fire_that_occurrence():
    r = repeating(local(2026, 11, 24), anchor=local(2026, 11, 10))
    done = completed(r, local(2026, 11, 20), TZ)
    assert done.due_at == local(2026, 12, 8)
    assert due_occurrence(done, local(2026, 11, 24), TZ) is None


def test_completed_one_time_sets_done_at_and_repeating_moves_to_the_next_future_date():
    now = local(2026, 12, 20, 9)
    one = make(due_at=local(2026, 12, 1))
    done = completed(one, now, TZ)
    assert done.done_at == now
    assert done.due_at == one.due_at

    r = repeating(local(2026, 11, 10), notified_for=local(2026, 11, 24))
    moved = completed(r, now, TZ)
    assert moved.due_at == local(2026, 12, 22)
    assert moved.done_at is None
    assert moved.anchor_at == r.anchor_at
    assert moved.notified_for == r.notified_for


def test_reminder_state():
    today = date(2026, 11, 10)
    assert reminder_state(make(due_at=local(2026, 11, 1), done_at=STAMP), today, TZ) == "done"
    assert reminder_state(make(due_at=None), today, TZ) == "someday"
    assert reminder_state(make(due_at=local(2026, 11, 9, 23, 59)), today, TZ) == "overdue"
    assert reminder_state(make(due_at=local(2026, 11, 10, 0, 1)), today, TZ) == "due_today"
    assert reminder_state(make(due_at=local(2026, 11, 10, 23, 59)), today, TZ) == "due_today"
    assert reminder_state(make(due_at=local(2026, 11, 11, 0, 1)), today, TZ) == "upcoming"


def test_comparisons_ignore_how_now_is_represented_in_the_repeated_hour():
    # Weekly from 2026-10-25 01:30 Chicago, already notified for that date.
    first = local(2026, 10, 25, 1, 30)
    r = replace(
        make(due_at=first, anchor_at=first, repeat_every=1, repeat_unit=ReminderUnit.WEEK),
        notified_for=first,
    )
    # 07:10 UTC is 02:10 CST, 40 minutes after the first (CDT) 01:30 on 11-01.
    now_utc = datetime(2026, 11, 1, 7, 10, tzinfo=timezone.utc)
    now_local = now_utc.astimezone(TZ)
    want = datetime(2026, 11, 1, 6, 30, tzinfo=timezone.utc)
    assert due_occurrence(r, now_utc, TZ).astimezone(timezone.utc) == want
    assert due_occurrence(r, now_local, TZ).astimezone(timezone.utc) == want
    # The second 01:30 (CST, fold=1) is 07:30 UTC: not yet due before that.
    early = datetime(2026, 11, 1, 1, 30, fold=1, tzinfo=TZ)
    one_time = make(due_at=early)
    before = datetime(2026, 11, 1, 6, 45, tzinfo=timezone.utc)
    assert due_occurrence(one_time, before, TZ) is None
    assert due_occurrence(one_time, before.astimezone(TZ), TZ) is None
