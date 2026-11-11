// Reminder helpers. Dates are plain calendar arithmetic on the snapshot's "YYYY-MM-DD" (today in
// Home Assistant's zone); the panel never works with time zones. What it sends is a naive local
// "YYYY-MM-DDTHH:MM", which the server reads in Home Assistant's zone.
import type { Reminder } from "../types";

export type QuickPick = "tomorrow" | "next_week" | "month" | "quarter" | "year" | "someday";

const DEFAULT_TIME = "08:00";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function format(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = parts(date);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return format(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

/** Adds calendar months, keeping the day unless the month is shorter (then its last day). */
function addMonths(date: string, months: number): string {
  const [y, m, d] = parts(date);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return format(year, month, Math.min(d, lastDay));
}

/** The quick pick's due time as a naive local "YYYY-MM-DDT08:00"; null for Someday. */
export function quickPickDue(pick: QuickPick, today: string): string | null {
  let date: string;
  switch (pick) {
    case "someday":
      return null;
    case "tomorrow":
      date = addDays(today, 1);
      break;
    case "next_week": {
      const [y, m, d] = parts(today);
      const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
      date = addDays(today, ((8 - weekday) % 7) || 7); // the Monday strictly after today
      break;
    }
    case "month":
      date = addMonths(today, 1);
      break;
    case "quarter":
      date = addMonths(today, 3);
      break;
    case "year":
      date = addMonths(today, 12);
      break;
  }
  return `${date}T${DEFAULT_TIME}`;
}

export function repeatLabel(every: number, unit: string): string {
  return every === 1 ? `Every ${unit}` : `Every ${every} ${unit}s`;
}

function shortDate(date: string): string {
  const [, m, d] = parts(date);
  return `${MONTHS[m - 1]} ${d}`;
}

function clock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Overdue · Nov 10", "Today 8:00 AM", "Dec 8" or "Someday", from the server's state and due date. */
export function dueLabel(r: Reminder, today: string): string {
  if (!r.due_date) return "Someday";
  if (r.state === "overdue") return `Overdue · ${shortDate(r.due_date)}`;
  if (r.state === "due_today" || r.due_date === today) return r.due_time ? `Today ${clock(r.due_time)}` : "Today";
  return shortDate(r.due_date);
}

/** Open reminders in their groups. The snapshot already orders them by due time, which is kept. */
export function splitReminders(reminders: Reminder[]): { due: Reminder[]; upcoming: Reminder[]; someday: Reminder[] } {
  const open = reminders.filter((r) => r.state !== "done");
  const key = (r: Reminder) => `${r.due_date ?? ""}T${r.due_time ?? ""}`; // Home Assistant's zone, so they compare as text
  const byDue = (a: Reminder, b: Reminder) => key(a).localeCompare(key(b));
  return {
    due: open.filter((r) => r.state === "overdue" || r.state === "due_today").sort(byDue),
    upcoming: open.filter((r) => r.state === "upcoming").sort(byDue),
    someday: open.filter((r) => r.state === "someday"),
  };
}
