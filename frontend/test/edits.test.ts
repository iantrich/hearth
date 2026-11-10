import { afterEach, describe, expect, it, vi } from "vitest";
import { HearthApi, HearthError } from "../src/api";
import { Store } from "../src/store";
import type { Snapshot } from "../src/types";
import { fakeConnection, person, sampleSnapshot, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const DELETED_TOAST = "That was already deleted.";

async function readyStore(handlers: Record<string, Handler> = {}, data: () => Snapshot = sampleSnapshot) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => data(), ...handlers });
  const store = new Store(new HearthApi(conn), conn, "u1", null, () => {});
  await store.start();
  return { store, conn };
}

const WRITE_TYPES = [
  "hearth_crm/create", "hearth_crm/update", "hearth_crm/delete",
  "hearth_crm/photo/set", "hearth_crm/photo/clear", "hearth_crm/group/set_members",
];
const writesSent = (conn: { sent: Record<string, any>[] }) => conn.sent.filter((m) => WRITE_TYPES.includes(m.type));

afterEach(() => {
  vi.useRealTimers();
});

describe("store.save", () => {
  it("save sends only changed fields", async () => {
    const data = () => {
      const s = sampleSnapshot();
      s.people[3] = person("p4", "Sam Okafor", {
        phone: "555-0101", notes: "Likes trails\n", close_friend: true,
        address: { formatted: "4 Oak Rd, Springfield", city: "Springfield", lat: 1, lon: 2 },
        school: { formatted: "Springfield High", city: "Springfield" },
      });
      return s;
    };
    const { store, conn } = await readyStore({ "hearth_crm/update": () => ({}) }, data);

    const saved = await store.save("person", "p4", {
      name: "Sam Okafor", // unchanged
      phone: "", // cleared: sent as null
      email: "  ", // was null, still blank: untouched
      notes: "Likes trails\n", // unchanged, trailing newline and all
      occupation: " Ranger ", // new, trimmed
      close_friend: true, // unchanged
      favorite: true, // changed
      employer: undefined, // not in the form: untouched
      address: "4 Oak Rd, Springfield", // text unchanged: structured parts stay
      school: "Shelbyville High", // text changed: structured parts cleared
    });

    expect(saved).toEqual({ id: "p4" });
    expect(writesSent(conn)).toEqual([
      {
        type: "hearth_crm/update", kind: "person", entity_id: "p4",
        changes: { phone: null, occupation: "Ranger", favorite: true, school: { formatted: "Shelbyville High" } },
      },
    ]);
  });

  it("with a base, only fields changed from it are sent, even when the record changed since", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/update": () => ({}) });
    // The form opened when Sam had no phone or notes; elsewhere, notes were added since (the snapshot).
    store.snapshot!.people[3] = { ...store.snapshot!.people[3], notes: "Added elsewhere" };
    const base = { phone: "", notes: "", address: "" };
    expect(await store.save("person", "p4", { phone: "555-0199", notes: "", address: "" }, base)).toEqual({ id: "p4" });
    expect(writesSent(conn)).toEqual([{ type: "hearth_crm/update", kind: "person", entity_id: "p4", changes: { phone: "555-0199" } }]);
    // A field the base doesn't have counts as changed.
    await store.save("person", "p4", { phone: "555-0199", occupation: "Ranger" }, { phone: "555-0199" });
    expect(writesSent(conn)[1].changes).toEqual({ occupation: "Ranger" });
  });

  it("an emptied place is sent as null", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/update": () => ({}) });
    await store.save("household", "h1", { address: " " });
    expect(writesSent(conn)[0].changes).toEqual({ address: null });
  });

  it("nothing changed sends nothing", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/update": () => ({}) });
    expect(await store.save("person", "p1", { name: "Alex Marlow", phone: "" })).toEqual({ id: "p1" });
    expect(writesSent(conn)).toEqual([]);
  });

  it("creating leaves blank fields out and resolves to the new id", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/create": () => ({ id: "g9" }) });
    const saved = await store.save("contact_group", null, { name: " Book Club ", description: "", photo: undefined });
    expect(saved).toEqual({ id: "g9" });
    expect(writesSent(conn)).toEqual([{ type: "hearth_crm/create", kind: "contact_group", fields: { name: "Book Club" } }]);
    // Not in the snapshot yet: its screen can wait for it.
    expect(store.isArriving("g9")).toBe(true);
  });

  it("creating a place sends its text", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/create": () => ({ id: "h9" }) });
    await store.save("household", null, { address: "9 Birch Ln", notes: "" });
    expect(writesSent(conn)[0].fields).toEqual({ address: { formatted: "9 Birch Ln" } });
  });

  it("saving a form whose record was deleted elsewhere closes it with the deleted toast", async () => {
    let deleted = false;
    const { store } = await readyStore(
      {
        "hearth_crm/update": () => {
          deleted = true;
          throw { code: "not_found", message: "person 'p4' does not exist" };
        },
      },
      () => {
        const s = sampleSnapshot();
        return deleted ? { ...s, people: s.people.filter((p) => p.id !== "p4") } : s;
      },
    );
    expect(await store.save("person", "p4", { name: "Sam O." })).toBeNull();
    expect(store.toast).toBe(DELETED_TOAST);
    // The store refetched before resolving, so the form's screen redraws as "no longer exists".
    expect(store.snapshot!.people.some((p) => p.id === "p4")).toBe(false);
    expect(store.busy).toBe(false);
  });

  it("saving a record already gone from the snapshot sends nothing", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/update": () => ({}) });
    expect(await store.save("person", "nobody", { name: "X" })).toBeNull();
    expect(store.toast).toBe(DELETED_TOAST);
    expect(writesSent(conn)).toEqual([]);
  });

  it("an invalid field is kept on the write error for the form", async () => {
    const { store } = await readyStore({
      "hearth_crm/update": () => {
        throw { code: "invalid", message: "address: must be at most 1000 characters" };
      },
    });
    expect(await store.save("person", "p1", { address: "x".repeat(1001) })).toBeNull();
    expect(store.toast).toBe("address: must be at most 1000 characters");
    expect(store.writeError).toBeInstanceOf(HearthError);
    expect(store.writeError!.field).toBe("address");
    // A route change clears it, so another form doesn't show it.
    store.routeChanged("/hearth");
    expect(store.writeError).toBeNull();
  });

  it("is refused while offline", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/update": () => ({}), "hearth_crm/create": () => ({ id: "x" }) });
    conn.fire("disconnected");
    expect(await store.save("person", "p1", { name: "Alex M." })).toBeNull();
    expect(await store.save("person", null, { name: "Robin Vale" })).toBeNull();
    expect(await store.remove("person", "p1")).toBe(false);
    expect(await store.setPhoto("person", "p1", "AAAA")).toBe(false);
    expect(await store.clearPhoto("person", "p1")).toBe(false);
    expect(await store.setGroupMembers("g1", [])).toBe(false);
    expect(writesSent(conn)).toEqual([]);
    expect(store.toast).toBe("You're offline. Changes are paused.");
  });
});

describe("store.remove and the other writes", () => {
  it("remove sends delete", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/delete": () => ({}) });
    expect(await store.remove("household", "h1")).toBe(true);
    expect(writesSent(conn)).toEqual([{ type: "hearth_crm/delete", kind: "household", entity_id: "h1" }]);
  });

  it("removing something already deleted counts as done, with the deleted toast", async () => {
    const { store } = await readyStore({
      "hearth_crm/delete": () => {
        throw { code: "not_found", message: "interaction 'i1' does not exist" };
      },
    });
    expect(await store.remove("interaction", "i1")).toBe(true);
    expect(await store.deleteInteraction("i1")).toBe(true);
    expect(store.toast).toBe(DELETED_TOAST);
  });

  it("a failed remove returns false with the error toast", async () => {
    const { store } = await readyStore({
      "hearth_crm/delete": () => {
        throw { code: "unknown_error", message: "Unknown error" };
      },
    });
    expect(await store.remove("person", "p1")).toBe(false);
    expect(store.toast).toBe("Couldn't save: Unknown error");
  });

  it("setGroupMembers sends group_id and person_ids", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/group/set_members": () => ({}) });
    expect(await store.setGroupMembers("g1", ["p1", "p6"])).toBe(true);
    expect(writesSent(conn)).toEqual([{ type: "hearth_crm/group/set_members", group_id: "g1", person_ids: ["p1", "p6"] }]);
  });

  it("setPhoto and clearPhoto send kind, entity_id and data", async () => {
    const { store, conn } = await readyStore({
      "hearth_crm/photo/set": () => ({ photo_hash: "abc" }),
      "hearth_crm/photo/clear": () => null,
    });
    expect(await store.setPhoto("contact_group", "g1", "QUJD")).toBe(true);
    expect(await store.clearPhoto("household", "h1")).toBe(true);
    expect(writesSent(conn)).toEqual([
      { type: "hearth_crm/photo/set", kind: "contact_group", entity_id: "g1", data: "QUJD" },
      { type: "hearth_crm/photo/clear", kind: "household", entity_id: "h1" },
    ]);
  });

  it("uses the backup toast and is busy like every write", async () => {
    let release!: () => void;
    const { store } = await readyStore({
      "hearth_crm/group/set_members": () => new Promise<void>((r) => (release = r)),
      "hearth_crm/photo/clear": () => {
        throw { code: "backup_in_progress", message: "a backup is running" };
      },
    });
    const first = store.setGroupMembers("g1", []);
    expect(store.busy).toBe(true);
    expect(await store.remove("person", "p1")).toBe(false);
    expect(store.toast).toBe("Still saving…");
    release();
    expect(await first).toBe(true);
    expect(await store.clearPhoto("person", "p1")).toBe(false);
    expect(store.toast).toBe("Home Assistant is making a backup. Try again in a moment.");
  });
});

describe("arriving", () => {
  it("the arriving spinner gives up after 10 s", async () => {
    const { store } = await readyStore({ "hearth_crm/create": () => ({ id: "p9" }) });
    vi.useFakeTimers();
    expect(await store.addPerson({ name: "Robin Vale", phone: null, email: null, how_i_know_them: null, birthday: null, birth_year_unknown: false })).toBe("p9");
    expect(store.isArriving("p9")).toBe(true);
    vi.advanceTimersByTime(9_999);
    expect(store.isArriving("p9")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(store.isArriving("p9")).toBe(false);
  });

  it("a record that arrives in time stops the timer", async () => {
    let people = sampleSnapshot().people;
    const { store } = await readyStore({ "hearth_crm/create": () => ({ id: "p9" }) }, () => ({ ...sampleSnapshot(), people }));
    vi.useFakeTimers();
    await store.save("person", null, { name: "Robin Vale" });
    people = [...people, person("p9", "Robin Vale")];
    await store.refresh();
    expect(store.isArriving("p9")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("HearthError", () => {
  it("names the field of an invalid error", async () => {
    const conn = fakeConnection({
      "hearth_crm/update": () => {
        throw { code: "invalid", message: "address.lat: must be between -90 and 90, got 91" };
      },
      "hearth_crm/delete": () => {
        throw { code: "not_found", message: "person 'x': does not exist" };
      },
    });
    const api = new HearthApi(conn);
    const invalid = await (api.update("person", "p1", {}) as Promise<never>).catch((e: HearthError) => e);
    expect(invalid.field).toBe("address.lat");
    const missing = await (api.remove("person", "x") as Promise<never>).catch((e: HearthError) => e);
    expect(missing.field).toBeUndefined();
  });
});
