import { describe, expect, it } from "vitest";
import {
  callUrl,
  emailUrl,
  formatPhone,
  mapDestination,
  mapsUrl,
  messageUrl,
  normalizePhone,
  webUrl,
} from "../../src/logic/contactActions";
import { household, person } from "../fixtures";

describe("phone numbers", () => {
  it("normalizes to E.164", () => {
    expect(normalizePhone("5550142233")).toBe("+15550142233");
    expect(normalizePhone("(555) 014-2233")).toBe("+15550142233");
    expect(normalizePhone("555.014.2233")).toBe("+15550142233");
    expect(normalizePhone("15550142233")).toBe("+15550142233");
    expect(normalizePhone("+442079460000")).toBe("+442079460000");
  });

  it("rejects unrecognizable input rather than mangling it", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
  });

  it("formats US style when possible, raw otherwise", () => {
    expect(formatPhone("5550142233")).toBe("(555) 014-2233");
    expect(formatPhone("+442079460000")).toBe("+442079460000");
  });
});

describe("contact URLs", () => {
  it("builds call and message URLs", () => {
    expect(callUrl("5550142233")).toBe("tel:+15550142233");
    expect(messageUrl("5550142233")).toBe("sms:+15550142233");
    expect(callUrl(null)).toBeNull();
    expect(callUrl("nope")).toBeNull();
  });

  it("builds a trimmed mailto, rejecting blank or spaced addresses", () => {
    expect(emailUrl("pat@example.com")).toBe("mailto:pat@example.com");
    expect(emailUrl("  pat@example.com ")).toBe("mailto:pat@example.com");
    expect(emailUrl(null)).toBeNull();
    expect(emailUrl("   ")).toBeNull();
    expect(emailUrl("not an address")).toBeNull();
  });

  const personal = { formatted: "1 Main St, Springfield", lat: 1, lon: 2 };
  const shared = { formatted: "2 Oak St, Springfield", lat: 3, lon: 4 };

  it("prefers the personal address over the household's", () => {
    const home = household("h", "Vale", ["p"], { address: shared });
    expect(mapDestination(person("p", "A", { address: personal }), home)?.formatted).toBe("1 Main St, Springfield");
    expect(mapDestination(person("p", "A"), home)?.formatted).toBe("2 Oak St, Springfield");
    expect(mapDestination(person("p", "A"), null)).toBeNull();
    expect(mapsUrl(person("p", "A"), null)).toBeNull();
  });

  it("map falls back to the household address when the person's is unusable", () => {
    const home = household("h", "Vale", ["p"], { address: shared });
    expect(mapDestination(person("p", "A", { address: { formatted: null } }), home)).toBe(home.address);
    expect(mapDestination(person("p", "A", { address: { formatted: "  " } }), home)).toBe(home.address);
    expect(mapsUrl(person("p", "A", { address: { formatted: null, street: "1 Main" } }), home)).toBe(
      "https://maps.apple.com/?ll=3,4&q=2%20Oak%20St%2C%20Springfield",
    );
    // Both unusable: nothing to open.
    expect(mapsUrl(person("p", "A", { address: { formatted: null } }), household("h", "Vale", ["p"], { address: { formatted: "" } }))).toBeNull();
    // Text alone, or coordinates alone, is usable.
    expect(mapDestination(person("p", "A", { address: { formatted: "5 Elm St" } }), home)?.formatted).toBe("5 Elm St");
    expect(mapDestination(person("p", "A", { address: { formatted: null, lat: 1, lon: 2 } }), home)?.lat).toBe(1);
  });

  it("maps by coordinates when the place has them", () => {
    const place = { formatted: "Home & Away", lat: 41.27375, lon: -96.00197 };
    expect(mapsUrl(person("p", "A", { address: place }), null)).toBe(
      "https://maps.apple.com/?ll=41.27375,-96.00197&q=Home%20%26%20Away",
    );
  });

  it("falls back to the address text without coordinates, and to nothing without either", () => {
    expect(mapsUrl(person("p", "A", { address: { formatted: "12 Elm St, Springfield" } }), null)).toBe(
      "https://maps.apple.com/?q=12%20Elm%20St%2C%20Springfield",
    );
    expect(mapsUrl(person("p", "A", { address: { formatted: null } }), null)).toBeNull();
  });
});

describe("web links", () => {
  it("keeps http and https URLs", () => {
    expect(webUrl("https://example.com/alex")).toBe("https://example.com/alex");
    expect(webUrl(" http://example.com ")).toBe("http://example.com/");
    expect(webUrl("HTTPS://www.linkedin.com/in/alex-marlow")).toBe("https://www.linkedin.com/in/alex-marlow");
  });

  it("refuses every other scheme, relative paths and junk", () => {
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl(" JavaScript:alert(1)")).toBeNull();
    expect(webUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(webUrl("vbscript:msgbox(1)")).toBeNull();
    expect(webUrl("/hearth/settings")).toBeNull();
    expect(webUrl("example.com")).toBeNull();
    expect(webUrl("")).toBeNull();
    expect(webUrl(null)).toBeNull();
  });
});
