import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HearthApi } from "../src/api";
import { Store } from "../src/store";
import { fakeConnection, sampleSnapshot, type Handler } from "./fixtures";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };

function makeStore(handlers: Record<string, Handler>, userId = "A", storage: Storage | null = memoryStorage()) {
  const conn = fakeConnection(handlers);
  const changes = { count: 0 };
  const store = new Store(new HearthApi(conn), conn, userId, storage, () => changes.count++);
  return { store, conn, storage, changes };
}

const snapshotCalls = (conn: { sent: Record<string, any>[] }) =>
  conn.sent.filter((m) => m.type === "hearth_crm/snapshot").length;

describe("Store", () => {
  it("start twice registers listeners once", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const { store, conn } = makeStore({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() });
    const added = vi.spyOn(conn, "addEventListener");
    await Promise.all([store.start(), store.start()]);
    await store.start();
    expect(added.mock.calls.map((c) => c[0]).sort()).toEqual(["disconnected", "ready"]);
    expect(add.mock.calls.filter((c) => c[0] === "visibilitychange")).toHaveLength(1);
    expect(snapshotCalls(conn)).toBe(1);
    store.stop();
    await store.start(); // a stopped store can start again
    expect(added).toHaveBeenCalledTimes(4);
    store.stop();
    add.mockRestore();
  });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("store shows create screen when has_crm is false", async () => {
    const { store } = makeStore({ "hearth_crm/crm/status": () => ({ has_crm: false, loaded: false, entry_id: null }) });
    await store.start();
    expect(store.phase.kind).toBe("noCrm");
    expect(store.snapshot).toBeNull();
  });

  it("shows notLoaded when the CRM exists but is not loaded", async () => {
    const { store } = makeStore({ "hearth_crm/crm/status": () => ({ has_crm: true, loaded: false, entry_id: "e1" }) });
    await store.start();
    expect(store.phase.kind).toBe("notLoaded");
  });

  it("notLoaded on a first load keeps retrying until the CRM loads", async () => {
    let loaded = false;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => ({ has_crm: true, loaded, entry_id: "e1" }),
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    expect(store.phase.kind).toBe("notLoaded");
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.phase.kind).toBe("notLoaded");
    loaded = true;
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.phase.kind).toBe("ready");
    expect(snapshotCalls(conn)).toBe(1);
  });

  it("notLoaded on a first load shows the cached snapshot and retries", async () => {
    let loaded = false;
    const storage = memoryStorage({ "hearth_crm:snapshot:A": JSON.stringify(sampleSnapshot()) });
    const { store } = makeStore({
      "hearth_crm/crm/status": () => ({ has_crm: true, loaded, entry_id: "e1" }),
      "hearth_crm/snapshot": () => sampleSnapshot(),
    }, "A", storage);
    await store.start();
    expect(store.phase.kind).toBe("ready");
    expect(store.offline).toBe(true);
    expect(store.snapshot?.people).toHaveLength(6);
    loaded = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.offline).toBe(false);
  });

  it("loads the snapshot, subscribes and keeps the entry id", async () => {
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    expect(store.phase.kind).toBe("ready");
    expect(store.snapshot?.people).toHaveLength(6);
    expect(store.entryId).toBe("e1");
    expect(store.offline).toBe(false);
    expect(conn.sent.map((m) => m.type)).toContain("hearth_crm/subscribe");
  });

  it("createCrm then loads the snapshot", async () => {
    let created = false;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => (created ? LOADED : { has_crm: false, loaded: false, entry_id: null }),
      "hearth_crm/crm/create": () => { created = true; return { entry_id: "e1" }; },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    expect(store.phase.kind).toBe("noCrm");
    await store.createCrm();
    expect(store.phase.kind).toBe("ready");
    expect(store.snapshot).not.toBeNull();
    expect(store.entryId).toBe("e1");
    expect(snapshotCalls(conn)).toBe(1);
  });

  it("createCrm failure keeps the create screen and exposes the error", async () => {
    let fail = true;
    const { store } = makeStore({
      "hearth_crm/crm/status": () => (fail ? { has_crm: false, loaded: false, entry_id: null } : LOADED),
      "hearth_crm/crm/create": () => {
        if (fail) throw { code: "create_failed", message: "Could not create" };
        return { entry_id: "e1" };
      },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    await store.createCrm();
    expect(store.phase).toEqual({ kind: "noCrm" });
    expect(store.createError).toBe("Could not create");
    expect(store.creating).toBe(false);
    fail = false;
    await store.createCrm();
    expect(store.createError).toBeNull();
    expect(store.phase.kind).toBe("ready");
  });

  it("createCrm stays creating until the follow-up load finishes", async () => {
    let created = false;
    let releaseSnapshot!: () => void;
    const snapshotGate = new Promise<void>((resolve) => (releaseSnapshot = resolve));
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => (created ? LOADED : { has_crm: false, loaded: false, entry_id: null }),
      "hearth_crm/crm/create": () => { created = true; return { entry_id: "e1" }; },
      "hearth_crm/snapshot": async () => { await snapshotGate; return sampleSnapshot(); },
    });
    await store.start();
    const creating = store.createCrm();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(store.creating).toBe(true);
    // A second click while the load runs does nothing.
    await store.createCrm();
    expect(conn.sent.filter((m) => m.type === "hearth_crm/crm/create")).toHaveLength(1);
    releaseSnapshot();
    await creating;
    expect(store.creating).toBe(false);
    expect(store.phase.kind).toBe("ready");
  });

  it("retry is busy until its load finishes, and a second retry waits for it", async () => {
    let fail = true;
    let releaseStatus!: () => void;
    let gate: Promise<void> = Promise.resolve();
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": async () => {
        await gate;
        if (fail) throw { code: "unknown_error", message: "boom" };
        return LOADED;
      },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    fail = false;
    gate = new Promise<void>((resolve) => (releaseStatus = resolve));
    const first = store.retry();
    expect(store.retrying).toBe(true);
    const second = store.retry();
    releaseStatus();
    await Promise.all([first, second]);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/crm/status")).toHaveLength(2);
    expect(store.retrying).toBe(false);
    expect(store.phase.kind).toBe("ready");
  });

  it("search text and chip live on the store and announce changes", async () => {
    const { store, changes } = makeStore({});
    expect(store.search).toEqual({ text: "", chip: "people" });
    const before = changes.count;
    store.setSearch({ text: "mar" });
    store.setSearch({ chip: "households" });
    expect(store.search).toEqual({ text: "mar", chip: "households" });
    expect(changes.count).toBe(before + 2);
  });

  it("retry loads again after a failed first load", async () => {
    let fail = true;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => {
        if (fail) throw { code: "unknown_error", message: "boom" };
        return LOADED;
      },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    expect(store.phase).toEqual({ kind: "error", message: "boom" });
    fail = false;
    await store.retry();
    expect(store.phase.kind).toBe("ready");
    // Retry does not register the connection listeners a second time.
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(snapshotCalls(conn)).toBe(2);
  });

  it("change notice refetches once per burst", async () => {
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    expect(snapshotCalls(conn)).toBe(1);
    conn.push(1);
    await vi.advanceTimersByTimeAsync(100);
    conn.push(1);
    await vi.advanceTimersByTimeAsync(100);
    conn.push(1);
    await vi.advanceTimersByTimeAsync(249);
    expect(snapshotCalls(conn)).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(snapshotCalls(conn)).toBe(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshotCalls(conn)).toBe(2);
  });

  it("store reconnect resubscribes and refetches", async () => {
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    conn.fire("disconnected");
    expect(store.offline).toBe(true);
    expect(store.snapshot).not.toBeNull();
    expect(store.phase.kind).toBe("ready");
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/subscribe")).toHaveLength(2);
    expect(snapshotCalls(conn)).toBe(2);
    expect(store.offline).toBe(false);
    expect(conn.subscribeOptions).toEqual([{ resubscribe: false }, { resubscribe: false }]);
    // The old subscription died with the socket: nothing is sent to cancel it.
    expect(conn.unsubscribed).toEqual([]);
    // The new subscription is live and refetches.
    conn.push(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(snapshotCalls(conn)).toBe(3);
  });

  it("reconnect does not cancel another subscription that reuses the old id", async () => {
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    conn.fire("disconnected");
    // Home Assistant's own frontend resubscribes before "ready" fires, and gets id 1 again.
    const seen: unknown[] = [];
    await conn.subscribeMessage((event) => seen.push(event), { type: "subscribe_events" });
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.offline).toBe(false);
    expect(conn.unsubscribed).toEqual([]);
    conn.push(1, { event: "state_changed" });
    expect(seen).toEqual([{ event: "state_changed" }]);
    // Stopping the store cancels only its own, current subscription.
    store.stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(conn.unsubscribed).toEqual([2]);
    conn.push(1, { event: "again" });
    expect(seen).toHaveLength(2);
  });

  it("a reconnect whose disconnect was never seen does not cancel by a stale id", async () => {
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    conn.dropSocket();
    const seen: unknown[] = [];
    await conn.subscribeMessage((event) => seen.push(event), { type: "subscribe_events" });
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(conn.unsubscribed).toEqual([]);
    conn.push(1, { event: "state_changed" });
    expect(seen).toHaveLength(1);
  });

  it("reconnect before hearth_crm is loaded keeps the data and retries with backoff", async () => {
    let status: () => unknown = () => LOADED;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => status(),
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    conn.fire("disconnected");
    status = () => ({ has_crm: true, loaded: false, entry_id: "e1" });
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot).not.toBeNull();
    expect(store.phase.kind).toBe("ready");
    expect(store.offline).toBe(true);
    await vi.advanceTimersByTimeAsync(2000); // still not loaded: retries again at 5 s
    expect(store.offline).toBe(true);
    status = () => LOADED;
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.phase.kind).toBe("ready");
    expect(store.offline).toBe(false);
    const statusCalls = () => conn.sent.filter((m) => m.type === "hearth_crm/crm/status").length;
    const before = statusCalls();
    await vi.advanceTimersByTimeAsync(30000);
    expect(statusCalls()).toBe(before);
  });

  it("reconnect where status throws unknown_command keeps the data and retries", async () => {
    let broken = false;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => {
        if (broken) throw { code: "unknown_command", message: "not ready" };
        return LOADED;
      },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    await store.start();
    conn.fire("disconnected");
    broken = true;
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot).not.toBeNull();
    expect(store.offline).toBe(true);
    broken = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.phase.kind).toBe("ready");
    expect(store.offline).toBe(false);
  });

  it("confirmed has_crm false after a reconnect shows the create screen", async () => {
    let status: () => unknown = () => LOADED;
    const { store, conn } = makeStore({ "hearth_crm/crm/status": () => status(), "hearth_crm/snapshot": () => sampleSnapshot() });
    await store.start();
    status = () => ({ has_crm: false, loaded: false, entry_id: null });
    conn.fire("ready");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.phase.kind).toBe("noCrm");
    expect(store.snapshot).toBeNull();
  });

  it("refetch error with another code is exposed as lastError, then cleared", async () => {
    let failure: unknown = { code: "invalid", message: "bad" };
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { if (failure) throw failure; return sampleSnapshot(); },
    });
    failure = null;
    await store.start();
    failure = { code: "invalid", message: "bad" };
    conn.push(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(store.lastError).toMatchObject({ code: "invalid", message: "bad" });
    expect(store.offline).toBe(false);
    failure = null;
    conn.push(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(store.lastError).toBeNull();
  });

  it("refetch crm_not_loaded re-runs the load", async () => {
    let loaded = true;
    let failSnapshot = false;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => ({ has_crm: true, loaded, entry_id: "e1" }),
      "hearth_crm/snapshot": () => {
        if (failSnapshot) { loaded = false; throw { code: "crm_not_loaded", message: "no" }; }
        return sampleSnapshot();
      },
    });
    await store.start();
    failSnapshot = true;
    conn.push(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(store.snapshot).not.toBeNull();
    expect(store.offline).toBe(true);
    failSnapshot = false;
    loaded = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.offline).toBe(false);
  });

  it("offline cache is per user", async () => {
    const storage = memoryStorage();
    const a = makeStore({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() }, "A", storage);
    await a.store.start();
    expect(storage.getItem("hearth_crm:snapshot:A")).not.toBeNull();
    expect(storage.getItem("hearth_crm:snapshot:B")).toBeNull();

    const b = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { throw { code: "offline", message: "down" }; },
    }, "B", storage);
    await b.store.start();
    expect(b.store.phase.kind).toBe("error");
    expect(b.store.snapshot).toBeNull();
    // B opening Hearth in this browser clears A's copy.
    expect(storage.getItem("hearth_crm:snapshot:A")).toBeNull();
  });

  it("starting removes every other user's cached snapshot and nothing else", async () => {
    const storage = memoryStorage({
      "hearth_crm:snapshot:A": JSON.stringify(sampleSnapshot()),
      "hearth_crm:snapshot:B": JSON.stringify(sampleSnapshot()),
      "hearth_crm:snapshot:C": JSON.stringify(sampleSnapshot()),
      "other_app:setting": "keep",
    });
    const { store } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { throw { code: "offline", message: "down" }; },
    }, "B", storage);
    await store.start();
    expect(storage.getItem("hearth_crm:snapshot:A")).toBeNull();
    expect(storage.getItem("hearth_crm:snapshot:C")).toBeNull();
    expect(storage.getItem("other_app:setting")).toBe("keep");
    // B's own copy is kept and shown while offline.
    expect(storage.getItem("hearth_crm:snapshot:B")).not.toBeNull();
    expect(store.snapshot?.people).toHaveLength(6);
  });

  it("a confirmed has_crm false removes the user's own cached snapshot", async () => {
    const storage = memoryStorage({ "hearth_crm:snapshot:A": JSON.stringify(sampleSnapshot()) });
    const { store } = makeStore({ "hearth_crm/crm/status": () => ({ has_crm: false, loaded: false, entry_id: null }) }, "A", storage);
    await store.start();
    expect(store.phase.kind).toBe("noCrm");
    expect(storage.getItem("hearth_crm:snapshot:A")).toBeNull();
  });

  it("first load failure falls back to the cached snapshot", async () => {
    const storage = memoryStorage({ "hearth_crm:snapshot:A": JSON.stringify(sampleSnapshot()) });
    const { store } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { throw { code: "offline", message: "down" }; },
    }, "A", storage);
    await store.start();
    expect(store.phase.kind).toBe("ready");
    expect(store.offline).toBe(true);
    expect(store.snapshot?.people).toHaveLength(6);
  });

  it("a failed refetch keeps the data and does not lose the cache", async () => {
    let fail = false;
    const { store, conn } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { if (fail) throw { code: 3, message: "lost" }; return sampleSnapshot(); },
    });
    await store.start();
    fail = true;
    conn.push(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(store.snapshot).not.toBeNull();
    expect(store.offline).toBe(true);
    expect(store.phase.kind).toBe("ready");
  });

  it("works when storage is absent or throws", async () => {
    const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } } as unknown as Storage;
    for (const storage of [null, throwing]) {
      const { store } = makeStore({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() }, "A", storage);
      await store.start();
      expect(store.phase.kind).toBe("ready");
    }
    const { store } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { throw { code: "offline", message: "down" }; },
    }, "A", throwing);
    await store.start();
    expect(store.phase.kind).toBe("error");
  });

  describe("coming back to a panel left open", () => {
    let visibility: DocumentVisibilityState = "visible";
    beforeEach(() => {
      visibility = "visible";
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
    });
    afterEach(() => {
      delete (document as { visibilityState?: unknown }).visibilityState;
    });
    const showAgain = () => {
      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      visibility = "visible";
      document.dispatchEvent(new Event("visibilitychange"));
    };

    it("refetches when the local date has moved past the snapshot's today", async () => {
      vi.setSystemTime(new Date(2026, 10, 5, 22, 0)); // local time; sampleSnapshot's today is 2026-11-05
      const { store, conn } = makeStore({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() });
      await store.start();
      showAgain();
      await vi.advanceTimersByTimeAsync(0);
      expect(snapshotCalls(conn)).toBe(1);

      vi.setSystemTime(new Date(2026, 10, 6, 7, 30));
      showAgain();
      await vi.advanceTimersByTimeAsync(0);
      expect(snapshotCalls(conn)).toBe(2);

      store.stop();
      vi.setSystemTime(new Date(2026, 10, 7, 7, 30));
      showAgain();
      await vi.advanceTimersByTimeAsync(0);
      expect(snapshotCalls(conn)).toBe(2);
    });
  });

  it("stop removes listeners and cancels a pending refetch", async () => {
    const { store, conn } = makeStore({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() });
    await store.start();
    conn.push(1);
    store.stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(snapshotCalls(conn)).toBe(1);
    conn.fire("disconnected");
    expect(store.offline).toBe(false);
  });
});

describe("Store reminders", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const base = { "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() };

  it("addReminder creates a reminder and resolves to its id, which is arriving", async () => {
    const { store, conn } = makeStore({ ...base, "hearth_crm/create": () => ({ id: "m9" }) });
    await store.start();
    const id = await store.addReminder({ person_id: "p4", note: "Call about the move", due_at: "2026-12-08T08:00", repeat_every: 2, repeat_unit: "week" });
    expect(id).toBe("m9");
    expect(conn.sent.find((m) => m.type === "hearth_crm/create")).toMatchObject({
      kind: "reminder",
      fields: { person_id: "p4", note: "Call about the move", due_at: "2026-12-08T08:00", repeat_every: 2, repeat_unit: "week" },
    });
    expect(store.isArriving("m9")).toBe(true);
    store.stop();
  });

  it("addReminder sends Someday (due_at null) as null", async () => {
    const { store, conn } = makeStore({ ...base, "hearth_crm/create": () => ({ id: "m9" }) });
    await store.start();
    await store.addReminder({ person_id: "p4", note: "Someday thing", due_at: null });
    const sent = conn.sent.find((m) => m.type === "hearth_crm/create")!;
    expect(sent.fields.due_at ?? null).toBeNull();
    store.stop();
  });

  it("a created reminder stops arriving once a snapshot containing it lands", async () => {
    let extra = false;
    const data = () => {
      const s = sampleSnapshot();
      if (extra) s.reminders = [...s.reminders, { ...s.reminders[1], id: "m9" }];
      return s;
    };
    const { store } = makeStore({ ...base, "hearth_crm/snapshot": data, "hearth_crm/create": () => ({ id: "m9" }) });
    await store.start();
    await store.addReminder({ person_id: "p4", note: "x" });
    expect(store.isArriving("m9")).toBe(true);
    extra = true;
    await store.refresh();
    expect(store.isArriving("m9")).toBe(false);
    store.stop();
  });

  it("updateReminder sends only what changed; deleteReminder sends a delete", async () => {
    const { store, conn } = makeStore({ ...base, "hearth_crm/update": () => ({}), "hearth_crm/delete": () => ({}) });
    await store.start();
    expect(await store.updateReminder("m2", { note: "Send the trip photos", due_at: "2026-12-08T08:00" })).toBe(true);
    expect(conn.sent.find((m) => m.type === "hearth_crm/update")).toMatchObject({
      kind: "reminder", entity_id: "m2", changes: { due_at: "2026-12-08T08:00" },
    });
    expect(await store.deleteReminder("m2")).toBe(true);
    expect(conn.sent.find((m) => m.type === "hearth_crm/delete")).toMatchObject({ kind: "reminder", entity_id: "m2" });
    store.stop();
  });

  it("completeReminder sends reminder/complete and refreshes", async () => {
    const { store, conn } = makeStore({ ...base, "hearth_crm/reminder/complete": () => ({ reminder: sampleSnapshot().reminders[0] }) });
    await store.start();
    const before = snapshotCalls(conn);
    expect(await store.completeReminder("m1")).toBe(true);
    expect(conn.sent.find((m) => m.type === "hearth_crm/reminder/complete")).toMatchObject({ entity_id: "m1" });
    expect(snapshotCalls(conn)).toBe(before + 1);
    store.stop();
  });

  it("completeReminder toasts and resolves false on failure", async () => {
    const { store } = makeStore({ ...base, "hearth_crm/reminder/complete": () => { throw { code: "unknown_error", message: "boom" }; } });
    await store.start();
    expect(await store.completeReminder("m1")).toBe(false);
    expect(store.toast).toContain("Couldn't mark it done");
    store.stop();
  });

  it("a cached snapshot from before reminders loads with an empty list", async () => {
    const { reminders: _r, reminder_units: _u, ...old } = sampleSnapshot();
    const storage = memoryStorage({ "hearth_crm:snapshot:A": JSON.stringify(old) });
    const { store } = makeStore({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => { throw { code: "offline", message: "down" }; },
    }, "A", storage);
    await store.start();
    expect(store.snapshot?.reminders).toEqual([]);
    expect(store.snapshot?.reminder_units).toEqual([]);
    store.stop();
  });

  it("a fetched snapshot without reminders is normalized too", async () => {
    const { reminders: _r, reminder_units: _u, ...old } = sampleSnapshot();
    const { store } = makeStore({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => old });
    await store.start();
    expect(store.snapshot?.reminders).toEqual([]);
    expect(store.snapshot?.reminder_units).toEqual([]);
    store.stop();
  });
});
