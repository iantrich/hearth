import type { Household, Person } from "../types";

// Finder-style name order, like Swift's localizedStandardCompare: case-insensitive and
// numeric-aware ("Item 2" before "Item 10").
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

export function byName(a: Person, b: Person): number {
  return compareNames(a.name, b.name);
}

// The leading word of a name; empty for a blank name.
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** False when Python could not name the household ("needs_name") or says it isn't one. */
export function householdIsNamed(household: Household): boolean {
  return household.name_status !== "needs_name" && household.name_status !== "not_a_household" && !!household.name;
}

/** The household's name from the snapshot, or what to show in its place. */
export function householdTitle(household: Household): string {
  if (householdIsNamed(household)) return household.name as string;
  return household.name_status === "not_a_household" ? "Not a household" : "Needs a name";
}

/**
 * The household's title for choosing it from a list. Households without a usable name all read
 * "Needs a name" or "Not a household", so their members' first names follow Python's label:
 * "Needs a name (Sam, Riley)". The label itself is never replaced.
 */
export function householdChoiceLabel(household: Household, people: readonly Person[]): string {
  const title = householdTitle(household);
  if (householdIsNamed(household)) return title;
  const names = household.member_ids
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => !!p)
    .map((p) => firstName(p.name))
    .filter(Boolean);
  return names.length ? `${title} (${names.join(", ")})` : title;
}
