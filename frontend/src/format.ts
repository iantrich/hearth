// Calendar days are "YYYY-MM-DD" strings. They are formatted as UTC midnights with a UTC
// formatter, so the browser's own time zone can never shift the day shown.
// Ages and day counts come from the snapshot; nothing here does date math.

function asUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const monthDayYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

// "Oct 14"
export const formatMonthDay = (day: string) => monthDay.format(asUtc(day));
// "Oct 14, 2026"
export const formatMonthDayYear = (day: string) => monthDayYear.format(asUtc(day));
// "October 14, 2026"
export const formatLongDate = (day: string) => longDate.format(asUtc(day));

// "Oct 7" for a birthday with an unknown year, otherwise "Oct 7, 1987 - 39", as the iOS person
// screen shows it. `age` is the snapshot's; without one the age is left off.
export function birthLine(birthday: string, birthYearUnknown: boolean, age: number | null): string {
  if (birthYearUnknown) return formatMonthDay(birthday);
  const line = `${formatMonthDay(birthday)}, ${birthday.slice(0, 4)}`;
  return age === null ? line : `${line} - ${age}`;
}

// "In 3 days", "In 1 day", "Today".
export function untilLabel(days: number): string {
  if (days === 0) return "Today";
  return `In ${days} ${days === 1 ? "day" : "days"}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
