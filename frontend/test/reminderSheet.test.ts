import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { href } from "../src/router";
import type { Snapshot } from "../src/types";
import { fakeConnection, interaction, reminder, sampleSnapshot, type Handler } from "./fixtures";

// sampleSnapshot's today is Thursday 2026-11-05. Sam (p4) has m1, due today at 08:00; Casey (p5) has m2, someday.
const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const WRITE_TYPES = ["hearth_crm/create", "hearth_crm/update", "hearth_crm/delete", "hearth_crm/reminder/complete"];

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

const root = (el: HearthPanel) => el.shadowRoot!;
let cleanups: (() => void)[] = [];

async function mount(path: string, data: () => Snapshot = sampleSnapshot, handlers: Record<string, Handler> = {}) {
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

const sheetEl = (el: HearthPanel) => root(el).querySelector<HTMLElement>('[role="dialog"]');
const sheetText = (el: HearthPanel) => (sheetEl(el)?.textContent ?? "").replace(/\s+/g, " ");
const content = (el: HearthPanel) => (root(el).querySelector("#content")?.textContent ?? "").replace(/\s+/g, " ");
const button = (el: HearthPanel, text: string, scope = '[role="dialog"]') =>
  [...root(el).querySelectorAll<HTMLButtonElement>(`${scope} button`)].find((b) => b.textContent?.trim() === text);

async function click(el: HearthPanel, text: string, scope?: string) {
  const b = button(el, text, scope);
  if (!b) throw new Error(`no button "${text}"`);
  b.click();
  await settle(el);
}

async function type(el: HearthPanel, selector: string, value: string) {
  const input = root(el).querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!input) throw new Error(`no field ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await settle(el);
}

async function choose(el: HearthPanel, selector: string, value: string) {
  const select = root(el).querySelector<HTMLSelectElement>(selector)!;
  select.value = value;
  select.dispatchEvent(new Event("change"));
  await settle(el);
}

async function pickPerson(el: HearthPanel, name: string) {
  [...root(el).querySelectorAll<HTMLButtonElement>(".picker-choice")].find((b) => b.textContent!.includes(name))!.click();
  await settle(el);
}

/** Create answers with an id per kind, so a test can tell the interaction's from the reminder's. */
const creates: Record<string, Handler> = {
  "hearth_crm/create": (msg) => ({ id: msg.kind === "interaction" ? "inew" : "mnew" }),
};

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  for (const c of cleanups) c();
  cleanups = [];
  document.body.innerHTML = "";
});

describe("reminder sheet", () => {
  it("test_new_reminder_from_a_profile_sends_the_person_and_a_naive_local_time", async () => {
    const { el, writes } = await mount("/person/p4/reminder/new", sampleSnapshot, creates);
    expect(sheetEl(el)!.getAttribute("aria-label")).toBe("Add reminder");
    // Opened from Sam's screen: Sam is preset and can't be changed.
    expect(sheetText(el)).toContain("Sam Okafor");
    expect(root(el).querySelector("#reminder-person")).toBeNull();
    expect(button(el, "Save")!.disabled).toBe(true);
    const picks = [...root(el).querySelectorAll('[role="dialog"] .pill')].map((p) => p.textContent!.trim());
    expect(picks).toEqual(["Tomorrow", "Next week", "In a month", "In a quarter", "In a year", "Someday", "Custom"]);

    await type(el, '[role="dialog"] textarea[name="note"]', "Ask about the move");
    await click(el, "Tomorrow");
    expect(button(el, "Save")!.disabled).toBe(false);
    await click(el, "Save");

    expect(writes()).toEqual([
      { type: "hearth_crm/create", kind: "reminder", fields: { person_id: "p4", due_at: "2026-11-06T08:00", note: "Ask about the move" } },
    ]);
    expect(location.pathname).toBe("/hearth/person/p4");
    expect(sheetEl(el)).toBeNull();
  });

  it("test_someday_sends_no_due_time", async () => {
    const { el, writes } = await mount("/person/p4/reminder/new", sampleSnapshot, creates);
    await click(el, "Someday");
    // Someday has no date, so the custom fields stay hidden.
    expect(root(el).querySelector('[role="dialog"] input[name="date"]')).toBeNull();
    await click(el, "Save");
    expect(writes()).toEqual([{ type: "hearth_crm/create", kind: "reminder", fields: { person_id: "p4", due_at: null } }]);
  });

  it("test_custom_repeat_sends_every_and_unit_together", async () => {
    const { el, writes } = await mount("/person/p4/reminder/new", sampleSnapshot, creates);
    await click(el, "Custom");
    expect(root(el).querySelector<HTMLInputElement>('[role="dialog"] input[name="time"]')!.value).toBe("08:00");
    const repeat = root(el).querySelector<HTMLSelectElement>('[role="dialog"] select[name="repeat_unit"]')!;
    expect([...repeat.options].map((o) => o.textContent!.trim())[0]).toBe("Doesn't repeat");
    // No date yet: nothing to save.
    expect(button(el, "Save")!.disabled).toBe(true);

    await type(el, '[role="dialog"] input[name="date"]', "2026-12-08");
    await choose(el, '[role="dialog"] select[name="repeat_unit"]', "week");
    await type(el, '[role="dialog"] input[name="repeat_every"]', "2");
    expect(sheetText(el)).toContain("Every 2 weeks");
    await click(el, "Save");

    expect(writes()).toEqual([
      {
        type: "hearth_crm/create",
        kind: "reminder",
        fields: { person_id: "p4", due_at: "2026-12-08T08:00", repeat_every: 2, repeat_unit: "week" },
      },
    ]);
  });

  it("test_save_is_disabled_without_a_person", async () => {
    // An interaction whose people are all gone: nobody to preset, so the sheet offers a picker.
    const data = () => {
      const s = sampleSnapshot();
      s.interactions.push(interaction("iz", "Old trip planning", "2026-08-01", []));
      return s;
    };
    const { el, writes } = await mount("/interaction/iz/reminder/new", data, creates);
    await click(el, "Tomorrow");
    expect(root(el).querySelector("#reminder-person")).not.toBeNull();
    expect(button(el, "Save")!.disabled).toBe(true);

    await type(el, "#reminder-person", "Taylor");
    await pickPerson(el, "Taylor Brandt");
    expect(button(el, "Save")!.disabled).toBe(false);
    expect(sheetText(el)).toContain("From: Old trip planning");
    await click(el, "Save");
    expect(writes()).toEqual([
      { type: "hearth_crm/create", kind: "reminder", fields: { person_id: "p6", due_at: "2026-11-06T08:00", interaction_id: "iz" } },
    ]);
    expect(location.pathname).toBe("/hearth/interaction/iz");
  });

  it("from an interaction the person is preset to its first person and can be changed", async () => {
    const { el, writes } = await mount("/interaction/i1/reminder/new", sampleSnapshot, creates);
    // i1 is with Alex and Jordan: Alex is chosen to start with.
    expect(root(el).querySelectorAll('[role="dialog"] .person-picker .chip')).toHaveLength(1);
    expect(root(el).querySelector('[role="dialog"] .person-picker .chip')!.textContent).toContain("Alex Marlow");
    await type(el, "#reminder-person", "Taylor");
    await pickPerson(el, "Taylor Brandt");
    expect(root(el).querySelector('[role="dialog"] .person-picker .chip')!.textContent).toContain("Taylor Brandt");
    await click(el, "Tomorrow");
    await click(el, "Save");
    expect(writes()).toEqual([
      { type: "hearth_crm/create", kind: "reminder", fields: { person_id: "p6", due_at: "2026-11-06T08:00", interaction_id: "i1" } },
    ]);
  });

  it("test_editing_sends_only_changed_fields", async () => {
    const { el, writes } = await mount("/reminder/m1", sampleSnapshot, { "hearth_crm/update": () => ({}) });
    expect(sheetEl(el)!.getAttribute("aria-label")).toBe("Edit reminder");
    expect(sheetText(el)).toContain("Sam Okafor");
    // Its due time opens as Custom, in Home Assistant's zone as the snapshot gives it.
    expect(root(el).querySelector<HTMLInputElement>('[role="dialog"] input[name="date"]')!.value).toBe("2026-11-05");
    expect(root(el).querySelector<HTMLInputElement>('[role="dialog"] input[name="time"]')!.value).toBe("08:00");

    await type(el, '[role="dialog"] textarea[name="note"]', "Ask about the new job and the move");
    await click(el, "Save");
    expect(writes()).toEqual([
      { type: "hearth_crm/update", kind: "reminder", entity_id: "m1", changes: { note: "Ask about the new job and the move" } },
    ]);
  });

  it("test_delete_asks_first", async () => {
    const { el, writes } = await mount("/reminder/m1", sampleSnapshot, { "hearth_crm/delete": () => ({}) });
    await click(el, "Delete reminder");
    expect(writes()).toEqual([]);
    expect(root(el).querySelector('[role="alertdialog"]')!.textContent).toContain("Ask about the new job");

    await click(el, "Cancel", '[role="alertdialog"]');
    expect(root(el).querySelector('[role="alertdialog"]')).toBeNull();
    expect(writes()).toEqual([]);

    await click(el, "Delete reminder");
    await click(el, "Delete", '[role="alertdialog"]');
    expect(writes()).toEqual([{ type: "hearth_crm/delete", kind: "reminder", entity_id: "m1" }]);
    expect(sheetEl(el)).toBeNull();
  });

  it("test_the_edit_sheet_for_a_reminder_deleted_elsewhere_shows_the_not_found_state", async () => {
    let deleted = false;
    const data = () => {
      const s = sampleSnapshot();
      return deleted ? { ...s, reminders: s.reminders.filter((r) => r.id !== "m1") } : s;
    };
    const { el } = await mount("/reminder/m1", data);
    expect(sheetEl(el)).not.toBeNull();
    deleted = true;
    // A change made elsewhere: the panel refetches.
    root(el).querySelector<HTMLButtonElement>('button[aria-label="Refresh"]')!.click();
    await settle(el);
    expect(sheetEl(el)).toBeNull();
    expect(content(el)).toContain("This reminder no longer exists.");
  });
});

describe("log sheet reminders", () => {
  it("test_the_log_sheet_creates_the_interaction_then_the_linked_reminder", async () => {
    const { el, writes } = await mount("/person/p4/log", sampleSnapshot, creates);
    await type(el, "#log-summary", "Lunch downtown");
    await click(el, "Add reminder");
    await type(el, '[role="dialog"] textarea[name="note"]', "Send the restaurant name");
    await click(el, "Next week");
    await click(el, "Save");

    expect(writes()).toEqual([
      {
        type: "hearth_crm/create",
        kind: "interaction",
        fields: { person_ids: ["p4"], type: "Call", date: "2026-11-05", summary: "Lunch downtown", notes: null },
      },
      {
        type: "hearth_crm/create",
        kind: "reminder",
        fields: { person_id: "p4", interaction_id: "inew", due_at: "2026-11-09T08:00", note: "Send the restaurant name" },
      },
    ]);
    expect(location.pathname).toBe("/hearth/person/p4");
  });

  it("the log sheet's reminder is for the interaction's person to start with and can be changed", async () => {
    const { el, writes } = await mount("/person/p4/log", sampleSnapshot, creates);
    await type(el, "#log-summary", "Lunch downtown");
    await click(el, "Add reminder");
    expect(root(el).querySelector('[role="dialog"] .person-picker .chip')!.textContent).toContain("Sam Okafor");
    await type(el, "#log-reminder-person", "Casey");
    await pickPerson(el, "Casey Lindqvist");
    await click(el, "Someday");
    await click(el, "Save");
    expect(writes()).toEqual([
      {
        type: "hearth_crm/create",
        kind: "interaction",
        fields: { person_ids: ["p4"], type: "Call", date: "2026-11-05", summary: "Lunch downtown", notes: null },
      },
      { type: "hearth_crm/create", kind: "reminder", fields: { person_id: "p5", interaction_id: "inew", due_at: null } },
    ]);
  });

  it("the log sheet's reminder needs someone", async () => {
    const { el } = await mount("/person/p4/log", sampleSnapshot, creates);
    await type(el, "#log-summary", "Lunch downtown");
    await click(el, "Add reminder");
    await click(el, "Tomorrow");
    expect(button(el, "Save")!.disabled).toBe(false);
    root(el).querySelector<HTMLButtonElement>('[role="dialog"] .chip-remove')!.click();
    await settle(el);
    expect(button(el, "Save")!.disabled).toBe(true);
  });

  it("logging without a reminder sends only the interaction", async () => {
    const { el, writes } = await mount("/person/p4/log", sampleSnapshot, creates);
    await type(el, "#log-summary", "Lunch downtown");
    await click(el, "Add reminder");
    await click(el, "Remove reminder");
    await click(el, "Save");
    expect(writes().map((w) => w.kind)).toEqual(["interaction"]);
  });

  it("editing an interaction links Add reminder to the interaction's reminder sheet", async () => {
    const { el } = await mount("/interaction/i1/edit");
    const link = [...root(el).querySelectorAll<HTMLAnchorElement>('[role="dialog"] a')].find((a) => a.textContent?.trim() === "Add reminder");
    expect(link?.getAttribute("href")).toBe(href.newInteractionReminder("i1"));
  });
});

describe("where reminders show", () => {
  it("test_the_person_screen_lists_only_their_open_reminders_with_a_done_control", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.reminders.push(reminder("m3", "p4", { note: "Return the tent", state: "done", done_at: "2026-11-01T10:00:00+00:00" }));
      return s;
    };
    const { el, writes } = await mount("/person/p4", data, { "hearth_crm/reminder/complete": () => ({ reminder: {} }) });
    const add = root(el).querySelector<HTMLAnchorElement>('a[aria-label="Add reminder"]');
    expect(add?.getAttribute("href")).toBe(href.newReminder("p4"));

    const rows = [...root(el).querySelectorAll<HTMLElement>(".reminder-row")];
    expect(rows).toHaveLength(1);
    expect(content(el)).toContain("Reminders");
    expect(rows[0].textContent).toContain("Ask about the new job");
    expect(rows[0].querySelector("a")!.getAttribute("href")).toBe(href.reminder("m1"));
    expect(content(el)).not.toContain("Return the tent");
    expect(content(el)).not.toContain("Send the trip photos");

    await click(el, "Done", ".reminder-row");
    expect(writes()).toEqual([{ type: "hearth_crm/reminder/complete", entity_id: "m1" }]);
  });

  it("test_the_interaction_screen_lists_its_linked_reminders", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.reminders.push(reminder("m4", "p4", { note: "Book the next dinner", interaction_id: "i3", state: "someday" }));
      return s;
    };
    const { el } = await mount("/interaction/i3", data);
    const rows = [...root(el).querySelectorAll<HTMLElement>(".reminder-row")];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Book the next dinner");
    expect(rows[0].querySelector("a")!.getAttribute("href")).toBe(href.reminder("m4"));
    // Reminders not linked to it aren't listed.
    expect(content(el)).not.toContain("Ask about the new job");
  });
});
