// A calendar day as "YYYY-MM-DD", with no time and no time zone. Day arithmetic runs on UTC
// midnights, where every day is exactly 24 hours, so the browser's zone and DST never move a day.
// Only what the views use is ported: "today" itself comes from the snapshot.
export type CalendarDay = string;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function toUtcMs(day: CalendarDay): number {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new Error(`Not a calendar day: ${day}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDays(day: CalendarDay, count: number): CalendarDay {
  return new Date(toUtcMs(day) + count * MS_PER_DAY).toISOString().slice(0, 10);
}
