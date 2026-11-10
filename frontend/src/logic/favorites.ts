import type { Person } from "../types";

// Two rows of three.
export const MAX_FAVORITES = 6;

// Source order is kept deliberately: sorting by name would scramble an order the owner chose.
export function favorites(people: Person[]): Person[] {
  return people.filter((p) => p.favorite && !p.hide_from_list).slice(0, MAX_FAVORITES);
}
