import type { Person, Relationship } from "../types";
import { olderFirst } from "./ageOrder";

// Orders a household's members by generation: parents, then anyone the relationship data
// can't place, then children, each tier oldest to youngest.
//
// Groups deliberately do NOT use this: a large group has no family structure, so the member
// roster's alphabetical order stays.

const Tier = { parent: 0, unplaced: 1, child: 2 } as const;
type Tier = (typeof Tier)[keyof typeof Tier];

function tiers(memberIds: string[], relationships: Relationship[]): Map<string, Tier> {
  const members = new Set(memberIds);
  const parents = new Set<string>();
  const children = new Set<string>();

  const place = (id: string, role: string) => {
    if (role === "Parent") parents.add(id);
    else if (role === "Child") children.add(id);
  };

  for (const link of relationships) {
    // Only links whose BOTH ends are inside this household say anything about its structure.
    if (!members.has(link.person_a_id) || !members.has(link.person_b_id)) continue;
    // Person B is `type` of person A, and person A is `inverse_type` of person B (from Python).
    place(link.person_b_id, link.type);
    place(link.person_a_id, link.inverse_type);
  }

  const result = new Map<string, Tier>();
  for (const id of memberIds) {
    // Parent wins the tie: in a three-generation household the middle person is both, and
    // they belong with the adults.
    if (parents.has(id)) result.set(id, Tier.parent);
    else if (children.has(id)) result.set(id, Tier.child);
    else result.set(id, Tier.unplaced);
  }
  return result;
}

// Sorts any row type that carries a Person. `memberIds` is the household's FULL membership,
// which is not always what is being sorted: the person screen hides the subject, and dropping
// them from the membership would erase the very links that tier everyone else.
export function sortHousehold<T>(
  items: readonly T[],
  memberIds: string[],
  relationships: Relationship[],
  personOf: (item: T) => Person,
): T[] {
  const tierById = tiers(memberIds, relationships);
  return [...items].sort((a, b) => {
    const left = personOf(a);
    const right = personOf(b);
    const leftTier = tierById.get(left.id) ?? Tier.unplaced;
    const rightTier = tierById.get(right.id) ?? Tier.unplaced;
    if (leftTier !== rightTier) return leftTier - rightTier;
    return olderFirst(left, right);
  });
}
