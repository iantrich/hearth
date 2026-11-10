import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { href, parseRoute } from "../src/router";
import type { Snapshot } from "../src/types";
import { fakeConnection, person, relationship, sampleSnapshot, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const WRITE_TYPES = ["hearth_crm/create", "hearth_crm/update", "hearth_crm/delete"];

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

const root = (el: HearthPanel) => el.shadowRoot!;
let cleanups: (() => void)[] = [];

async function mount(path: string, data: () => Snapshot, handlers: Record<string, Handler> = {}) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => data(), ...handlers });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path };
  el.hass = { connection: conn, user: { id: "u1", name: "Test User" } };
  const follow = () => (el.route = { prefix: "/hearth", path: location.pathname.replace(/^\/hearth/, "") });
  window.addEventListener("location-changed", follow);
  cleanups.push(() => window.removeEventListener("location-changed", follow));
  history.replaceState(null, "", `/hearth${path}`);
  document.body.appendChild(el);
  await settle(el);
  const writes = () => conn.sent.filter((m) => WRITE_TYPES.includes(m.type));
  return { el, conn, writes };
}

// The option marked selected: happy-dom's select.value disagrees with it after the first draw.
const shownType = (el: HearthPanel) => root(el).querySelector<HTMLOptionElement>('[role="dialog"] select[name="type"] option[selected]')?.value;
const sheetEl = (el: HearthPanel) => root(el).querySelector<HTMLElement>('[role="dialog"]');
const button = (el: HearthPanel, text: string, scope = '[role="dialog"]') =>
  [...root(el).querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === text);
const confirmButton = (el: HearthPanel, text: string) => button(el, text, '[role="alertdialog"]');

async function search(el: HearthPanel, text: string) {
  const input = root(el).querySelector<HTMLInputElement>("#relationship-person")!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  await settle(el);
}

function choices(el: HearthPanel): string[] {
  return [...root(el).querySelectorAll(".picker-choice .name")].map((n) => n.textContent!.trim());
}

async function pick(el: HearthPanel, name: string) {
  [...root(el).querySelectorAll<HTMLButtonElement>(".picker-choice")].find((b) => b.textContent!.includes(name))!.click();
  await settle(el);
}

async function chooseType(el: HearthPanel, value: string) {
  const select = root(el).querySelector<HTMLSelectElement>('[role="dialog"] select[name="type"]')!;
  select.value = value;
  select.dispatchEvent(new Event("change"));
  await settle(el);
}

async function clickSave(el: HearthPanel) {
  button(el, "Save")!.click();
  await settle(el);
}

/** Phil, Josie and Dana. Phil is Josie's Parent: stored A=Josie, B=Phil, type Parent, inverse Child. */
function family(): Snapshot {
  const s = sampleSnapshot();
  s.people.push(person("phil", "Phil Hollis"), person("josie", "Josie Hollis"), person("dana", "Dana Ferris"), person("dani", "Danika Brandt"));
  s.relationships.push({ ...relationship("rjp", "josie", "phil", "Parent", "Child"), notes: "Since forever" });
  s.relationships.push(relationship("rpd", "phil", "dana", "Friend", "Friend"));
  return s;
}

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
  document.body.innerHTML = "";
});

describe("relationship routes", () => {
  it("parse to the sheet, new or existing", () => {
    expect(parseRoute("/person/p1/relationship/new")).toEqual({ name: "relationship", personId: "p1", relId: null });
    expect(parseRoute("/person/p1/relationship/r9")).toEqual({ name: "relationship", personId: "p1", relId: "r9" });
    expect(parseRoute(href.relationship("p1", "r9").replace("/hearth", ""))).toEqual({ name: "relationship", personId: "p1", relId: "r9" });
    expect(parseRoute("/person/p1/relationship")).toEqual({ name: "person", id: "p1", sheet: null });
  });
});

describe("person screen", () => {
  it("links each connection's type to its sheet and offers Add relationship", async () => {
    const { el } = await mount("/person/phil", family);
    const types = [...root(el).querySelectorAll<HTMLAnchorElement>("a.connection-type")];
    expect(types.map((a) => a.textContent!.trim())).toEqual(expect.arrayContaining(["CHILD", "FRIEND"]));
    const child = types.find((a) => a.textContent!.trim() === "CHILD")!;
    expect(child.getAttribute("href")).toBe(href.relationship("phil", "rjp"));
    expect(root(el).querySelector("a.add-relationship")!.getAttribute("href")).toBe(href.newRelationship("phil"));
  });
});

describe("relationship sheet", () => {
  it("adding from Phil's screen stores Phil as A and the chosen type", async () => {
    const { el, writes } = await mount("/person/phil/relationship/new", family, {
      "hearth_crm/create": () => ({ id: "rnew" }),
    });
    expect(sheetEl(el)).not.toBeNull();
    expect(button(el, "Save")!.disabled).toBe(true);
    // Before anyone is picked the sentence reads "Someone is Phil's".
    expect(sheetEl(el)!.textContent!.replace(/\s+/g, " ")).toContain("Someone is Phil's");
    await search(el, "Alex");
    await pick(el, "Alex Marlow");
    await chooseType(el, "Sibling");
    expect(root(el).textContent).toContain("Alex Marlow is Phil's");
    await clickSave(el);
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({
      type: "hearth_crm/create",
      kind: "relationship",
      fields: { person_a_id: "phil", person_b_id: "p1", type: "Sibling" },
    });
    expect(location.pathname).toBe("/hearth/person/phil");
  });

  it("editing from B's side swaps A and B and stores the chosen type", async () => {
    const { el, writes } = await mount(`/person/phil/relationship/rjp`, family, {
      "hearth_crm/update": () => ({}),
    });
    // Phil is Josie's Parent, so from Phil's side Josie is his Child.
    expect(root(el).textContent).toContain("Josie Hollis is Phil's");
    expect(shownType(el)).toBe("Child");
    await chooseType(el, "Mentee");
    await clickSave(el);
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({
      type: "hearth_crm/update",
      kind: "relationship",
      entity_id: "rjp",
      changes: { person_a_id: "phil", person_b_id: "josie", type: "Mentee" },
    });
  });

  it("opening and saving without changes from A's side sends nothing from the other side's view", async () => {
    const { el, writes } = await mount(`/person/josie/relationship/rjp`, family);
    expect(shownType(el)).toBe("Parent");
    await clickSave(el);
    expect(writes()).toHaveLength(0);
    expect(location.pathname).toBe("/hearth/person/josie");
  });

  it("the picker leaves out the viewer and people already linked", async () => {
    const { el } = await mount("/person/phil/relationship/new", family);
    await search(el, "o"); // Phil, Josie, Dana, Alex... everything containing an o
    const names = choices(el);
    expect(names).not.toContain("Phil Hollis");
    expect(names).not.toContain("Josie Hollis");
    expect(names).not.toContain("Dana Ferris");
    await search(el, "Dani");
    expect(choices(el)).toEqual(["Danika Brandt"]);
  });

  it("editing keeps the person being edited out of the exclusions but hides the others", async () => {
    const { el } = await mount("/person/phil/relationship/rjp", family);
    // Josie is chosen (a chip), and Dana, linked by another row, can't be picked.
    expect(root(el).querySelector(".chips")!.textContent).toContain("Josie Hollis");
    await search(el, "Dana");
    expect(choices(el)).toEqual([]);
    // Remove Josie and she becomes pickable again.
    root(el).querySelector<HTMLButtonElement>('[aria-label="Remove Josie Hollis"]')!.click();
    await settle(el);
    await search(el, "Josie");
    expect(choices(el)).toEqual(["Josie Hollis"]);
  });

  it("delete asks first and sends delete for that row only", async () => {
    const { el, writes } = await mount("/person/phil/relationship/rjp", family, { "hearth_crm/delete": () => ({}) });
    button(el, "Remove relationship")!.click();
    await settle(el);
    expect(writes()).toHaveLength(0);
    expect(root(el).querySelector('[role="alertdialog"]')!.textContent).toContain("Remove the link between Phil Hollis and Josie Hollis?");
    confirmButton(el, "Cancel")!.click();
    await settle(el);
    expect(root(el).querySelector('[role="alertdialog"]')).toBeNull();
    expect(writes()).toHaveLength(0);
    button(el, "Remove relationship")!.click();
    await settle(el);
    confirmButton(el, "Remove")!.click();
    await settle(el);
    expect(writes()).toHaveLength(1);
    expect(writes()[0]).toMatchObject({ type: "hearth_crm/delete", kind: "relationship", entity_id: "rjp" });
    expect(location.pathname).toBe("/hearth/person/phil");
  });

  it("the delete confirmation names the stored person even after the chip is changed", async () => {
    const { el, writes } = await mount("/person/phil/relationship/rjp", family, { "hearth_crm/delete": () => ({}) });
    root(el).querySelector<HTMLButtonElement>('[aria-label="Remove Josie Hollis"]')!.click();
    await settle(el);
    button(el, "Remove relationship")!.click();
    await settle(el);
    const dialog = root(el).querySelector('[role="alertdialog"]')!.textContent!;
    expect(dialog).toContain("Remove the link between Phil Hollis and Josie Hollis?");
    confirmButton(el, "Remove")!.click();
    await settle(el);
    expect(writes()[0]).toMatchObject({ type: "hearth_crm/delete", entity_id: "rjp" });
  });

  it("a relationship that no longer exists shows the person's screen, and a failed save keeps the sheet open", async () => {
    const gone = await mount("/person/phil/relationship/missing", family);
    expect(root(gone.el).textContent).not.toContain("no longer exists");
    expect(root(gone.el).querySelector("#content")!.textContent).toContain("Phil Hollis");
    expect(sheetEl(gone.el)).toBeNull();
    document.body.innerHTML = "";

    const { el } = await mount("/person/phil/relationship/new", family, {
      "hearth_crm/create": () => {
        throw Object.assign(new Error("boom"), { code: "invalid" });
      },
    });
    await search(el, "Alex");
    await pick(el, "Alex Marlow");
    await chooseType(el, "Friend");
    await clickSave(el);
    expect(sheetEl(el)).not.toBeNull();
    expect(location.pathname).toBe("/hearth/person/phil/relationship/new");
  });

  it("saving a relationship deleted elsewhere closes the sheet to the person with the deleted toast", async () => {
    let deleted = false;
    const data = () => {
      const s = family();
      return deleted ? { ...s, relationships: s.relationships.filter((r) => r.id !== "rjp") } : s;
    };
    const { el } = await mount("/person/phil/relationship/rjp", data, {
      "hearth_crm/update": () => {
        deleted = true;
        throw { code: "not_found", message: "relationship 'rjp' does not exist" };
      },
    });
    const notes = root(el).querySelector<HTMLTextAreaElement>('[role="dialog"] textarea[name="notes"]')!;
    notes.value = "Since the beginning";
    notes.dispatchEvent(new Event("input"));
    await settle(el);
    await clickSave(el);
    expect(root(el).querySelector(".toast")?.textContent).toContain("That was already deleted.");
    expect(sheetEl(el)).toBeNull();
    expect(root(el).textContent).not.toContain("no longer exists");
    expect(location.pathname).toBe("/hearth/person/phil");
  });

  it("says the person no longer exists when they are gone", async () => {
    const { el } = await mount("/person/nobody/relationship/new", family);
    expect(root(el).textContent).toContain("This person no longer exists.");
    expect(sheetEl(el)).toBeNull();
  });
});
