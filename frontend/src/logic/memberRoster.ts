import type { Person } from "../types";
import { byName } from "./names";

// Resolves a household's or group's member ids into the people to show, alphabetically. An id
// can outlive the person it pointed at; unknown ids and duplicates are dropped.
export function memberRoster(ids: string[], people: Person[]): Person[] {
  const byId = new Map<string, Person>();
  for (const person of people) if (!byId.has(person.id)) byId.set(person.id, person);
  const seen = new Set<string>();
  const roster: Person[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const person = byId.get(id);
    if (person) roster.push(person);
  }
  return roster.sort(byName);
}
