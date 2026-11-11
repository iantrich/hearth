import { describe, expect, it } from "vitest";
import { dueLabel, quickPickDue, repeatLabel, splitReminders } from "../src/logic/reminders";
import { reminder } from "./fixtures";

describe("quickPickDue", () => {
  it("tomorrow is the next day at 08:00", () => {
    expect(quickPickDue("tomorrow", "2026-11-11")).toBe("2026-11-12T08:00");
    expect(quickPickDue("tomorrow", "2026-12-31")).toBe("2027-01-01T08:00");
  });

  it("next week is the coming Monday, strictly after today", () => {
    expect(quickPickDue("next_week", "2026-11-11")).toBe("2026-11-16T08:00"); // Wednesday
    expect(quickPickDue("next_week", "2026-11-16")).toBe("2026-11-23T08:00"); // Monday: 7 days later
    expect(quickPickDue("next_week", "2026-11-15")).toBe("2026-11-16T08:00"); // Sunday
  });

  it("month, quarter and year clamp to the last day of a shorter month", () => {
    expect(quickPickDue("month", "2026-11-10")).toBe("2026-12-10T08:00");
    expect(quickPickDue("month", "2026-01-31")).toBe("2026-02-28T08:00");
    expect(quickPickDue("month", "2026-12-15")).toBe("2027-01-15T08:00");
    expect(quickPickDue("quarter", "2026-11-30")).toBe("2027-02-28T08:00");
    expect(quickPickDue("quarter", "2026-01-31")).toBe("2026-04-30T08:00");
    expect(quickPickDue("year", "2028-02-29")).toBe("2029-02-28T08:00");
    expect(quickPickDue("year", "2026-11-10")).toBe("2027-11-10T08:00");
  });

  it("someday has no due time", () => {
    expect(quickPickDue("someday", "2026-11-10")).toBeNull();
  });
});

describe("labels", () => {
  it("repeatLabel", () => {
    expect(repeatLabel(2, "week")).toBe("Every 2 weeks");
    expect(repeatLabel(1, "day")).toBe("Every day");
    expect(repeatLabel(1, "year")).toBe("Every year");
  });

  it("dueLabel", () => {
    const today = "2026-11-10";
    expect(dueLabel(reminder("a", "p1", { state: "overdue", due_date: "2026-11-10", due_time: "07:00" }), today)).toBe("Overdue · Nov 10");
    expect(dueLabel(reminder("a", "p1", { state: "overdue", due_date: "2026-11-02", due_time: "08:00" }), today)).toBe("Overdue · Nov 2");
    expect(dueLabel(reminder("b", "p1", { state: "due_today", due_date: today, due_time: "08:00" }), today)).toBe("Today 8:00 AM");
    expect(dueLabel(reminder("b", "p1", { state: "due_today", due_date: today, due_time: "15:30" }), today)).toBe("Today 3:30 PM");
    expect(dueLabel(reminder("c", "p1", { state: "upcoming", due_date: "2026-12-08", due_time: "08:00" }), today)).toBe("Dec 8");
    expect(dueLabel(reminder("d", "p1", { state: "someday" }), today)).toBe("Someday");
  });
});

describe("splitReminders", () => {
  it("groups open reminders, most overdue first, and leaves out done ones", () => {
    const list = [
      reminder("up2", "p1", { state: "upcoming", due_date: "2026-12-20", due_time: "08:00" }),
      reminder("today", "p1", { state: "due_today", due_date: "2026-11-10", due_time: "08:00" }),
      reminder("some", "p1", { state: "someday" }),
      reminder("late", "p1", { state: "overdue", due_date: "2026-11-02", due_time: "08:00" }),
      reminder("done", "p1", { state: "done", done_at: "2026-11-01T10:00:00+00:00" }),
      reminder("up1", "p1", { state: "upcoming", due_date: "2026-11-20", due_time: "08:00" }),
      reminder("later", "p1", { state: "overdue", due_date: "2026-11-09", due_time: "08:00" }),
    ];
    const { due, upcoming, someday } = splitReminders(list);
    expect(due.map((r) => r.id)).toEqual(["late", "later", "today"]);
    expect(upcoming.map((r) => r.id)).toEqual(["up1", "up2"]);
    expect(someday.map((r) => r.id)).toEqual(["some"]);
  });
});
