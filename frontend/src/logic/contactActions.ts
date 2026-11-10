import type { Household, Person, Place } from "../types";

// Phone numbers may be stored as raw digit strings with no country code. Numbers that don't fit
// the expected shapes are rejected rather than mangled.
export function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("+")) {
    const digits = raw.slice(1).replace(/\D/g, "");
    return digits.length >= 8 ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function formatPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") || digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// These open with target="_blank": in the iOS Companion app that is the only way a tel:, sms:
// or mailto: link reaches Phone, Messages or Mail.
export function callUrl(raw: string | null): string | null {
  const number = normalizePhone(raw);
  return number ? `tel:${number}` : null;
}

export function messageUrl(raw: string | null): string | null {
  const number = normalizePhone(raw);
  return number ? `sms:${number}` : null;
}

export function emailUrl(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? "";
  // Not full validation, just enough that the address survives as a URL: Mail silently
  // refuses a mailto: containing spaces.
  if (trimmed === "" || /\s/.test(trimmed)) return null;
  return `mailto:${trimmed}`;
}

// A place Maps can use: coordinates, or some address text.
function mappable(place: Place | null | undefined): place is Place {
  if (!place) return false;
  if (typeof place.lat === "number" && typeof place.lon === "number") return true;
  return (place.formatted?.trim() ?? "") !== "";
}

// The person's own address first. Their household's is the fallback when the person's has neither
// coordinates nor text (an empty address is stored as an object, not as null).
export function mapDestination(person: Person, household: Household | null): Place | null {
  if (mappable(person.address)) return person.address;
  return mappable(household?.address) ? household.address : null;
}

// Coordinates when the place has them, so Maps can't land on the wrong "Springfield"; the
// formatted address otherwise. An https URL works in desktop browsers and opens Apple Maps on iOS.
export function mapsUrl(person: Person, household: Household | null): string | null {
  const place = mapDestination(person, household);
  if (!place) return null;
  const label = place.formatted ?? "";
  if (typeof place.lat === "number" && typeof place.lon === "number") {
    return `https://maps.apple.com/?ll=${place.lat},${place.lon}&q=${encodeURIComponent(label)}`;
  }
  return label ? `https://maps.apple.com/?q=${encodeURIComponent(label)}` : null;
}

// A stored web address (website, social profiles) as a link only when it is http or https.
// Anything can be written to the CRM, Claude included, so a javascript: or data: URL must never
// become an href; nor does a relative path, which would open inside Home Assistant.
export function webUrl(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
