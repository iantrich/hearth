import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { householdChoiceLabel } from "../src/logic/names";
import { href, navigate, parseRoute } from "../src/router";
import type { Snapshot } from "../src/types";
import { fakeConnection, group, household, person, sampleSnapshot, type FakeConnection, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const WRITE_TYPES = [
  "hearth_crm/create", "hearth_crm/update", "hearth_crm/delete",
  "hearth_crm/photo/set", "hearth_crm/photo/clear", "hearth_crm/group/set_members",
];

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

/** The server says something changed: the store refetches after its debounce. */
async function changed(el: HearthPanel, conn: FakeConnection) {
  conn.push(1);
  await new Promise((r) => setTimeout(r, 300));
  await settle(el);
}

const root = (el: HearthPanel) => el.shadowRoot!;
const content = (el: HearthPanel) => root(el).querySelector("#content")!.textContent ?? "";
let cleanups: (() => void)[] = [];

async function mount(path: string, handlers: Record<string, Handler> = {}, data: () => Snapshot = sampleSnapshot) {
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

const field = (el: HearthPanel, name: string) =>
  root(el).querySelector<HTMLInputElement & HTMLTextAreaElement>(`#content [name="${name}"]`)!;

async function type(el: HearthPanel, name: string, value: string) {
  const input = field(el, name);
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await settle(el);
}

const button = (el: HearthPanel, text: string, scope = "") =>
  [...root(el).querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === text);

async function click(el: HearthPanel, text: string, scope = "") {
  const b = button(el, text, scope);
  if (!b) throw new Error(`no button "${text}"`);
  b.click();
  await settle(el);
}

/** Search the members picker and pick the first match. */
async function pickMember(el: HearthPanel, pickerId: string, query: string) {
  const input = root(el).querySelector<HTMLInputElement>(`#${pickerId}`)!;
  input.value = query;
  input.dispatchEvent(new Event("input"));
  await settle(el);
  root(el).querySelector<HTMLButtonElement>("#content .picker-choice")!.click();
  await settle(el);
}

const dialog = (el: HearthPanel) => root(el).querySelector('[role="alertdialog"]');
const title = (el: HearthPanel) => root(el).querySelector("#content .members-title")?.textContent?.trim();

/** The Okafors: Sam (p4) and Taylor (p6), two adults in h2. */
function withOkafors(): Snapshot {
  const s = sampleSnapshot();
  s.people[3] = person("p4", "Sam Okafor", { household_id: "h2" });
  s.people[5] = person("p6", "Taylor Brandt", { household_id: "h2" });
  s.households.push(household("h2", "Okafor-Brandt Household", ["p4", "p6"]));
  return s;
}

/** After Sam moved into h1: h1 has four members and h2 only Taylor, which Python says isn't a household. */
function afterMove(): Snapshot {
  const s = withOkafors();
  s.people[3] = person("p4", "Sam Okafor", { household_id: "h1" });
  s.households[0] = { ...s.households[0], name: "Marlow & Okafor Family", member_ids: ["p1", "p2", "p3", "p4"] };
  s.households[1] = household("h2", null, ["p6"], { name_status: "not_a_household" });
  return s;
}

describe("routes", () => {
  it("new and edit routes for households and groups", () => {
    expect(href.newHousehold()).toBe("/hearth/household/new");
    expect(href.editHousehold("a b")).toBe("/hearth/household/a%20b/edit");
    expect(href.newGroup()).toBe("/hearth/group/new");
    expect(href.editGroup("g1")).toBe("/hearth/group/g1/edit");
    expect(parseRoute("/household/new")).toEqual({ name: "householdNew" });
    expect(parseRoute("/household/h1/edit")).toEqual({ name: "householdEdit", id: "h1" });
    expect(parseRoute("/household/h1")).toEqual({ name: "household", id: "h1" });
    expect(parseRoute("/group/new")).toEqual({ name: "groupNew" });
    expect(parseRoute("/group/g1/edit")).toEqual({ name: "groupEdit", id: "g1" });
    expect(parseRoute("/group/g1")).toEqual({ name: "group", id: "g1" });
  });
});

describe("households and groups", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/hearth");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    cleanups.forEach((c) => c());
    cleanups = [];
  });

  it("household and group screens have an Edit action", async () => {
    const { el } = await mount("/household/h1");
    expect(root(el).querySelector('a[aria-label="Edit"]')?.getAttribute("href")).toBe("/hearth/household/h1/edit");
    document.body.innerHTML = "";
    const g = await mount("/group/g1");
    expect(root(g.el).querySelector('a[aria-label="Edit"]')?.getAttribute("href")).toBe("/hearth/group/g1/edit");
  });

  it("adding a member updates household_id immediately and the name follows the snapshot", async () => {
    let moved = false;
    const data = () => {
      const s = sampleSnapshot();
      if (!moved) return s;
      s.people[3] = person("p4", "Sam Okafor", { household_id: "h1" });
      s.households[0] = { ...s.households[0], name: "Marlow & Okafor Family", member_ids: ["p1", "p2", "p3", "p4"] };
      return s;
    };
    const { el, conn, writes } = await mount(
      "/household/h1/edit",
      { "hearth_crm/update": () => ((moved = true), {}) },
      data,
    );
    expect(title(el)).toBe("Marlow Family");
    await pickMember(el, "household-members", "Sam");
    // No Save: the person is updated at once, and nothing is asked (Sam has no household).
    expect(dialog(el)).toBeNull();
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { household_id: "h1" } }]);
    await changed(el, conn);
    expect(title(el)).toBe("Marlow & Okafor Family");
    expect(root(el).querySelector('#content [aria-label="Remove Sam Okafor"]')).toBeTruthy();
    // Removing is immediate too.
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Riley Marlow"]')!.click();
    await settle(el);
    expect(writes().at(-1)).toEqual({ type: "hearth_crm/update", kind: "person", entity_id: "p3", changes: { household_id: null } });
    expect(el.route!.path).toBe("/household/h1/edit");
  });

  it("moving someone from another household asks first", async () => {
    const { el, writes } = await mount("/household/h1/edit", { "hearth_crm/update": () => ({}) }, withOkafors);
    await pickMember(el, "household-members", "Sam");
    expect(dialog(el)?.textContent).toContain("Move Sam Okafor from Okafor-Brandt Household to this household?");
    expect(writes()).toEqual([]);
    await click(el, "Cancel");
    expect(dialog(el)).toBeNull();
    expect(writes()).toEqual([]);

    await pickMember(el, "household-members", "Sam");
    await click(el, "Move");
    expect(dialog(el)).toBeNull();
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { household_id: "h1" } }]);
  });

  it("a household left with one member offers to dissolve and only dissolves when asked", async () => {
    let moved = false;
    const { el, conn, writes } = await mount(
      "/household/h1/edit",
      { "hearth_crm/update": () => ((moved = true), {}), "hearth_crm/delete": () => ({}) },
      () => (moved ? afterMove() : withOkafors()),
    );
    await pickMember(el, "household-members", "Sam");
    await click(el, "Move");
    await changed(el, conn);

    // Taylor's old household is now one adult: its screen says so, and nothing was deleted.
    navigate(href.household("h2"));
    await settle(el);
    expect(title(el)).toBe("Not a household");
    expect(root(el).querySelector<HTMLAnchorElement>("#content .name-prompt")?.getAttribute("href")).toBe("/hearth/household/h2/edit");
    navigate(href.editHousehold("h2"));
    await settle(el);
    expect(content(el)).toContain("This isn't a household any more (one adult, no children)");
    expect(writes().filter((m) => m.type === "hearth_crm/delete")).toEqual([]);

    await click(el, "Dissolve household", "#content");
    expect(dialog(el)?.textContent).toContain("Members stay; they just won't have a household.");
    await click(el, "Cancel");
    expect(dialog(el)).toBeNull();
    expect(writes().filter((m) => m.type === "hearth_crm/delete")).toEqual([]);

    await click(el, "Dissolve household", "#content");
    await click(el, "Dissolve household", '[role="alertdialog"]');
    expect(writes().filter((m) => m.type === "hearth_crm/delete")).toEqual([
      { type: "hearth_crm/delete", kind: "household", entity_id: "h2" },
    ]);
    expect(el.route!.path).toBe("/search");
  });

  it("a household that needs a name says so and highlights the name field", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.households[0] = { ...s.households[0], name: null, name_status: "needs_name" };
      return s;
    };
    const { el } = await mount("/household/h1/edit", {}, data);
    expect(content(el)).toContain("This household needs a name");
    expect(root(el).querySelector('#content .highlight [name="name_override"]')).toBeTruthy();
    expect(root(el).querySelector("#content label.field span")?.textContent).toBe("Name (leave blank to use the generated name)");
  });

  it("blank override is saved as null so the generated name returns", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.households[0] = { ...s.households[0], name: "The Lakehouse", name_override: "The Lakehouse", name_status: "override" };
      return s;
    };
    const { el, writes } = await mount("/household/h1/edit", { "hearth_crm/update": () => ({}) }, data);
    expect(field(el, "name_override").value).toBe("The Lakehouse");
    await type(el, "name_override", "   ");
    await type(el, "notes", "Gate code is on the fridge");
    await click(el, "Save", "#content");
    expect(writes()).toEqual([
      {
        type: "hearth_crm/update", kind: "household", entity_id: "h1",
        changes: { name_override: null, notes: "Gate code is on the fridge" },
      },
    ]);
    expect(el.route!.path).toBe("/household/h1");
  });

  it("deleting a household asks first and says its members stay", async () => {
    const { el, writes } = await mount("/household/h1/edit", { "hearth_crm/delete": () => ({}) });
    await click(el, "Delete household", "#content");
    expect(dialog(el)?.textContent).toContain("3 people stay; they just won't have a household.");
    expect(writes()).toEqual([]);
    await click(el, "Delete household", '[role="alertdialog"]');
    expect(writes()).toEqual([{ type: "hearth_crm/delete", kind: "household", entity_id: "h1" }]);
  });

  it("new household creates then opens its editor, which waits for it to arrive", async () => {
    let created = false;
    const data = () => {
      const s = sampleSnapshot();
      if (created) s.households.push(household("h9", null, []));
      return s;
    };
    const { el, conn, writes } = await mount("/household/new", { "hearth_crm/create": () => ((created = true), { id: "h9" }) }, data);
    await click(el, "Create household", "#content");
    expect(writes()).toEqual([{ type: "hearth_crm/create", kind: "household", fields: {} }]);
    expect(el.route!.path).toBe("/household/h9/edit");
    expect(content(el)).not.toContain("no longer exists");
    await changed(el, conn);
    expect(content(el)).toContain("This household needs a name");
  });

  it("group members change through set_members with the full list", async () => {
    const { el, writes } = await mount("/group/g1/edit", { "hearth_crm/group/set_members": () => ({}) });
    await pickMember(el, "group-members", "Taylor");
    expect(writes()).toEqual([{ type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p4", "p5", "p6"] }]);
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Sam Okafor"]')!.click();
    await settle(el);
    // Built on the list just sent, so Taylor stays.
    expect(writes().at(-1)).toEqual({ type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p5", "p6"] });
  });

  it("two quick removes before the change notice both stick", async () => {
    const { el, writes } = await mount("/group/g1/edit", { "hearth_crm/group/set_members": () => ({}) });
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Sam Okafor"]')!.click();
    await settle(el);
    // No change notice yet: the snapshot still has Sam.
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Casey Lindqvist"]')!.click();
    await settle(el);
    expect(writes()).toEqual([
      { type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p5"] },
      { type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1"] },
    ]);
  });

  it("two quick adds before the change notice both stick", async () => {
    const { el, writes } = await mount("/group/g1/edit", { "hearth_crm/group/set_members": () => ({}) });
    await pickMember(el, "group-members", "Taylor");
    await pickMember(el, "group-members", "Riley");
    expect(writes()).toEqual([
      { type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p4", "p5", "p6"] },
      { type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p4", "p5", "p6", "p3"] },
    ]);
  });

  it("the next snapshot replaces the list sent, even when someone else changed it", async () => {
    let fetches = 0;
    const data = () => {
      const s = sampleSnapshot();
      // After the write, another tab has also added Taylor.
      if (++fetches > 1) s.groups[0] = { ...s.groups[0], member_ids: ["p1", "p5", "p6"] };
      return s;
    };
    const { el, conn, writes } = await mount("/group/g1/edit", { "hearth_crm/group/set_members": () => ({}) }, data);
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Sam Okafor"]')!.click();
    await settle(el);
    await changed(el, conn);
    expect(root(el).querySelector('#content [aria-label="Remove Taylor Brandt"]')).toBeTruthy();
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Casey Lindqvist"]')!.click();
    await settle(el);
    expect(writes().at(-1)).toEqual({ type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p6"] });
  });

  it("the person editor's group change builds on a member change not yet in the snapshot", async () => {
    const { el, writes } = await mount("/group/g1/edit", { "hearth_crm/group/set_members": () => ({}) });
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Sam Okafor"]')!.click();
    await settle(el);
    navigate(href.editPerson("p6"));
    await settle(el);
    const box = root(el).querySelector<HTMLInputElement>('#content input[data-group="g1"]')!;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await settle(el);
    await click(el, "Save", "#content");
    expect(writes().at(-1)).toEqual({ type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p5", "p6"] });
  });

  it("a member change on a group deleted elsewhere shows the deleted toast and the not-found screen", async () => {
    let deleted = false;
    const { el } = await mount(
      "/group/g1/edit",
      {
        "hearth_crm/group/set_members": () => {
          deleted = true;
          throw { code: "not_found", message: "contact_group 'g1' does not exist" };
        },
      },
      () => {
        const s = sampleSnapshot();
        return deleted ? { ...s, groups: [] } : s;
      },
    );
    root(el).querySelector<HTMLButtonElement>('#content [aria-label="Remove Sam Okafor"]')!.click();
    await settle(el);
    expect(root(el).querySelector(".toast")?.textContent).toContain("That was already deleted.");
    expect(content(el)).toContain("This group no longer exists.");
  });

  it("group edit saves the name and description; the name is required", async () => {
    const { el, writes } = await mount("/group/g1/edit", { "hearth_crm/update": () => ({}) });
    await type(el, "name", " ");
    expect(button(el, "Save", "#content")!.disabled).toBe(true);
    expect(root(el).querySelector('[data-error-for="name"]')?.textContent?.trim()).toBe("Enter a name.");
    await type(el, "name", "Trail Crew");
    await type(el, "description", "");
    await click(el, "Save", "#content");
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "contact_group", entity_id: "g1", changes: { description: null } }]);
  });

  it("deleting a group says how many people stay", async () => {
    const { el, writes } = await mount("/group/g1/edit", { "hearth_crm/delete": () => ({}) });
    await click(el, "Delete group", "#content");
    expect(dialog(el)?.textContent).toContain("3 people stay; they just leave this group.");
    await click(el, "Delete group", '[role="alertdialog"]');
    expect(writes()).toEqual([{ type: "hearth_crm/delete", kind: "contact_group", entity_id: "g1" }]);
    expect(el.route!.path).toBe("/search");
  });

  it("new group creates then opens its editor", async () => {
    let created = false;
    const data = () => {
      const s = sampleSnapshot();
      if (created) s.groups.push(group("g9", "Book Club", []));
      return s;
    };
    const { el, conn, writes } = await mount("/search", { "hearth_crm/create": () => ((created = true), { id: "g9" }) }, data);
    await click(el, "Groups");
    expect(root(el).querySelector<HTMLAnchorElement>("#content a.new-record")?.getAttribute("href")).toBe("/hearth/group/new");
    await click(el, "Households");
    expect(root(el).querySelector<HTMLAnchorElement>("#content a.new-record")?.getAttribute("href")).toBe("/hearth/household/new");

    navigate(href.newGroup());
    await settle(el);
    expect(button(el, "Create group", "#content")!.disabled).toBe(true);
    await type(el, "name", "Book Club");
    await click(el, "Create group", "#content");
    expect(writes()).toEqual([{ type: "hearth_crm/create", kind: "contact_group", fields: { name: "Book Club" } }]);
    expect(el.route!.path).toBe("/group/g9/edit");
    expect(content(el)).not.toContain("no longer exists");
    await changed(el, conn);
    expect(field(el, "name").value).toBe("Book Club");
  });

  it("household choices without a usable name add the members' first names", async () => {
    const s = withOkafors();
    s.households[1] = household("h2", null, ["p4", "p6"]);
    s.households.push(household("h3", null, ["p5"], { name_status: "not_a_household" }), household("h4", null, []));
    expect(householdChoiceLabel(s.households[0], s.people)).toBe("Marlow Family");
    expect(householdChoiceLabel(s.households[1], s.people)).toBe("Needs a name (Sam, Taylor)");
    expect(householdChoiceLabel(s.households[2], s.people)).toBe("Not a household (Casey)");
    expect(householdChoiceLabel(s.households[3], s.people)).toBe("Needs a name");

    const { el } = await mount("/person/p5/edit", {}, () => s);
    const options = [...root(el).querySelectorAll('#content [name="household_id"] option')].map((o) => o.textContent?.trim());
    expect(options).toContain("Needs a name (Sam, Taylor)");
    expect(options).toContain("Not a household (Casey)");
  });
});
