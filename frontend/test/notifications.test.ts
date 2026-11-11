import { afterEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import type { NotificationsStatus, Snapshot } from "../src/types";
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
const input = (el: HearthPanel, id: string) => root(el).querySelector<HTMLInputElement>(`#${id}`)!;
const sentOf = (conn: FakeConnection, type: string) => conn.sent.filter((m) => m.type === type);

function status(extra: Partial<NotificationsStatus> = {}): NotificationsStatus {
  return {
    settings: { birthdays: { enabled: false, time: "09:00" }, log_reminder: { enabled: true, time: "20:00" } },
    devices: 1,
    ...extra,
  };
}

let mounted: HearthPanel | null = null;
afterEach(() => {
  mounted?.remove();
  mounted = null;
});

async function mount(handlers: Record<string, Handler> = {}, data: () => Snapshot = sampleSnapshot) {
  const conn = fakeConnection({
    "hearth_crm/crm/status": () => LOADED,
    "hearth_crm/snapshot": () => data(),
    "hearth_crm/google/status": () => ({
      connected: false, enabled: false, cutover_confirmed: false, running: false, last_run: null, last_error: null,
      counts: { synced: 0, pending: 0, skipped: 0, missing: 0, errors: 0 },
    }),
    "hearth_crm/notifications/get": () => status(),
    ...handlers,
  });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path: "/settings" };
  el.hass = { connection: conn, user: { id: "u1", name: "Test User" } };
  history.replaceState(null, "", "/hearth/settings");
  document.body.appendChild(el);
  mounted = el;
  await settle(el);
  return { el, conn };
}

describe("Notifications in Settings", () => {
  it("shows each notification's switch and time", async () => {
    const { el } = await mount();
    expect(content(el)).toContain("Birthdays");
    expect(content(el)).toContain("Log reminder");
    expect(input(el, "notify-birthdays").checked).toBe(false);
    expect(input(el, "notify-birthdays-time").value).toBe("09:00");
    expect(input(el, "notify-log").checked).toBe(true);
    expect(input(el, "notify-log-time").value).toBe("20:00");
    expect(root(el).querySelector("#notify-no-phone")).toBeNull();
  });

  it("turning one on sends only that change and shows what the server answers", async () => {
    const { el, conn } = await mount({
      "hearth_crm/notifications/set": () =>
        status({ settings: { birthdays: { enabled: true, time: "09:00" }, log_reminder: { enabled: true, time: "20:00" } } }),
    });
    const box = input(el, "notify-birthdays");
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    await settle(el);
    expect(sentOf(conn, "hearth_crm/notifications/set")).toEqual([
      { type: "hearth_crm/notifications/set", changes: { birthdays: { enabled: true } } },
    ]);
    expect(input(el, "notify-birthdays").checked).toBe(true);
  });

  it("changing a time sends it; clearing the field sends nothing", async () => {
    const { el, conn } = await mount({
      "hearth_crm/notifications/set": () =>
        status({ settings: { birthdays: { enabled: false, time: "09:00" }, log_reminder: { enabled: true, time: "21:15" } } }),
    });
    const time = input(el, "notify-log-time");
    time.value = "";
    time.dispatchEvent(new Event("change"));
    await settle(el);
    expect(sentOf(conn, "hearth_crm/notifications/set")).toHaveLength(0);
    time.value = "21:15";
    time.dispatchEvent(new Event("change"));
    await settle(el);
    expect(sentOf(conn, "hearth_crm/notifications/set")).toEqual([
      { type: "hearth_crm/notifications/set", changes: { log_reminder: { time: "21:15" } } },
    ]);
    expect(input(el, "notify-log-time").value).toBe("21:15");
  });

  it("a refused change keeps the old value and says why", async () => {
    const { el } = await mount({
      "hearth_crm/notifications/set": () => {
        throw { code: "invalid", message: "birthdays.time: must be a time such as 09:30" };
      },
    });
    const time = input(el, "notify-birthdays-time");
    time.value = "07:00";
    time.dispatchEvent(new Event("change"));
    await settle(el);
    expect(input(el, "notify-birthdays-time").value).toBe("09:00");
    expect((el as unknown as { store: { toast: string } }).store.toast).toContain("must be a time");
  });

  it("with no phone it says so and the test button is off", async () => {
    const { el } = await mount({ "hearth_crm/notifications/get": () => status({ devices: 0 }) });
    expect(content(el)).toContain("No phone is set up for notifications");
    expect(root(el).querySelector<HTMLButtonElement>("#notify-test")!.disabled).toBe(true);
  });

  it("the test button sends a test and says to check the phone", async () => {
    const { el, conn } = await mount({ "hearth_crm/notifications/test": () => ({ sent: 1 }) });
    root(el).querySelector<HTMLButtonElement>("#notify-test")!.click();
    await settle(el);
    expect(sentOf(conn, "hearth_crm/notifications/test")).toHaveLength(1);
    expect((el as unknown as { store: { toast: string } }).store.toast).toBe("Test sent. Check your phone.");
  });

  it("a refused test shows the server's own explanation", async () => {
    const { el } = await mount({
      "hearth_crm/notifications/test": () => {
        throw { code: "no_phone", message: "No phone is set up for notifications." };
      },
    });
    root(el).querySelector<HTMLButtonElement>("#notify-test")!.click();
    await settle(el);
    expect((el as unknown as { store: { toast: string } }).store.toast).toBe("No phone is set up for notifications.");
  });

  it("shows why the settings could not load", async () => {
    const { el } = await mount({
      "hearth_crm/notifications/get": () => {
        throw { code: "unknown_error", message: "Unknown error" };
      },
    });
    expect(content(el)).toContain("Couldn't load the notification settings");
  });
});
