import type { Interaction, Person } from "../types";
import type { CalendarDay } from "./calendarDay";
import { firstName } from "./names";

// What Home's Recent list and the full Interactions list both show; they differ only in their
// date window and cap.
//
// Newest first, capped at `limit`. An interaction is dropped when none of its people can be
// shown: either the snapshot doesn't know them, or every one of them is hidden. One visible
// person is enough to keep it, because hiding someone keeps them out of lists; it doesn't
// erase shared history.
export function visibleInteractions(
  interactions: Interaction[],
  people: Person[],
  options: { since?: CalendarDay; limit: number },
): Interaction[] {
  const shownIds = new Set(people.filter((p) => !p.hide_from_list).map((p) => p.id));
  const { since } = options;
  return interactions
    .filter((i) => (since === undefined || i.date >= since) && i.person_ids.some((id) => shownIds.has(id)))
    .sort(newestFirst)
    .slice(0, options.limit);
}

/** Everything logged with one person, newest first: their screen's timeline. */
export function interactionsFor(interactions: Interaction[], personId: string): Interaction[] {
  return interactions.filter((i) => i.person_ids.includes(personId)).sort(newestFirst);
}

function newestFirst(a: Interaction, b: Interaction): number {
  return a.date === b.date ? 0 : a.date > b.date ? -1 : 1;
}

// The interaction's people in their stored order, skipping ids the snapshot doesn't know.
// Order decides which name a row leads with.
export function interactionPeople(interaction: Interaction, people: Person[]): Person[] {
  const byId = new Map<string, Person>();
  for (const person of people) if (!byId.has(person.id)) byId.set(person.id, person);
  return interaction.person_ids.flatMap((id) => {
    const person = byId.get(id);
    return person ? [person] : [];
  });
}

// How a row names an interaction's people. One person keeps their full name. Two collapse to
// first names so both fit on one line. Three or more lead with a name and count the rest.
export function interactionPeopleSummary(people: Person[]): string {
  const short = (person: Person) => firstName(person.name) || person.name;
  const [first, second] = people;
  if (!first) return "";
  if (!second) return first.name;
  if (people.length === 2) return `${short(first)} & ${short(second)}`;
  return `${short(first)} and ${people.length - 1} others`;
}
