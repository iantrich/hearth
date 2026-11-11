import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { href } from "../src/router";
import type { Snapshot } from "../src/types";
import { fakeConnection, reminder, sampleSnapshot, type Handler } from "./fixtures";

// sampleSnapshot's today is 2026-11-05. Sam (p4) has m1, due today 08:00; Casey (p5) has m2, someday.
const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

const root = (el: HearthPanel) => el.shadowRoot!;
const content = (el: HearthPanel) => (root(el).querySelector("#content")?.textContent ?? "").replace(/\s+/g, " ");

async function mount(data: () => Snapshot, handlers: Record<string, Handler> = {}) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => data(), ...handlers });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path: "/reach-out" };
  el.hass = { connection: conn, user: { id: "u1", name: "Test User" } };
  history.replaceState(null, "", "/hearth/reach-out");
  document.body.appendChild(el);
  await settle(el);
  return { el, conn };
}

const withReminders = () => {
  const s = sampleSnapshot();
  s.reminders = [
    reminder("a", "p1", { note: "Overdue thing", due_date: "2026-11-01", due_time: "09:00", state: "overdue", repeat_every: 2, repeat_unit: "week" }),
    reminder("m1", "p4", { note: "Ask about the new job", due_date: "2026-11-05", due_time: "08:00", state: "due_today" }),
    reminder("c", "p3", { note: "Soon thing", due_date: "2026-11-20", due_time: "08:00", state: "upcoming" }),
    reminder("m2", "p5", { note: "Send the trip photos", state: "someday" }),
    reminder("d", "p4", { note: "Finished thing", state: "done", done_at: "2026-11-02T10:00:00+00:00" }),
  ];
  return s;
};

beforeEach(() => {
  document.body.innerHTML = "";
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("Reminders on Reach out", () => {
  it("test_reach_out_shows_due_upcoming_and_someday_reminders_in_order", async () => {
    const s = withReminders();
    for (let i = 0; i < 11; i++) {
      s.reminders.push(reminder(`u${i}`, "p3", { note: `Later ${i}`, due_date: `2026-12-${String(10 + i).padStart(2, "0")}`, due_time: "08:00", state: "upcoming" }));
    }
    const { el } = await mount(() => s);
    const text = content(el);
    const at = (n: string) => text.indexOf(n);
    expect(at("Reminders")).toBeGreaterThan(-1);
    expect(text).toContain("Add reminder");
    expect(root(el).querySelector<HTMLAnchorElement>("#content a.pill")!.getAttribute("href")).toBe(href.newReminderAny());
    expect(root(el).querySelector('button[aria-label="Done: Overdue thing"]')).not.toBeNull();
    expect(at("Reminders")).toBeLessThan(at("CLOSE FRIEND ROTATION"));
    expect(at("Overdue thing")).toBeLessThan(at("Ask about the new job"));
    expect(at("Ask about the new job")).toBeLessThan(at("Soon thing"));
    expect(at("Soon thing")).toBeLessThan(at("Send the trip photos"));
    expect(text).toContain("Overdue · Nov 1 · Every 2 weeks");
    expect(text).toContain("Today 8:00 AM");
    expect(text).toContain("Alex Marlow");
    // At most 10 upcoming: "Soon thing" plus nine of the later ones.
    expect(text).toContain("Later 8");
    expect(text).not.toContain("Later 9");
    // Someday is collapsed until opened.
    const details = root(el).querySelector<HTMLDetailsElement>("details.someday")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.textContent).toContain("Someday");
    details.querySelector<HTMLElement>("summary")!.click();
    details.open = true;
    await settle(el);
    expect(details.querySelectorAll(".reminder-row")).toHaveLength(1);
    expect(root(el).querySelectorAll("#content .reminder-row .avatar").length).toBe(root(el).querySelectorAll("#content .reminder-row").length);
  });

  it("test_done_on_a_row_sends_complete_and_the_row_moves_on", async () => {
    let completed = false;
    const data = () => {
      const s = withReminders();
      if (completed) s.reminders = s.reminders.filter((r) => r.id !== "m1");
      return s;
    };
    const { el, conn } = await mount(data, {
      "hearth_crm/reminder/complete": () => {
        completed = true;
        return { reminder: {} };
      },
    });
    const row = [...root(el).querySelectorAll<HTMLElement>(".reminder-row")].find((r) => r.textContent!.includes("Ask about the new job"))!;
    [...row.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Done")!.click();
    await settle(el);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/reminder/complete")).toEqual([
      { type: "hearth_crm/reminder/complete", entity_id: "m1" },
    ]);
    expect(content(el)).not.toContain("Ask about the new job");
    expect(content(el)).toContain("Overdue thing");
  });

  it("test_a_done_reminder_is_not_listed", async () => {
    const { el } = await mount(withReminders);
    expect(content(el)).not.toContain("Finished thing");
  });

  it("test_reach_out_without_reminders_keeps_the_rotation_unchanged", async () => {
    const s = sampleSnapshot();
    s.reminders = [];
    const { el } = await mount(() => s);
    const text = content(el);
    expect(text).toContain("No reminders.");
    expect(root(el).querySelector<HTMLAnchorElement>("#content a.pill")!.getAttribute("href")).toBe(href.newReminderAny());
    expect(text).toContain("1 person overdue");
    expect(text).toContain("Sam Okafor");
    expect(root(el).querySelectorAll(".reminder-row")).toHaveLength(0);
    // The empty state only appears when there are no open reminders at all.
    const { el: el2 } = await mount(withReminders);
    expect(content(el2)).not.toContain("No reminders.");
  });

  it("test_tapping_a_row_opens_the_edit_sheet", async () => {
    const { el } = await mount(withReminders);
    const link = [...root(el).querySelectorAll<HTMLAnchorElement>(".reminder-row a.main")].find((a) => a.textContent!.includes("Soon thing"))!;
    expect(link.getAttribute("href")).toBe(href.reminder("c"));
  });
});
