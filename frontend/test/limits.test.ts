// Every text field in the panel stops typing at exactly the server's limit for what it saves
// (service.py MAX_TEXT_LENGTHS), so nothing the panel lets you type is refused for its length.
import { afterEach, describe, expect, it } from "vitest";
import serviceSource from "../../custom_components/hearth_crm/service.py?raw";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { fakeConnection, sampleSnapshot } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };

/** MAX_TEXT_LENGTHS as Python has it. */
function serverLimits(): Record<string, number> {
  const block = /MAX_TEXT_LENGTHS[^=]*=\s*\{([^}]*)\}/.exec(serviceSource)![1];
  const limits: Record<string, number> = {};
  for (const [, name, value] of block.matchAll(/"(\w+)":\s*([\d_]+)/g)) limits[name] = Number(value.replace(/_/g, ""));
  return limits;
}

/** Places are limited by their text, `formatted`. */
const PLACES = new Set(["address", "school"]);

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

async function mount(path: string) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path };
  el.hass = { connection: conn, user: { id: "u1", name: "Test User" } };
  history.replaceState(null, "", `/hearth${path}`);
  document.body.appendChild(el);
  await settle(el);
  return el;
}

/** Each named text input and textarea on the screen, with its maxlength. */
function namedLimits(el: HearthPanel): Record<string, number> {
  const out: Record<string, number> = {};
  const fields = el.shadowRoot!.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    "input[name]:not([type=checkbox]):not([type=date]), textarea[name]",
  );
  for (const f of fields) out[f.name] = Number(f.getAttribute("maxlength"));
  return out;
}

function expectServerLimits(found: Record<string, number>) {
  const limits = serverLimits();
  expect(Object.keys(found).length).toBeGreaterThan(0);
  for (const [name, maxlength] of Object.entries(found)) {
    const limit = limits[PLACES.has(name) ? "formatted" : name];
    expect({ name, maxlength }).toEqual({ name, maxlength: limit });
  }
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("text limits match the server", () => {
  it("reads the server's limits", () => {
    expect(serverLimits()).toMatchObject({ name: 200, website: 500, summary: 300, notes: 20_000, formatted: 1_000 });
  });

  it("person editor", async () => {
    const found = namedLimits(await mount("/person/p4/edit"));
    expect(Object.keys(found)).toEqual(expect.arrayContaining(["website", "linkedin", "notes", "relationship_summary", "address"]));
    expectServerLimits(found);
  });

  it("household editor", async () => {
    expectServerLimits(namedLimits(await mount("/household/h1/edit")));
  });

  it("group editor", async () => {
    const found = namedLimits(await mount("/group/g1/edit"));
    expect(found).toHaveProperty("description");
    expectServerLimits(found);
  });

  it("relationship sheet", async () => {
    const found = namedLimits(await mount("/person/p1/relationship/r1"));
    expect(found).toHaveProperty("notes");
    expectServerLimits(found);
  });

  it("add person form", async () => {
    const el = await mount("/add");
    const limits = serverLimits();
    for (const name of ["name", "phone", "email", "how_i_know_them"]) {
      const maxlength = Number(el.shadowRoot!.querySelector(`#add-${name.replace(/_/g, "-")}`)!.getAttribute("maxlength"));
      expect({ name, maxlength }).toEqual({ name, maxlength: limits[name] });
    }
  });

  it("log and edit interaction sheets: the summary is an interaction's summary", async () => {
    for (const path of ["/person/p1/log", "/interaction/i1/edit"]) {
      const el = await mount(path);
      const limits = serverLimits();
      const max = (id: string) => Number(el.shadowRoot!.querySelector(id)!.getAttribute("maxlength"));
      expect(max("#log-summary")).toBe(limits.summary);
      expect(max("#log-notes")).toBe(limits.notes);
      document.body.innerHTML = "";
    }
  });
});
