import { afterEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import type { GoogleReport, GoogleStatus, Snapshot } from "../src/types";
import { fakeConnection, sampleSnapshot, type FakeConnection, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

const root = (el: HearthPanel) => el.shadowRoot!;
const content = (el: HearthPanel) => (root(el).querySelector("#content")?.textContent ?? "").replace(/\s+/g, " ");
const button = (el: HearthPanel, label: string) =>
  [...root(el).querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === label);
const dialog = (el: HearthPanel) => root(el).querySelector<HTMLElement>('[role="alertdialog"]');
const dialogText = (el: HearthPanel) => (dialog(el)?.textContent ?? "").replace(/\s+/g, " ");
const dialogButton = (el: HearthPanel, label: string) =>
  [...(dialog(el)?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.textContent?.trim() === label);
const toggle = (el: HearthPanel) => root(el).querySelector<HTMLInputElement>("#google-enable")!;

function status(extra: Partial<GoogleStatus> = {}): GoogleStatus {
  return {
    connected: true, enabled: false, cutover_confirmed: true, running: false, last_run: null, last_error: null,
    counts: { synced: 4, pending: 2, skipped: 1, missing: 0, errors: 0 },
    ...extra,
  };
}

function report(extra: Partial<GoogleReport> = {}): GoogleReport {
  return {
    dry_run: false, started_at: "2026-11-08T10:00:00+00:00", created: 0, updated: 0, photos: 0, skipped: 0,
    missing: 0, errors: 0, pending: 0, stopped_reason: null, problems: [], would_create: [], would_update: 0,
    ...extra,
  };
}

let mounted: HearthPanel | null = null;
afterEach(() => {
  mounted?.remove();
  mounted = null;
});

async function mount(handlers: Record<string, Handler> = {}, path = "/settings", data: () => Snapshot = sampleSnapshot) {
  const conn = fakeConnection({
    "hearth_crm/crm/status": () => LOADED,
    "hearth_crm/snapshot": () => data(),
    "hearth_crm/google/status": () => status(),
    ...handlers,
  });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path };
  el.hass = { connection: conn, user: { id: "u1", name: "Test User" } };
  history.replaceState(null, "", `/hearth${path}`);
  document.body.appendChild(el);
  mounted = el;
  await settle(el);
  return { el, conn };
}

const sentOf = (conn: FakeConnection, type: string) => conn.sent.filter((m) => m.type === type);

describe("Google sync health in Settings", () => {
  it("shows how to connect when Google is not connected", async () => {
    const { el } = await mount({ "hearth_crm/google/status": () => status({ connected: false }) });
    expect(content(el)).toContain("It's optional");
    expect(content(el)).toContain("Settings → Devices & services → Hearth → Reconfigure");
    const link = root(el).querySelector<HTMLAnchorElement>('a[href="/config/integrations/integration/hearth_crm"]');
    expect(link).not.toBeNull();
    expect(root(el).querySelector("#google-enable")).toBeNull();
  });

  it("shows the counts, the last run and why it stopped", async () => {
    const last_run = report({ created: 3, updated: 2, stopped_reason: "rate_limited", pending: 5 });
    const { el } = await mount({ "hearth_crm/google/status": () => status({ enabled: true, last_run, last_error: "Google is unreachable" }) });
    expect(content(el)).toContain("4 synced, 2 waiting, 1 skipped");
    expect(content(el)).toContain("3 created, 2 updated");
    expect(content(el)).toContain("Google asked Hearth to slow down; it will continue on the next sweep.");
    expect(content(el)).toContain("The last run failed: Google is unreachable");
  });

  it("says when Google needs a new sign-in", async () => {
    const last_run = report({ stopped_reason: "auth" });
    const { el } = await mount({ "hearth_crm/google/status": () => status({ enabled: true, last_run }) });
    expect(content(el)).toContain("Google needs you to sign in again (Settings → Devices & services → Hearth).");
  });

  it("says when the connected Google account doesn't have these contacts", async () => {
    const last_run = report({ stopped_reason: "account_mismatch", pending: 6 });
    const { el } = await mount({ "hearth_crm/google/status": () => status({ enabled: true, last_run }) });
    expect(content(el)).toContain(
      "These contacts weren't found in the connected Google account. Is it the same account the contacts were first synced to? Nothing was changed.",
    );
  });

  it("says when the People API is off or Hearth lacks permission", async () => {
    const last_run = report({ stopped_reason: "api_disabled", pending: 4 });
    const { el } = await mount({ "hearth_crm/google/status": () => status({ enabled: true, last_run }) });
    expect(content(el)).toContain("The Google People API isn't enabled or Hearth lacks permission.");
  });

  it("says when a run stopped because the sync was switched off", async () => {
    const last_run = report({ created: 1, stopped_reason: "disabled", pending: 2 });
    const { el } = await mount({ "hearth_crm/google/status": () => status({ last_run }) });
    expect(content(el)).toContain("Stopped because the sync was switched off.");
    expect(content(el)).toContain("2 still to do");
  });

  it("the enable switch is disabled before cutover and says why", async () => {
    const { el } = await mount({ "hearth_crm/google/status": () => status({ cutover_confirmed: false }) });
    expect(toggle(el).disabled).toBe(true);
    expect(content(el)).toContain("Available once cutover is confirmed");
    expect(content(el)).toContain("Run the Hearth “Confirm cutover” action (Developer tools → Actions) once your import is final.");
    expect(toggle(el).getAttribute("aria-describedby")).toBe("google-enable-why");
    expect(root(el).querySelector("#google-enable-why")).not.toBeNull();
    // A preview is local only, so it stays available.
    expect(button(el, "Preview")!.disabled).toBe(false);
  });

  it("enabling asks first and sends set_enabled", async () => {
    let enabled = false;
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => status({ enabled }),
      "hearth_crm/google/set_enabled": (msg) => ((enabled = msg.enabled), status({ enabled })),
    });
    toggle(el).click();
    await settle(el);
    expect(dialogText(el)).toContain("Contacts will be created and updated in your Google account. Hearth never deletes a Google contact.");
    expect(sentOf(conn, "hearth_crm/google/set_enabled")).toEqual([]);
    expect(toggle(el).checked).toBe(false);

    dialogButton(el, "Turn on")!.click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/set_enabled")).toEqual([{ type: "hearth_crm/google/set_enabled", enabled: true }]);
    expect(dialog(el)).toBeNull();
    expect(toggle(el).checked).toBe(true);
  });

  it("cancelling the enable question sends nothing", async () => {
    const { el, conn } = await mount();
    toggle(el).click();
    await settle(el);
    dialogButton(el, "Cancel")!.click();
    await settle(el);
    expect(dialog(el)).toBeNull();
    expect(sentOf(conn, "hearth_crm/google/set_enabled")).toEqual([]);
  });

  it("turning it off needs no question", async () => {
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/set_enabled": () => status({ enabled: false }),
    });
    toggle(el).click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/set_enabled")).toEqual([{ type: "hearth_crm/google/set_enabled", enabled: false }]);
  });

  it("a refused enable shows the server's reason", async () => {
    const { el } = await mount({
      "hearth_crm/google/set_enabled": () => {
        throw { code: "cutover_not_confirmed", message: "Confirm cutover before switching on the Google sync, so test edits never reach Google." };
      },
    });
    toggle(el).click();
    await settle(el);
    dialogButton(el, "Turn on")!.click();
    await settle(el);
    expect(root(el).querySelector(".toast")?.textContent ?? content(el)).toContain("Confirm cutover before switching on the Google sync");
    expect(toggle(el).checked).toBe(false);
  });

  it("preview lists the people who would be created", async () => {
    const { el, conn } = await mount({
      "hearth_crm/google/preview": () => report({ dry_run: true, created: 2, updated: 3, skipped: 1, would_create: ["Robin Vale", "Sam Ortiz"], would_update: 3 }),
    });
    button(el, "Preview")!.click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/preview").length).toBe(1);
    expect(content(el)).toContain("Would create 2, update 3, skip 1");
    expect(content(el)).not.toContain("to upload");
    expect(content(el)).toContain("Robin Vale");
    expect(content(el)).toContain("Sam Ortiz");
  });

  it("preview says how many photos would be uploaded", async () => {
    const { el } = await mount({
      "hearth_crm/google/preview": () => report({ dry_run: true, created: 2, updated: 3, skipped: 1, photos: 4, would_create: ["Robin Vale", "Sam Ortiz"] }),
    });
    button(el, "Preview")!.click();
    await settle(el);
    expect(content(el)).toContain("Would create 2, update 3, skip 1, and 4 photos to upload");
  });

  it("the enable switch has no description once cutover is confirmed", async () => {
    const { el } = await mount();
    expect(toggle(el).hasAttribute("aria-describedby")).toBe(false);
    expect(root(el).querySelector("#google-enable-why")).toBeNull();
  });

  it("preview says how many more would be created than it lists", async () => {
    const { el } = await mount({
      "hearth_crm/google/preview": () => report({ dry_run: true, created: 205, would_create: ["Robin Vale", "Sam Ortiz"] }),
    });
    button(el, "Preview")!.click();
    await settle(el);
    expect(content(el)).toContain("and 203 more");
  });

  it("preview says nothing more when it lists everyone", async () => {
    const { el } = await mount({
      "hearth_crm/google/preview": () => report({ dry_run: true, created: 2, would_create: ["Robin Vale", "Sam Ortiz"] }),
    });
    button(el, "Preview")!.click();
    await settle(el);
    expect(root(el).querySelector("#google-preview-more")).toBeNull();
  });

  it("a failed sync frees the buttons again", async () => {
    const { el } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/sync_now": () => {
        throw { code: "sync_failed", message: "The Google sync failed unexpectedly (StorageError); it will try again." };
      },
    });
    const store = (el as unknown as { store: import("../src/store").Store }).store;
    button(el, "Sync now")!.click();
    await settle(el);
    expect(store.google.working).toBeNull();
    expect(button(el, "Sync now")!.disabled).toBe(false);
    expect(button(el, "Preview")!.disabled).toBe(false);
    expect(store.toast).toContain("StorageError");
  });

  it("a failed preview frees the buttons again", async () => {
    const { el } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/preview": () => {
        throw { code: "sync_failed", message: "The Google sync failed unexpectedly (StorageError); it will try again." };
      },
    });
    const store = (el as unknown as { store: import("../src/store").Store }).store;
    button(el, "Preview")!.click();
    await settle(el);
    expect(store.google.working).toBeNull();
    expect(button(el, "Preview")!.disabled).toBe(false);
    expect(button(el, "Sync now")!.disabled).toBe(false);
  });

  it("a second sync while one is working sends one request", async () => {
    let answer: (r: GoogleReport) => void = () => {};
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/sync_now": () => new Promise<GoogleReport>((resolve) => (answer = resolve)),
    });
    const store = (el as unknown as { store: import("../src/store").Store }).store;
    button(el, "Sync now")!.click();
    await settle(el);
    expect(button(el, "Syncing…")!.disabled).toBe(true);
    expect(await store.syncGoogleNow()).toBe(false);
    expect(await store.previewGoogle()).toBe(false);
    expect(sentOf(conn, "hearth_crm/google/sync_now").length).toBe(1);
    expect(sentOf(conn, "hearth_crm/google/preview")).toEqual([]);
    answer(report({ created: 1 }));
    await settle(el);
    expect(store.google.working).toBeNull();
    expect(content(el)).toContain("Sync finished: 1 created");
  });

  it("a reconnect frees a sync that never answered", async () => {
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/sync_now": () => new Promise<GoogleReport>(() => {}),
    });
    const store = (el as unknown as { store: import("../src/store").Store }).store;
    button(el, "Sync now")!.click();
    await settle(el);
    expect(store.google.working).toBe("sync");
    conn.fire("disconnected");
    conn.fire("ready");
    await settle(el);
    expect(store.google.working).toBeNull();
    expect(button(el, "Sync now")!.disabled).toBe(false);
  });

  it("a status load error after a load keeps the counts and says so", async () => {
    let fail = false;
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => {
        if (fail) throw { code: "unknown_error", message: "boom" };
        return status();
      },
    });
    expect(root(el).querySelector("#google-refresh-error")).toBeNull();
    fail = true;
    conn.push(1, { source: "sync", entity: "google", entity_id: null, action: "sync" });
    await settle(el);
    expect(content(el)).toContain("Couldn't refresh Google status");
    expect(content(el)).toContain("4 synced, 2 waiting, 1 skipped");
    fail = false;
    conn.push(1, { source: "sync", entity: "google", entity_id: null, action: "sync" });
    await settle(el);
    expect(root(el).querySelector("#google-refresh-error")).toBeNull();
  });

  it("sync now reports the outcome and the stop reason", async () => {
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/sync_now": () => report({ created: 4, updated: 1, pending: 7, stopped_reason: "rate_limited" }),
    });
    const before = sentOf(conn, "hearth_crm/google/status").length;
    button(el, "Sync now")!.click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/sync_now").length).toBe(1);
    expect(content(el)).toContain("Sync finished: 4 created, 1 updated, 7 still to do");
    expect(content(el)).toContain("Google asked Hearth to slow down");
    expect(sentOf(conn, "hearth_crm/google/status").length).toBeGreaterThan(before);
  });

  it("sync now is off until the sync is enabled", async () => {
    const { el } = await mount();
    expect(button(el, "Sync now")!.disabled).toBe(true);
  });

  it("a missing contact offers a new one after asking, and sends clear_contact", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.people[1] = { ...s.people[1], google_contact_id: "c/1", google_sync_error: "contact missing" };
      return s;
    };
    const { el, conn } = await mount({ "hearth_crm/google/clear_contact": () => null }, "/settings", data);
    expect(content(el)).toContain("Jordan Marlow");
    expect(content(el)).toContain("This contact was deleted in Google.");
    button(el, "Create a new contact")!.click();
    await settle(el);
    expect(dialogText(el)).toContain("A new contact will be created in Google. The old one is not touched.");
    expect(sentOf(conn, "hearth_crm/google/clear_contact")).toEqual([]);
    dialogButton(el, "Create new contact")!.click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/clear_contact")).toEqual([{ type: "hearth_crm/google/clear_contact", entity_id: "p2" }]);
  });

  it("an uncertain create asks with its own wording", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.people[1] = { ...s.people[1], google_sync_error: "create uncertain" };
      return s;
    };
    const { el, conn } = await mount({ "hearth_crm/google/clear_contact": () => null }, "/settings", data);
    button(el, "Create a new contact")!.click();
    await settle(el);
    expect(dialogText(el)).toContain(
      "Hearth couldn't confirm whether Google created this contact. Check Google Contacts for a stray copy first; a new one will be created.",
    );
    dialogButton(el, "Create new contact")!.click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/clear_contact").length).toBe(1);
  });

  it("a refused clear shows the server's message", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.people[1] = { ...s.people[1], google_contact_id: "c/1", google_sync_error: "contact missing" };
      return s;
    };
    const refusal = "Only a person whose Google contact is missing, or whose create is uncertain, can be given a new contact";
    const { el } = await mount(
      { "hearth_crm/google/clear_contact": () => { throw { code: "not_blocked", message: refusal }; } },
      "/settings",
      data,
    );
    const store = (el as unknown as { store: import("../src/store").Store }).store;
    expect(await store.clearGoogleContact("p2")).toBe(false);
    expect(store.toast).toBe(refusal);
  });

  it("other errors are listed without a new-contact button", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.people[1] = { ...s.people[1], google_contact_id: "c/1", google_sync_error: "Google said no (400)" };
      return s;
    };
    const { el } = await mount({}, "/settings", data);
    expect(content(el)).toContain("Google said no (400)");
    expect(button(el, "Create a new contact")).toBeUndefined();
  });

  it("refreshes health when a google change notice arrives", async () => {
    let counts = status().counts;
    const { el, conn } = await mount({ "hearth_crm/google/status": () => status({ counts }) });
    expect(content(el)).toContain("4 synced");
    counts = { synced: 9, pending: 0, skipped: 1, missing: 0, errors: 0 };
    const before = sentOf(conn, "hearth_crm/google/status").length;
    conn.push(1, { source: "sync", entity: "google", entity_id: null, action: "sync" });
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/status").length).toBe(before + 1);
    expect(content(el)).toContain("9 synced");
  });

  it("a notice about a record does not reload the Google status", async () => {
    const { el, conn } = await mount();
    const before = sentOf(conn, "hearth_crm/google/status").length;
    conn.push(1, { source: "panel", entity: "person", entity_id: "p1", action: "update" });
    await settle(el);
    expect(sentOf(conn, "hearth_crm/google/status").length).toBe(before);
  });

  it("writes are refused while offline", async () => {
    const { el, conn } = await mount({
      "hearth_crm/google/status": () => status({ enabled: true }),
      "hearth_crm/google/set_enabled": () => status(),
      "hearth_crm/google/sync_now": () => report(),
      "hearth_crm/google/preview": () => report({ dry_run: true }),
      "hearth_crm/google/clear_contact": () => null,
    });
    const store = (el as unknown as { store: import("../src/store").Store }).store;
    conn.fire("disconnected");
    expect(store.offline).toBe(true);
    expect(await store.setGoogleEnabled(false)).toBe(false);
    expect(await store.syncGoogleNow()).toBe(false);
    expect(await store.previewGoogle()).toBe(false);
    expect(await store.clearGoogleContact("p2")).toBe(false);
    for (const type of ["set_enabled", "sync_now", "preview", "clear_contact"]) {
      expect(sentOf(conn, `hearth_crm/google/${type}`)).toEqual([]);
    }
    expect(store.toast).toBe("You're offline. Changes are paused.");
  });

  it("the person screen shows the sync error", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.people[1] = { ...s.people[1], google_contact_id: "c/1", google_sync_error: "contact missing" };
      return s;
    };
    const { el } = await mount({}, "/person/p2", data);
    expect(content(el)).toContain("Google sync: This contact was deleted in Google.");
  });

  it("the person screen has no notice without an error", async () => {
    const { el } = await mount({}, "/person/p2");
    expect(root(el).querySelector(".google-error")).toBeNull();
  });
});
