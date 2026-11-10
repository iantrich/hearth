import type { Person } from "../types";
import { compareNames } from "./names";

// Shared by the household roster and the connections list so the two can't drift: within any
// group of people, oldest first.

// A birthday with an unknown year carries a placeholder year, so it can only answer "when in
// the year", never "how old". It counts as no age at all rather than as someone born in year 1.
export function ageSortDay(person: Person): string | null {
  return person.birthday && !person.birth_year_unknown ? person.birthday : null;
}

// Oldest first. Anyone without a usable birth year falls to the end of their group, ordered by
// name. Few people carry a birth year, so that fallback is the common path, not the edge.
export function olderFirst(a: Person, b: Person): number {
  const left = ageSortDay(a);
  const right = ageSortDay(b);
  if (left && right && left !== right) return left < right ? -1 : 1;
  if (left && !right) return -1;
  if (!left && right) return 1;
  return compareNames(a.name, b.name);
}
