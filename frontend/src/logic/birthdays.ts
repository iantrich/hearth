import type { Person } from "../types";
import { compareNames } from "./names";

// The single source for both Home's short list and the full birthdays list, so "See all" is a
// superset of Home's list. `days_until_birthday` is the snapshot's
// (Python's); there is no date math here.
export function upcomingBirthdays(people: Person[], limitDays?: number): Person[] {
  return people
    .filter(
      (p) =>
        p.days_until_birthday !== null &&
        (limitDays === undefined || p.days_until_birthday <= limitDays),
    )
    .sort((a, b) => (a.days_until_birthday as number) - (b.days_until_birthday as number) || compareNames(a.name, b.name));
}
