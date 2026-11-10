import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HearthApi } from "../src/api";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { Store } from "../src/store";
import type { Snapshot } from "../src/types";
import { fakeConnection, interaction, person, sampleSnapshot, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const OFFLINE_TOAST = "You're offline. Changes are paused.";

/** A promise a test settles by hand, to look at the state while a write is in flight. */
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function readyStore(handlers: Record<string, Handler> = {}, data: () => Snapshot = sampleSnapshot) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => data(), ...handlers });
  const store = new Store(new HearthApi(conn), conn, "u1", null, () => {});
  await store.start();
  return { store, conn };
}

const writesSent = (conn: { sent: Record<string, any>[] }) =>
  conn.sent.filter((m) => ["hearth_crm/create", "hearth_crm/update", "hearth_crm/delete", "hearth_crm/settings/set", "call_service"].includes(m.type));

const favoriteOf = (store: Store, id: string) => store.snapshot!.people.find((p) => p.id === id)!.favorite;

describe("store writes", () => {
  it("favorite is optimistic and rolls back when the save fails", async () => {
    const save = deferred();
    const { store, conn } = await readyStore({ "hearth_crm/update": () => save.promise });
    const sam = store.snapshot!.people.find((p) => p.id === "p4")!;
    expect(sam.favorite).toBe(false);

    const toggling = store.toggleFavorite(sam);
    // Flipped before the server answers.
    expect(favoriteOf(store, "p4")).toBe(true);
    expect(conn.sent.at(-1)).toEqual({ type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { favorite: true } });

    save.reject({ code: "unknown_error", message: "disk full" });
    await toggling;
    expect(favoriteOf(store, "p4")).toBe(false);
    expect(store.toast).toBe("Couldn't save: disk full");
  });

  it("favorite survives a refetch that lands while the save is in flight", async () => {
    const save = deferred();
    const { store } = await readyStore({ "hearth_crm/update": () => save.promise });
    const toggling = store.toggleFavorite(store.snapshot!.people.find((p) => p.id === "p4")!);
    await store.refresh(); // An unrelated change elsewhere: the server still says false.
    expect(favoriteOf(store, "p4")).toBe(true);
    save.resolve({});
    await toggling;
    expect(favoriteOf(store, "p4")).toBe(true);
  });

  it("writes are refused while offline", async () => {
    const { store, conn } = await readyStore({
      "hearth_crm/create": () => ({ id: "x" }),
      "hearth_crm/update": () => ({}),
      "hearth_crm/delete": () => ({}),
      "hearth_crm/settings/set": () => ({}),
    });
    conn.fire("disconnected");
    expect(store.offline).toBe(true);

    await store.toggleFavorite(store.snapshot!.people[0]);
    expect(await store.addInteraction({ person_ids: ["p1"], type: "Call", date: "2026-11-05", summary: "Hi", notes: null })).toBe(false);
    expect(await store.updateInteraction("i1", { type: "Call", date: "2026-11-05", summary: "Hi", notes: null })).toBe(false);
    expect(await store.deleteInteraction("i1")).toBe(false);
    expect(await store.addPerson({ name: "Robin Vale", phone: null, email: null, how_i_know_them: null, birthday: null, birth_year_unknown: false })).toBeNull();
    expect(await store.setMe("p2")).toBe(false);
    expect(await store.exportNow()).toBe(false);

    expect(writesSent(conn)).toEqual([]);
    expect(store.snapshot!.people[0].favorite).toBe(true);
    expect(store.toast).toBe(OFFLINE_TOAST);
  });

  it("backup in progress shows the backup toast", async () => {
    const { store } = await readyStore({
      "hearth_crm/create": () => {
        throw { code: "backup_in_progress", message: "a backup is running" };
      },
    });
    const ok = await store.addInteraction({ person_ids: ["p1"], type: "Call", date: "2026-11-05", summary: "Hi", notes: null });
    expect(ok).toBe(false);
    expect(store.toast).toBe("Home Assistant is making a backup. Try again in a moment.");
    expect(store.busy).toBe(false);
  });

  it("maps invalid, not_found and other errors to their toasts", async () => {
    let error: { code: string; message: string } = { code: "invalid", message: "summary: must not be blank" };
    const { store } = await readyStore({
      "hearth_crm/update": () => {
        throw error;
      },
      "hearth_crm/delete": () => {
        throw error;
      },
    });
    await store.updateInteraction("i1", { type: "Call", date: "2026-11-05", summary: "", notes: null });
    expect(store.toast).toBe("summary: must not be blank");

    error = { code: "not_found", message: "interaction 'i1' does not exist" };
    await store.deleteInteraction("i1");
    expect(store.toast).toBe("That was already deleted.");

    error = { code: "unknown_error", message: "Unknown error" };
    await store.deleteInteraction("i1");
    expect(store.toast).toBe("Couldn't save: Unknown error");
  });

  it("is busy while a write is in flight and ignores a second one", async () => {
    const save = deferred();
    const { store, conn } = await readyStore({ "hearth_crm/delete": () => save.promise });
    const first = store.deleteInteraction("i1");
    expect(store.busy).toBe(true);
    expect(await store.deleteInteraction("i1")).toBe(false);
    expect(store.toast).toBe("Still saving…");
    save.resolve({});
    expect(await first).toBe(true);
    expect(store.busy).toBe(false);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/delete")).toHaveLength(1);
  });

  it("add person leaves blank fields out", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/create": (msg) => ({ id: "p9", ...msg.fields }) });
    const id = await store.addPerson({ name: " Robin Vale ", phone: null, email: "", how_i_know_them: null, birthday: null, birth_year_unknown: false });
    expect(id).toBe("p9");
    expect(conn.sent.at(-1)).toEqual({ type: "hearth_crm/create", kind: "person", fields: { name: "Robin Vale" } });
  });

  it("add person sends the fields that are filled in", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/create": () => ({ id: "p9" }) });
    await store.addPerson({
      name: "Robin Vale", phone: "555-0100", email: "robin@example.com", how_i_know_them: "Trail Crew",
      birthday: "1990-06-02", birth_year_unknown: true,
    });
    expect(conn.sent.at(-1)!.fields).toEqual({
      name: "Robin Vale", phone: "555-0100", email: "robin@example.com", how_i_know_them: "Trail Crew",
      birthday: "1990-06-02", birth_year_unknown: true,
    });
  });

  it("a just-added person is arriving until a snapshot fetched after the save", async () => {
    let people = sampleSnapshot().people;
    const fetch = deferred<Snapshot>();
    let slow = false;
    const { store } = await readyStore({ "hearth_crm/create": () => ({ id: "p9" }) }, () => {
      if (slow) return fetch.promise as unknown as Snapshot;
      return { ...sampleSnapshot(), people };
    });
    // A refetch already in flight when the person is created can't include them.
    slow = true;
    const stale = store.refresh();
    slow = false;
    await store.addPerson({ name: "Robin Vale", phone: null, email: null, how_i_know_them: null, birthday: null, birth_year_unknown: false });
    expect(store.isArriving("p9")).toBe(true);
    fetch.resolve(sampleSnapshot());
    await stale;
    expect(store.isArriving("p9")).toBe(true);

    people = [...people, person("p9", "Robin Vale")];
    await store.refresh();
    expect(store.isArriving("p9")).toBe(false);
  });

  it("a just-added person deleted at once stops arriving", async () => {
    const { store } = await readyStore({ "hearth_crm/create": () => ({ id: "p9" }) });
    await store.addPerson({ name: "Robin Vale", phone: null, email: null, how_i_know_them: null, birthday: null, birth_year_unknown: false });
    await store.refresh(); // Fetched after the save, and they aren't in it.
    expect(store.isArriving("p9")).toBe(false);
  });

  it("export toasts the file name", async () => {
    const { store, conn } = await readyStore({
      call_service: () => ({ response: { path: "/config/hearth_crm/u/exports/hearth-1.zip" } }),
    });
    expect(await store.exportNow()).toBe(true);
    expect(conn.sent.at(-1)).toMatchObject({ type: "call_service", domain: "hearth_crm", service: "export", service_data: { config_entry_id: "e1" } });
    expect(store.toast).toBe("Saved hearth-1.zip to your Hearth exports folder.");
  });
});

// ---- Screens ----

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

const root = (el: HearthPanel) => el.shadowRoot!;
const content = (el: HearthPanel) => (root(el).querySelector("#content")?.textContent ?? "").replace(/\s+/g, " ");
const allText = (el: HearthPanel) => (root(el).textContent ?? "").replace(/\s+/g, " ");
const button = (el: HearthPanel, label: string) =>
  [...root(el).querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.getAttribute("aria-label") === label || b.textContent?.trim() === label,
  );

function type(el: HearthPanel, selector: string, value: string) {
  const input = root(el).querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

/** Mount the panel at `path`, and move its route whenever the panel navigates, as HA does. */
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
  return { el, conn };
}

let cleanups: (() => void)[] = [];

describe("write screens", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/hearth");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    cleanups.forEach((c) => c());
    cleanups = [];
  });

  it("the person star toggles favorite", async () => {
    const { el, conn } = await mount("/person/p4", { "hearth_crm/update": () => ({}) });
    button(el, "Add to favorites")!.click();
    await settle(el);
    expect(conn.sent.find((m) => m.type === "hearth_crm/update")).toEqual({
      type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { favorite: true },
    });
    expect(button(el, "Remove from favorites")).toBeTruthy();
  });

  it("log interaction sends create with person_ids and the chosen type", async () => {
    const data = () => ({ ...sampleSnapshot(), interaction_types: ["Catch-up", "Trip", "Other"] });
    const { el, conn } = await mount("/person/p1/log", { "hearth_crm/create": (msg) => ({ id: "i9", ...msg.fields }) }, data);
    const sheet = root(el).querySelector('[role="dialog"]')!;
    expect(sheet.getAttribute("aria-label")).toBe("Log interaction");
    // The default type is the first of the snapshot's types, and the date is the snapshot's today.
    expect(root(el).querySelector(".pill.on")?.textContent?.trim()).toBe("Catch-up");
    expect(root(el).querySelector<HTMLInputElement>("#log-date")!.value).toBe("2026-11-05");
    expect(sheet.textContent).not.toMatch(/notion/i);
    expect(button(el, "Save")!.disabled).toBe(true);

    button(el, "Trip")!.click();
    type(el, "#log-date", "2026-03-01");
    type(el, "#log-summary", "Weekend");
    type(el, "#log-notes", "x");
    await settle(el);
    button(el, "Save")!.click();
    await settle(el);

    expect(conn.sent.find((m) => m.type === "hearth_crm/create")).toEqual({
      type: "hearth_crm/create", kind: "interaction",
      fields: { person_ids: ["p1"], type: "Trip", date: "2026-03-01", summary: "Weekend", notes: "x" },
    });
    // The sheet closes back to the person.
    expect(el.route!.path).toBe("/person/p1");
    expect(root(el).querySelector('[role="dialog"]')).toBeNull();
  });

  it("a failed log keeps the sheet open with what was typed", async () => {
    const { el } = await mount("/person/p1/log", {
      "hearth_crm/create": () => {
        throw { code: "backup_in_progress", message: "busy" };
      },
    });
    type(el, "#log-summary", "Weekend");
    await settle(el);
    button(el, "Save")!.click();
    await settle(el);
    expect(el.route!.path).toBe("/person/p1/log");
    expect(root(el).querySelector<HTMLInputElement>("#log-summary")!.value).toBe("Weekend");
    expect(root(el).querySelector(".toast")?.textContent).toContain("Home Assistant is making a backup.");
  });

  it("edit interaction sends only what changed, without touching its people", async () => {
    const { el, conn } = await mount("/interaction/i1/edit", { "hearth_crm/update": () => ({}) });
    expect(root(el).querySelector('[role="dialog"]')!.getAttribute("aria-label")).toBe("Edit interaction");
    expect(root(el).querySelector<HTMLInputElement>("#log-summary")!.value).toBe("Coffee and a long catch-up");
    type(el, "#log-summary", "Coffee, then a walk");
    await settle(el);
    button(el, "Save")!.click();
    await settle(el);
    expect(conn.sent.find((m) => m.type === "hearth_crm/update")).toEqual({
      type: "hearth_crm/update", kind: "interaction", entity_id: "i1",
      changes: { summary: "Coffee, then a walk" },
    });
    expect(el.route!.path).toBe("/interaction/i1");
  });

  it("edit is disabled for an interaction with no one on it", async () => {
    const data = () => ({ ...sampleSnapshot(), interactions: [interaction("i7", "Notes to self", "2026-10-01", ["gone"])] });
    const { el } = await mount("/interaction/i7/edit", {}, data);
    expect(button(el, "Edit")!.disabled).toBe(true);
    expect(root(el).querySelector('[role="dialog"]')).toBeNull();
  });

  it("delete confirms what is removed, then goes to the lead person", async () => {
    const { el, conn } = await mount("/interaction/i1", { "hearth_crm/delete": () => ({}) });
    button(el, "Delete interaction")!.click();
    await settle(el);
    const dialog = root(el).querySelector('[role="alertdialog"]')!;
    expect(dialog.textContent).toContain("Coffee and a long catch-up");
    expect(dialog.textContent).toContain("October 20, 2026");
    expect(dialog.textContent).not.toMatch(/notion|trash/i);
    [...dialog.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Delete")!.click();
    await settle(el);
    expect(conn.sent.find((m) => m.type === "hearth_crm/delete")).toEqual({ type: "hearth_crm/delete", kind: "interaction", entity_id: "i1" });
    expect(el.route!.path).toBe("/person/p1");
    expect(root(el).querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("add person saves, then shows the new person once the refetch lands", async () => {
    let people = sampleSnapshot().people;
    const { el, conn } = await mount(
      "/add",
      { "hearth_crm/create": (msg) => ({ id: "p9", ...msg.fields }) },
      () => ({ ...sampleSnapshot(), people }),
    );
    expect(root(el).querySelector(".topbar .title")?.textContent?.trim()).toBe("Add person");
    type(el, "#add-name", "Robin Vale");
    await settle(el);
    button(el, "Save")!.click();
    await settle(el);

    expect(conn.sent.find((m) => m.type === "hearth_crm/create")).toEqual({
      type: "hearth_crm/create", kind: "person", fields: { name: "Robin Vale" },
    });
    expect(el.route!.path).toBe("/person/p9");
    // Not in the snapshot yet: loading, not "no longer exists".
    expect(content(el)).not.toContain("no longer exists");
    expect(root(el).querySelector("#content .spinner")).toBeTruthy();

    // The server's change notice triggers the refetch, which now has them.
    people = [...people, person("p9", "Robin Vale")];
    button(el, "Refresh")!.click();
    await settle(el);
    expect(content(el)).toContain("Robin Vale");

    // The form starts empty next time.
    el.route = { prefix: "/hearth", path: "/add" };
    await settle(el);
    expect(root(el).querySelector<HTMLInputElement>("#add-name")!.value).toBe("");
  });

  it("settings saves the me person", async () => {
    const { el, conn } = await mount("/settings", { "hearth_crm/settings/set": () => ({ me_person_id: "p4" }) });
    expect(content(el)).toContain("This is me");
    expect(content(el)).toContain("Alex Marlow");
    button(el, "Change")!.click();
    await settle(el);
    type(el, "#me-search", "okafor");
    await settle(el);
    const choices = [...root(el).querySelectorAll<HTMLButtonElement>(".me-choice")];
    expect(choices.map((b) => b.querySelector(".name")?.textContent?.trim())).toEqual(["Sam Okafor"]);
    choices[0].click();
    await settle(el);
    expect(conn.sent.find((m) => m.type === "hearth_crm/settings/set")).toEqual({
      type: "hearth_crm/settings/set", changes: { me_person_id: "p4" },
    });
    expect(root(el).querySelector("#me-search")).toBeNull();
  });

  it("settings can clear the me person", async () => {
    const { el, conn } = await mount("/settings", { "hearth_crm/settings/set": () => ({ me_person_id: null }) });
    button(el, "Clear")!.click();
    await settle(el);
    expect(conn.sent.find((m) => m.type === "hearth_crm/settings/set")).toEqual({
      type: "hearth_crm/settings/set", changes: { me_person_id: null },
    });
  });

  it("settings exports and shows the version", async () => {
    const { el } = await mount("/settings", {
      call_service: () => ({ response: { path: "/config/hearth_crm/u/exports/hearth-1.zip" } }),
    });
    expect(content(el)).toContain("Version");
    button(el, "Export now")!.click();
    await settle(el);
    expect(root(el).querySelector(".toast")?.textContent).toContain("Saved hearth-1.zip to your Hearth exports folder.");
    expect(allText(el)).not.toMatch(/notion/i);
  });
});
