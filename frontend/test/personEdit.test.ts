import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { href, parseRoute } from "../src/router";
import type { Snapshot } from "../src/types";
import { fakeConnection, group, interaction, person, relationship, reminder, sampleSnapshot, type Handler } from "./fixtures";

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

const root = (el: HearthPanel) => el.shadowRoot!;
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
  root(el).querySelector<HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement>(`#content [name="${name}"]`)!;

function type(el: HearthPanel, name: string, value: string) {
  const input = field(el, name);
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function check(el: HearthPanel, name: string, checked: boolean) {
  const input = field(el, name);
  input.checked = checked;
  input.dispatchEvent(new Event("change"));
}

function choose(el: HearthPanel, name: string, value: string) {
  const select = field(el, name);
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

const button = (el: HearthPanel, text: string, scope = "") =>
  [...root(el).querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === text);

async function save(el: HearthPanel) {
  button(el, "Save", "#content")!.click();
  await settle(el);
}

/** Sam (p4) with a bit of everything, and a second group he isn't in. */
function samSnapshot(): Snapshot {
  const s = sampleSnapshot();
  s.people[3] = person("p4", "Sam Okafor", {
    phone: "555-0101", close_friend: true, occupation: "Teacher",
    address: { formatted: "4 Oak Rd, Springfield", city: "Springfield" },
  });
  s.groups.push(group("g2", "Book Club", ["p2"]));
  return s;
}

describe("routes", () => {
  it("/person/<id>/edit is the person edit screen", () => {
    expect(href.editPerson("a b")).toBe("/hearth/person/a%20b/edit");
    expect(parseRoute("/person/a%20b/edit")).toEqual({ name: "personEdit", id: "a b" });
    // The log sheet route is unchanged.
    expect(parseRoute("/person/p1/log")).toEqual({ name: "person", id: "p1", sheet: "log" });
  });
});

describe("edit a person", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/hearth");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    cleanups.forEach((c) => c());
    cleanups = [];
  });

  it("the person screen has an Edit action and a tappable photo", async () => {
    const { el } = await mount("/person/p4", {}, samSnapshot);
    const edit = root(el).querySelector<HTMLAnchorElement>('a[aria-label="Edit"]');
    expect(edit?.getAttribute("href")).toBe("/hearth/person/p4/edit");
    const photo = root(el).querySelector('#content label.photo-tap[aria-label="Add photo"] input[type="file"]');
    expect(photo).toBeTruthy();
  });

  it("shows every field in its section, filled from the snapshot", async () => {
    const { el } = await mount("/person/p4/edit", {}, samSnapshot);
    const names = [...root(el).querySelectorAll("#content [name]")].map((n) => n.getAttribute("name"));
    for (const name of [
      "name", "how_i_know_them", "occupation", "employer", "phone", "phone2", "email", "email2", "birthday",
      "favorite", "close_friend", "address", "school", "website", "linkedin", "facebook",
      "instagram", "notes", "relationship_summary", "household_id",
    ]) expect(names).toContain(name);
    expect(names).not.toContain("summary_updated");
    expect(field(el, "name").value).toBe("Sam Okafor");
    expect(field(el, "address").value).toBe("4 Oak Rd, Springfield");
    expect(field(el, "close_friend").checked).toBe(true);
    const sections = [...root(el).querySelectorAll("#content .form-section")].map((n) => n.textContent?.trim());
    expect(sections).toEqual(["Photo", "Basics", "Contact", "Dates", "Flags", "Places", "Links", "Notes and summary", "Household", "Groups"]);
    // Groups are a multi-select: one box per group, Sam's ticked.
    expect(root(el).querySelector<HTMLInputElement>('#content input[data-group="g1"]')!.checked).toBe(true);
    expect(root(el).querySelector<HTMLInputElement>('#content input[data-group="g2"]')!.checked).toBe(false);
    const households = [...field(el, "household_id").querySelectorAll("option")].map((o) => [o.value, o.textContent?.trim()]);
    expect(households).toEqual([["", "None"], ["h1", "Marlow Family"], ["new", "New household…"]]);
  });

  it("edit saves only what changed in one update", async () => {
    const { el, writes } = await mount("/person/p4/edit", { "hearth_crm/update": () => ({}) }, samSnapshot);
    type(el, "occupation", "Head teacher");
    type(el, "phone2", " 555-0199 ");
    type(el, "phone", "555-0101");
    check(el, "close_friend", false);
    await settle(el);
    await save(el);
    expect(writes()).toEqual([
      {
        type: "hearth_crm/update", kind: "person", entity_id: "p4",
        changes: { occupation: "Head teacher", phone2: "555-0199", close_friend: false },
      },
    ]);
    // Saved: back to Sam's screen.
    expect(el.route!.path).toBe("/person/p4");
  });

  it("clearing the address sends null; changing it sends the new text only", async () => {
    const { el, writes } = await mount("/person/p4/edit", { "hearth_crm/update": () => ({}) }, samSnapshot);
    type(el, "address", "");
    type(el, "school", "Springfield High");
    await settle(el);
    await save(el);
    expect(writes()[0].changes).toEqual({ address: null, school: { formatted: "Springfield High" } });
  });

  it("clearing the birthday also clears year unknown", async () => {
    const data = () => {
      const s = samSnapshot();
      s.people[3] = { ...s.people[3], birthday: "1990-06-02", birth_year_unknown: true };
      return s;
    };
    const { el, writes } = await mount("/person/p4/edit", { "hearth_crm/update": () => ({}) }, data);
    expect(field(el, "birth_year_unknown").checked).toBe(true);
    type(el, "birthday", "");
    await settle(el);
    expect(field(el, "birth_year_unknown")).toBeNull();
    await save(el);
    expect(writes()[0].changes).toEqual({ birthday: null, birth_year_unknown: false });
  });

  it("moving to a new household creates it then sets household_id", async () => {
    const { el, writes } = await mount(
      "/person/p4/edit",
      { "hearth_crm/create": () => ({ id: "h9" }), "hearth_crm/update": () => ({}) },
      samSnapshot,
    );
    choose(el, "household_id", "new");
    await settle(el);
    await save(el);
    expect(writes()).toEqual([
      { type: "hearth_crm/create", kind: "household", fields: {} },
      { type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { household_id: "h9" } },
    ]);
    expect(el.route!.path).toBe("/person/p4");
  });

  it("a failed save after the new household was made reuses it on the next try", async () => {
    let fail = true;
    const { el, writes } = await mount(
      "/person/p4/edit",
      {
        "hearth_crm/create": () => ({ id: "h9" }),
        "hearth_crm/update": () => {
          if (fail) throw { code: "unknown_error", message: "disk full" };
          return {};
        },
      },
      samSnapshot,
    );
    choose(el, "household_id", "new");
    await settle(el);
    await save(el);
    expect(el.route!.path).toBe("/person/p4/edit");
    fail = false;
    await save(el);
    expect(writes().filter((m) => m.type === "hearth_crm/create")).toHaveLength(1);
    expect(writes().at(-1)).toMatchObject({ type: "hearth_crm/update", changes: { household_id: "h9" } });
  });

  it("choosing None or another household sets household_id", async () => {
    const { el, writes } = await mount("/person/p1/edit", { "hearth_crm/update": () => ({}) });
    expect(field(el, "household_id").value).toBe("h1");
    choose(el, "household_id", "");
    await settle(el);
    await save(el);
    expect(writes()).toEqual([{ type: "hearth_crm/update", kind: "person", entity_id: "p1", changes: { household_id: null } }]);
  });

  it("group changes send set_members with each changed group's full list", async () => {
    const { el, writes } = await mount(
      "/person/p4/edit",
      { "hearth_crm/update": () => ({}), "hearth_crm/group/set_members": () => ({}) },
      samSnapshot,
    );
    const box = (id: string) => root(el).querySelector<HTMLInputElement>(`#content input[data-group="${id}"]`)!;
    box("g1").checked = false;
    box("g1").dispatchEvent(new Event("change"));
    box("g2").checked = true;
    box("g2").dispatchEvent(new Event("change"));
    await settle(el);
    await save(el);
    // Nothing else changed, so no person update; one set_members per changed group.
    expect(writes()).toEqual([
      { type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p5"] },
      { type: "hearth_crm/group/set_members", group_id: "g2", person_ids: ["p2", "p4"] },
    ]);
    expect(el.route!.path).toBe("/person/p4");
  });

  it("person fields go first, then groups, and a failure keeps the form open", async () => {
    const { el, writes } = await mount(
      "/person/p4/edit",
      {
        "hearth_crm/update": () => ({}),
        "hearth_crm/group/set_members": () => {
          throw { code: "unknown_error", message: "disk full" };
        },
      },
      samSnapshot,
    );
    type(el, "employer", "Springfield Schools");
    const g2 = root(el).querySelector<HTMLInputElement>('#content input[data-group="g2"]')!;
    g2.checked = true;
    g2.dispatchEvent(new Event("change"));
    await settle(el);
    await save(el);
    expect(writes().map((m) => m.type)).toEqual(["hearth_crm/update", "hearth_crm/group/set_members"]);
    expect(el.route!.path).toBe("/person/p4/edit");
    expect(field(el, "employer").value).toBe("Springfield Schools");
  });

  it("a name is required", async () => {
    const { el, writes } = await mount("/person/p4/edit", {}, samSnapshot);
    type(el, "name", "   ");
    await settle(el);
    expect(button(el, "Save", "#content")!.disabled).toBe(true);
    expect(root(el).querySelector('[data-error-for="name"]')?.textContent?.trim()).toBe("Enter a name.");
    button(el, "Save", "#content")!.click();
    await settle(el);
    expect(writes()).toEqual([]);
  });

  it("an invalid field from the server shows under that field", async () => {
    const { el } = await mount(
      "/person/p4/edit",
      {
        "hearth_crm/update": () => {
          throw { code: "invalid", message: "phone2: is longer than 50 characters" };
        },
      },
      samSnapshot,
    );
    type(el, "phone2", "5".repeat(40));
    await settle(el);
    await save(el);
    expect(el.route!.path).toBe("/person/p4/edit");
    expect(root(el).querySelector('[data-error-for="phone2"]')?.textContent?.trim()).toBe("is longer than 50 characters");
    expect(field(el, "phone2").getAttribute("aria-invalid")).toBe("true");
    expect(root(el).querySelector('[data-error-for="phone"]')).toBeNull();
  });

  it("saving a person deleted elsewhere shows the deleted toast and the not-found screen", async () => {
    let deleted = false;
    const { el } = await mount(
      "/person/p4/edit",
      {
        "hearth_crm/update": () => {
          deleted = true;
          throw { code: "not_found", message: "person 'p4' does not exist" };
        },
      },
      () => {
        const s = samSnapshot();
        return deleted ? { ...s, people: s.people.filter((p) => p.id !== "p4") } : s;
      },
    );
    type(el, "occupation", "Principal");
    await settle(el);
    await save(el);
    expect(root(el).querySelector(".toast")?.textContent).toContain("That was already deleted.");
    expect(root(el).querySelector("#content")?.textContent).toContain("This person no longer exists.");
  });

  it("the photo picker is on the edit screen", async () => {
    const { el } = await mount("/person/p4/edit", {}, samSnapshot);
    expect(root(el).querySelector('#content .photo-picker input[type="file"]')).toBeTruthy();
  });

  it("delete confirmation counts what goes with the person", async () => {
    const data = () => {
      const s = samSnapshot();
      s.relationships.push(relationship("r2", "p4", "p5", "Friend"), relationship("r3", "p6", "p4", "Friend"));
      s.interactions.push(interaction("i4", "Hike up the ridge", "2026-10-01", ["p4", "p6"]));
      return s;
    };
    const { el, writes } = await mount("/person/p4/edit", { "hearth_crm/delete": () => ({}) }, data);
    button(el, "Delete person", "#content")!.click();
    await settle(el);
    const dialog = root(el).querySelector('[role="alertdialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("Delete Sam Okafor?");
    expect(dialog.textContent).toContain(
      "Also removes 2 relationships and 1 group membership. 1 interaction with only them is deleted; 1 shared interaction keeps the other people.",
    );
    button(el, "Delete", '[role="alertdialog"]')!.click();
    await settle(el);
    expect(writes()).toEqual([{ type: "hearth_crm/delete", kind: "person", entity_id: "p4" }]);
    expect(el.route!.path).toBe("");
  });

  it("the delete sentence uses plurals for counts other than one", async () => {
    const data = () => {
      const s = samSnapshot();
      s.groups = [group("g1", "Trail Crew", ["p1", "p5"])];
      s.interactions.push(
        interaction("i4", "Hike", "2026-10-01", ["p4", "p6"]),
        interaction("i5", "Lunch", "2026-10-02", ["p4", "p1"]),
        interaction("i6", "Call", "2026-10-03", ["p4"]),
      );
      return s;
    };
    const { el } = await mount("/person/p4/edit", {}, data);
    button(el, "Delete person", "#content")!.click();
    await settle(el);
    expect(root(el).querySelector('[role="alertdialog"]')!.textContent).toContain(
      "Also removes 0 relationships and 0 group memberships. 2 interactions with only them are deleted; 2 shared interactions keep the other people.",
    );
    // Cancel closes it and sends nothing.
    button(el, "Cancel", '[role="alertdialog"]')!.click();
    await settle(el);
    expect(root(el).querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("test_delete_person_warns_about_their_reminders", async () => {
    const warn = async (reminders: number) => {
      const data = () => {
        const s = samSnapshot();
        s.reminders = Array.from({ length: reminders }, (_, i) => reminder(`n${i}`, "p4", { note: `Note ${i}` }));
        return s;
      };
      const { el } = await mount("/person/p4/edit", {}, data);
      button(el, "Delete person", "#content")!.click();
      await settle(el);
      return root(el).querySelector('[role="alertdialog"]')!.textContent!;
    };
    expect(await warn(1)).toContain("keep the other people. 1 reminder about them is deleted.");
    expect(await warn(3)).toContain("3 reminders about them are deleted.");
    expect(await warn(0)).not.toContain("reminder");
  });

  it("the delete confirmation says when they leave their household", async () => {
    const { el } = await mount("/person/p2/edit", {}, samSnapshot);
    button(el, "Delete person", "#content")!.click();
    await settle(el);
    const lines = [...root(el).querySelectorAll('[role="alertdialog"] .muted')].map((n) => n.textContent?.trim());
    expect(lines).toContain("They leave Marlow Family.");
    document.body.innerHTML = "";

    // Sam has no household, so no such line.
    const sam = await mount("/person/p4/edit", {}, samSnapshot);
    button(sam.el, "Delete person", "#content")!.click();
    await settle(sam.el);
    expect(root(sam.el).querySelector('[role="alertdialog"]')!.textContent).not.toContain("They leave");
  });

  it("a person who no longer exists shows the not-found screen", async () => {
    const { el } = await mount("/person/nobody/edit");
    expect(root(el).querySelector("#content")?.textContent).toContain("This person no longer exists.");
  });
});
