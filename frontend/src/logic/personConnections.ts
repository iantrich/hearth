import type { ContactGroup, Household, Person, Relationship } from "../types";
import { sortConnections, type PersonConnection } from "./connectionOrder";
import { sortHousehold } from "./householdOrder";
import { compareNames } from "./names";

export type { PersonConnection } from "./connectionOrder";

/**
 * The other end of a relationship seen from `personId`, with what that other person is to
 * them. Person B is `type` of person A; Python supplies `inverse_type` for the other
 * direction, so nothing is inverted here. Null when `personId` isn't on the link, or for a
 * self-link.
 */
export function connectionTo(link: Relationship, personId: string): { otherId: string; type: string } | null {
  if (link.person_a_id === link.person_b_id) return null;
  if (link.person_a_id === personId) return { otherId: link.person_b_id, type: link.type };
  if (link.person_b_id === personId) return { otherId: link.person_a_id, type: link.inverse_type };
  return null;
}

// The Connections section of a person's screen: their household, everyone else they're
// related to, and the groups they belong to.
export interface PersonConnections {
  // The household itself, not just its name: the section heading links to it.
  household: Household | null;
  householdMembers: PersonConnection[];
  others: PersonConnection[];
  groups: ContactGroup[];
}

export function isEmptyConnections(connections: PersonConnections): boolean {
  return (
    connections.householdMembers.length === 0 &&
    connections.others.length === 0 &&
    connections.groups.length === 0
  );
}

export interface ConnectionsInput {
  people: Person[];
  households: Household[];
  groups: ContactGroup[];
  relationships: Relationship[];
  // The owner's own person id ("this is me"), which never appears as someone's connection.
  excludedId: string | null;
}

export function buildPersonConnections(personId: string, input: ConnectionsInput): PersonConnections {
  const { people, households, groups, relationships, excludedId } = input;
  const peopleById = new Map<string, Person>();
  for (const person of people) if (!peopleById.has(person.id)) peopleById.set(person.id, person);

  // The first relationship to a given person wins, so duplicate pairs don't repeat rows.
  const typeByPersonId = new Map<string, { type: string; relationshipId: string }>();
  const partnerIds: string[] = [];
  for (const link of relationships) {
    const end = connectionTo(link, personId);
    // Excluded by person, not by link: on the owner's own screen the subject is the excluded
    // id, and they should still see their people.
    if (!end || end.otherId === excludedId || typeByPersonId.has(end.otherId)) continue;
    typeByPersonId.set(end.otherId, { type: end.type, relationshipId: link.id });
    partnerIds.push(end.otherId);
  }

  const toConnection = (id: string): PersonConnection | null => {
    const person = peopleById.get(id);
    const link = typeByPersonId.get(id);
    return person ? { person, connectionType: link?.type ?? null, relationshipId: link?.relationshipId ?? null } : null;
  };

  const placed = new Set<string>([personId]);
  const household = households.find((h) => h.member_ids.includes(personId)) ?? null;
  const visibleMembers: PersonConnection[] = [];
  for (const id of household?.member_ids ?? []) {
    if (id === excludedId || placed.has(id)) continue;
    placed.add(id);
    const connection = toConnection(id);
    if (connection) visibleMembers.push(connection);
  }
  // Tiered against the household's FULL membership, not the filtered rows: this person and
  // any excluded one are hidden from the list but are still the links that place everybody else.
  const householdMembers = sortHousehold(visibleMembers, household?.member_ids ?? [], relationships, (row) => row.person);

  const others = sortConnections(
    partnerIds
      .filter((id) => !placed.has(id))
      .map(toConnection)
      .filter((row): row is PersonConnection => row !== null),
  );

  return {
    // Dropped when nobody is left to list under it, so the view never draws a household
    // heading over an empty group.
    household: householdMembers.length === 0 ? null : household,
    householdMembers,
    others,
    groups: groups.filter((group) => group.member_ids.includes(personId)).sort((a, b) => compareNames(a.name, b.name)),
  };
}
