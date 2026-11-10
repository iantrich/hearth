// A form sends only what the user changed since it opened, so a change made elsewhere while it
// was open (by Claude, another tab or an import) isn't silently reverted by Save.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import type { Snapshot } from "../src/types";
import { fakeConnection, group, interaction, person, sampleSnapshot, type FakeConnection, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const WRITE_TYPES = ["hearth_crm/create", "hearth_crm/update", "hearth_crm/delete", "hearth_crm/group/set_members"];

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

const root = (el: HearthPanel) => el.shadowRoot!;
let cleanups: (() => void)[] = [];

/** `data` is what the server holds now; a test changes it, then calls `changedElsewhere`. */
async function mount(path: string, data: Snapshot, handlers: Record<string, Handler> = {}) {
  const conn = fakeConnection({
    "hearth_crm/crm/status": () => LOADED,
    "hearth_crm/snapshot": () => structuredClone(data),
    "hearth_crm/update": () => ({}),
    "hearth_crm/group/set_members": () => ({}),
    ...handlers,
  });
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

/** The server says something changed: the store refetches after its debounce. */
async function changedElsewhere(el: HearthPanel, conn: FakeConnection) {
  conn.push(1);
  await new Promise((r) => setTimeout(r, 300));
  await settle(el);
}

function type(el: HearthPanel, selector: string, value: string) {
  const input = root(el).querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

async function clickSave(el: HearthPanel) {
  [...root(el).querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Save")!.click();
  await settle(el);
}

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, "", "/hearth");
});
afterEach(() => {
  document.body.innerHTML = "";
  cleanups.forEach((c) => c());
  cleanups = [];
});

describe("forms send only what changed since they opened", () => {
  it("person editor: a summary changed elsewhere is kept when only the phone is edited", async () => {
    const data = sampleSnapshot();
    data.people[3] = person("p4", "Sam Okafor", { phone: "555-0101", relationship_summary: "Old summary" });
    const { el, conn, writes } = await mount("/person/p4/edit", data);

    data.people[3] = { ...data.people[3], relationship_summary: "Claude's new summary" };
    await changedElsewhere(el, conn);
    type(el, '#content [name="phone"]', "555-0199");
    await settle(el);
    await clickSave(el);

    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { phone: "555-0199" } }]);
  });

  it("person editor: group memberships changed elsewhere are kept; only the groups ticked or unticked are sent", async () => {
    const data = sampleSnapshot();
    data.groups.push(group("g2", "Book Club", ["p2"]), group("g3", "Choir", ["p1"]));
    const { el, conn, writes } = await mount("/person/p4/edit", data);

    // Elsewhere: Sam joins Book Club and leaves Trail Crew.
    data.groups[0] = { ...data.groups[0], member_ids: ["p1", "p5"] };
    data.groups[1] = { ...data.groups[1], member_ids: ["p2", "p4"] };
    await changedElsewhere(el, conn);
    // Here: Sam joins Choir.
    const choir = root(el).querySelector<HTMLInputElement>('#content input[data-group="g3"]')!;
    choir.checked = true;
    choir.dispatchEvent(new Event("change"));
    await settle(el);
    await clickSave(el);

    expect(writes()).toEqual([{ type: "hearth_crm/group/set_members", group_id: "g3", person_ids: ["p1", "p4"] }]);
  });

  it("household editor: notes changed elsewhere are kept when only the name is edited", async () => {
    const data = sampleSnapshot();
    const { el, conn, writes } = await mount("/household/h1/edit", data);
    data.households[0] = { ...data.households[0], notes: "Moved in May" };
    await changedElsewhere(el, conn);
    type(el, '#content [name="name_override"]', "The Marlows");
    await settle(el);
    await clickSave(el);
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "household", entity_id: "h1", changes: { name_override: "The Marlows" } }]);
  });

  it("group editor: a description changed elsewhere is kept when only the name is edited", async () => {
    const data = sampleSnapshot();
    const { el, conn, writes } = await mount("/group/g1/edit", data);
    data.groups[0] = { ...data.groups[0], description: "Sunday hikers now" };
    await changedElsewhere(el, conn);
    type(el, '#content [name="name"]', "Trail Crew 2");
    await settle(el);
    await clickSave(el);
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "contact_group", entity_id: "g1", changes: { name: "Trail Crew 2" } }]);
  });

  it("relationship sheet: a type changed elsewhere is kept when only the notes are edited", async () => {
    const data = sampleSnapshot();
    const { el, conn, writes } = await mount("/person/p1/relationship/r1", data);
    data.relationships[0] = { ...data.relationships[0], type: "Mentee", inverse_type: "Mentee" };
    await changedElsewhere(el, conn);
    type(el, '[role="dialog"] [name="notes"]', "Plays the cello");
    await settle(el);
    await clickSave(el);
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "relationship", entity_id: "r1", changes: { notes: "Plays the cello" } }]);
  });

  it("interaction edit: notes changed elsewhere are kept when only the date is edited", async () => {
    const data = sampleSnapshot();
    const { el, conn, writes } = await mount("/interaction/i1/edit", data);
    data.interactions[0] = { ...data.interactions[0], notes: "Added by Claude" };
    await changedElsewhere(el, conn);
    type(el, "#log-date", "2026-10-21");
    await settle(el);
    await clickSave(el);
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "interaction", entity_id: "i1", changes: { date: "2026-10-21" } }]);
  });
});

describe("editing an imported interaction", () => {
  it("an imported interaction with a 400-character summary saves after changing only its date", async () => {
    const data = sampleSnapshot();
    data.interactions[0] = interaction("i1", "A".repeat(400), "2026-10-20", ["p1", "p2"]);
    const { el, writes } = await mount("/interaction/i1/edit", data);
    type(el, "#log-date", "2026-10-22");
    await settle(el);
    await clickSave(el);
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "interaction", entity_id: "i1", changes: { date: "2026-10-22" } }]);
    expect(el.route!.path).toBe("/interaction/i1");
  });

  it("a summary the server refuses shows its error under the summary", async () => {
    const data = sampleSnapshot();
    const { el } = await mount("/interaction/i1/edit", data, {
      "hearth_crm/update": () => {
        throw { code: "invalid", message: "summary: is longer than 300 characters" };
      },
    });
    type(el, "#log-summary", "Coffee, then a walk");
    await settle(el);
    await clickSave(el);
    expect(el.route!.path).toBe("/interaction/i1/edit");
    const error = root(el).querySelector('[role="dialog"] [data-error-for="summary"]');
    expect(error?.textContent?.trim()).toBe("is longer than 300 characters");
    expect(root(el).querySelector("#log-summary")!.getAttribute("aria-invalid")).toBe("true");
    expect(root(el).querySelector('[data-error-for="notes"]')).toBeNull();
  });
});
