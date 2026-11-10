import { describe, expect, it } from "vitest";
import { HearthApi, HearthError } from "../src/api";
import { fakeConnection, sampleSnapshot } from "./fixtures";

describe("HearthApi", () => {
  it("sends snapshot and returns the result", async () => {
    const conn = fakeConnection({ "hearth_crm/snapshot": () => sampleSnapshot() });
    expect((await new HearthApi(conn).snapshot()).people).toHaveLength(6);
    expect(conn.sent[0]).toEqual({ type: "hearth_crm/snapshot" });
  });
  it("update sends entity_id and changes", async () => {
    const conn = fakeConnection({ "hearth_crm/update": (m) => ({ id: m.entity_id }) });
    await new HearthApi(conn).update("person", "p1", { favorite: true });
    expect(conn.sent[0]).toEqual({ type: "hearth_crm/update", kind: "person", entity_id: "p1", changes: { favorite: true } });
  });
  it("maps HA errors to HearthError codes", async () => {
    const conn = fakeConnection({ "hearth_crm/snapshot": () => { throw { code: "backup_in_progress", message: "Backup running" }; } });
    const err = await new HearthApi(conn).snapshot().catch((e) => e);
    expect(err).toBeInstanceOf(HearthError);
    expect(err).toMatchObject({ code: "backup_in_progress", message: "Backup running" });
  });
  it("maps a numeric connection-lost code to offline", async () => {
    const conn = fakeConnection();
    conn.sendMessagePromise = async () => { throw { code: 3, message: "Connection lost" }; };
    await expect(new HearthApi(conn).snapshot()).rejects.toMatchObject({ code: "offline" });
  });
  it("maps a bare rejection with no code to offline", async () => {
    const conn = fakeConnection();
    conn.sendMessagePromise = async () => { throw undefined; };
    await expect(new HearthApi(conn).snapshot()).rejects.toMatchObject({ code: "offline" });
  });
  it("maps a TypeError to unknown_error, not offline", async () => {
    const conn = fakeConnection();
    conn.sendMessagePromise = async () => { throw new TypeError("x is not a function"); };
    await expect(new HearthApi(conn).snapshot()).rejects.toMatchObject({
      code: "unknown_error",
      message: "x is not a function",
    });
  });
  it("export calls the action with a response", async () => {
    const conn = fakeConnection({ call_service: () => ({ response: { path: "/config/x.zip" } }) });
    expect(await new HearthApi(conn).exportBundle("e1")).toEqual({ path: "/config/x.zip" });
    expect(conn.sent[0]).toMatchObject({ domain: "hearth_crm", service: "export", service_data: { config_entry_id: "e1" }, return_response: true });
  });
  it("create, remove, settings and status send the documented payloads", async () => {
    const conn = fakeConnection({
      "hearth_crm/create": () => ({ id: "p9" }),
      "hearth_crm/delete": () => ({}),
      "hearth_crm/settings/get": () => ({ me_person_id: null }),
      "hearth_crm/settings/set": () => ({}),
      "hearth_crm/crm/status": () => ({ has_crm: false, loaded: false, entry_id: null }),
      "hearth_crm/crm/create": () => ({ entry_id: "e2" }),
    });
    const api = new HearthApi(conn);
    await api.create("person", { name: "Jo" });
    await api.remove("interaction", "i1");
    await api.settingsGet();
    await api.settingsSet(null);
    expect(await api.status()).toEqual({ has_crm: false, loaded: false, entry_id: null });
    expect(await api.createCrm()).toEqual({ entry_id: "e2" });
    expect(conn.sent).toEqual([
      { type: "hearth_crm/create", kind: "person", fields: { name: "Jo" } },
      { type: "hearth_crm/delete", kind: "interaction", entity_id: "i1" },
      { type: "hearth_crm/settings/get" },
      { type: "hearth_crm/settings/set", changes: { me_person_id: null } },
      { type: "hearth_crm/crm/status" },
      { type: "hearth_crm/crm/create" },
    ]);
  });
  it("subscribe forwards events and returns an unsubscribe", async () => {
    let cb: () => void = () => {};
    let unsubbed = false;
    const conn = fakeConnection();
    let options: unknown;
    conn.subscribeMessage = (async (callback: () => void, msg: unknown, opts: unknown) => {
      cb = callback;
      options = opts;
      conn.sent.push(msg as Record<string, any>);
      return async () => { unsubbed = true; };
    }) as typeof conn.subscribeMessage;
    let calls = 0;
    const off = await new HearthApi(conn).subscribe(() => calls++);
    cb();
    expect(calls).toBe(1);
    expect(conn.sent[0]).toEqual({ type: "hearth_crm/subscribe" });
    expect(options).toEqual({ resubscribe: false });
    await off();
    expect(unsubbed).toBe(true);
  });
});
