// What Store.save sends, worked out from a form's fields and the record in the snapshot.
//
// - With the form's base (what it opened with), only fields the user changed are considered, so a
//   change made elsewhere since isn't reverted.
// - A field that is `undefined` is not part of the form and is left alone.
// - Text is trimmed; blank text is null (optional fields clear; the form checks required ones).
// - Places are edited as free text (`Place.formatted`). Unchanged text leaves the stored place,
//   with its structured parts, as it is; changed text replaces it with just the text.
import type { EntityKind, Place, Snapshot } from "./types";

export type Fields = Record<string, unknown>;

const PLACE_FIELDS: Partial<Record<EntityKind, readonly string[]>> = {
  person: ["address", "school"],
  household: ["address"],
};

const isPlaceField = (kind: EntityKind, name: string) => PLACE_FIELDS[kind]?.includes(name) ?? false;

function recordsOf(snapshot: Snapshot, kind: EntityKind): readonly { id: string }[] {
  switch (kind) {
    case "person":
      return snapshot.people;
    case "household":
      return snapshot.households;
    case "contact_group":
      return snapshot.groups;
    case "relationship":
      return snapshot.relationships;
    case "interaction":
      return snapshot.interactions;
  }
}

export function findRecord(snapshot: Snapshot, kind: EntityKind, id: string): Fields | undefined {
  return recordsOf(snapshot, kind).find((r) => r.id === id) as Fields | undefined;
}

/** True when a record of any kind has this id. */
export function hasRecord(snapshot: Snapshot, id: string): boolean {
  const kinds: EntityKind[] = ["person", "household", "contact_group", "relationship", "interaction"];
  return kinds.some((kind) => recordsOf(snapshot, kind).some((r) => r.id === id));
}

const same = (a: unknown, b: unknown) =>
  a === b || (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

function normalized(kind: EntityKind, name: string, value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (isPlaceField(kind, name)) return text ? ({ formatted: text } satisfies Place) : null;
  return text || null;
}

/**
 * The fields the user changed: those that differ from `base`, the values the form opened with
 * (see forms/drafts.ts). A field the base doesn't have counts as changed. Without a base, all of them.
 */
export function editedFields(fields: Fields, base: Fields | undefined): Fields {
  if (!base) return fields;
  return Object.fromEntries(Object.entries(fields).filter(([name, value]) => !(name in base) || !same(value, base[name])));
}

/** Only the fields that differ from `record`. */
export function changedFields(kind: EntityKind, record: Fields, fields: Fields): Fields {
  const changes: Fields = {};
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const current = record[name] ?? null;
    if (isPlaceField(kind, name) && typeof value === "string") {
      const before = ((current as Place | null)?.formatted ?? "").trim();
      if (value.trim() !== before) changes[name] = normalized(kind, name, value);
      continue;
    }
    // Compared as typed first, so untouched text (a trailing newline, say) isn't re-sent trimmed.
    if (same(value, current)) continue;
    const next = normalized(kind, name, value);
    if (!same(next, current)) changes[name] = next;
  }
  return changes;
}

/** A new record's fields: blank ones are left out, so the server's defaults apply. */
export function newFields(kind: EntityKind, fields: Fields): Fields {
  const out: Fields = {};
  for (const [name, value] of Object.entries(fields)) {
    const next = normalized(kind, name, value);
    if (next !== undefined && next !== null) out[name] = next;
  }
  return out;
}
