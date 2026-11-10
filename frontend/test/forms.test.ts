import { render, type TemplateResult } from "lit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HearthApi } from "../src/api";
import { confirmDialog } from "../src/forms/confirm";
import { Drafts } from "../src/forms/drafts";
import { bindDraft, dateField, fieldError, placeField, selectField, textField, toggleField, urlField } from "../src/forms/fields";
import { personPicker } from "../src/forms/personPicker";
import { photoPicker, pickPhoto, PhotoUnusable, shrinkImage, type DecodedImage, type ImageCodec } from "../src/forms/photoPicker";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { Store } from "../src/store";
import type { Snapshot } from "../src/types";
import { fakeConnection, sampleSnapshot, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };

async function readyStore(handlers: Record<string, Handler> = {}, data: () => Snapshot = sampleSnapshot) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => data(), ...handlers });
  const store = new Store(new HearthApi(conn), conn, "u1", null, () => {});
  await store.start();
  return { store, conn };
}

function draw(template: TemplateResult): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(template, host);
  return host;
}

// happy-dom has no real image decoding or canvas. The stub "JPEG" is the text "JPEG <w>x<h>",
// so the test can read back the size it was encoded at.
const stubCodec: ImageCodec = {
  async decode(file: Blob): Promise<DecodedImage> {
    const text = await file.text();
    const match = /^BITMAP (\d+)x(\d+)$/.exec(text);
    if (!match) throw new Error("cannot decode");
    return { width: Number(match[1]), height: Number(match[2]), close: vi.fn() };
  },
  async encode(_image, width, height, quality) {
    return new Blob([`JPEG ${width}x${height} q${quality}`], { type: "image/jpeg" });
  },
};

const decoded = (base64: string) => atob(base64);

describe("photo picker", () => {
  it("photo picker shrinks large images and rejects undecodable files without sending", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/photo/set": () => ({ photo_hash: "h" }) });

    // A 12-megapixel landscape photo comes out 1024 on its long side.
    expect(decoded(await shrinkImage(new Blob(["BITMAP 4000x3000"]), 1024, 0.85, stubCodec))).toBe("JPEG 1024x768 q0.85");
    // Portrait too, and something already small is not enlarged.
    expect(decoded(await shrinkImage(new Blob(["BITMAP 3024x4032"]), 1024, 0.85, stubCodec))).toBe("JPEG 768x1024 q0.85");
    expect(decoded(await shrinkImage(new Blob(["BITMAP 300x200"]), 1024, 0.85, stubCodec))).toBe("JPEG 300x200 q0.85");

    await expect(shrinkImage(new Blob(["not a photo"]), 1024, 0.85, stubCodec)).rejects.toBeInstanceOf(PhotoUnusable);

    // Through the picker: the good one is sent shrunk; the bad one shows the message and sends nothing.
    expect(await pickPhoto(store, "person", "p4", new Blob(["BITMAP 4000x3000"]), stubCodec)).toBe(true);
    const sets = () => conn.sent.filter((m) => m.type === "hearth_crm/photo/set");
    expect(sets()).toHaveLength(1);
    expect(sets()[0]).toMatchObject({ kind: "person", entity_id: "p4" });
    expect(decoded(sets()[0].data)).toBe("JPEG 1024x768 q0.85");

    expect(await pickPhoto(store, "person", "p4", new Blob(["%PDF-1.7"]), stubCodec)).toBe(false);
    expect(sets()).toHaveLength(1);
    expect(store.toast).toBe("That file isn't a photo Hearth can use.");
  });

  it("an image that decodes with no size is unusable, and the bitmap is released", async () => {
    const close = vi.fn();
    const codec: ImageCodec = { decode: async () => ({ width: 0, height: 0, close }), encode: stubCodec.encode };
    await expect(shrinkImage(new Blob(["x"]), 1024, 0.85, codec)).rejects.toBeInstanceOf(PhotoUnusable);
    expect(close).toHaveBeenCalled();
  });

  it("a failure after encoding (reading the result, say) is unusable too, not an unhandled rejection", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/photo/set": () => ({ photo_hash: "h" }) });
    const broken = { arrayBuffer: () => Promise.reject(new Error("read failed")) } as unknown as Blob;
    const codec: ImageCodec = { decode: stubCodec.decode, encode: async () => broken };
    await expect(shrinkImage(new Blob(["BITMAP 10x10"]), 1024, 0.85, codec)).rejects.toBeInstanceOf(PhotoUnusable);
    // Any other error from shrinking is shown the same way, and nothing is sent.
    const odd: ImageCodec = { decode: () => Promise.reject(new TypeError("odd")), encode: stubCodec.encode };
    expect(await pickPhoto(store, "person", "p4", new Blob(["BITMAP 10x10"]), codec)).toBe(false);
    expect(await pickPhoto(store, "person", "p4", new Blob(["BITMAP 10x10"]), odd)).toBe(false);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/photo/set")).toHaveLength(0);
    expect(store.toast).toBe("That file isn't a photo Hearth can use.");
  });

  it("while a photo is shrinking the picker is disabled and a second pick is ignored", async () => {
    const { store, conn } = await readyStore({ "hearth_crm/photo/set": () => ({ photo_hash: "h" }) });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: ImageCodec = { decode: async (f) => (await gate, stubCodec.decode(f)), encode: stubCodec.encode };

    const first = pickPhoto(store, "person", "p4", new Blob(["BITMAP 4000x3000"]), slow);
    expect(store.shrinkingPhoto).toBe(true);
    const host = draw(photoPicker(store, { kind: "person", id: "p4", name: "Sam Okafor", photoUrl: null }));
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true);
    expect(host.querySelector(".file-btn")!.getAttribute("aria-disabled")).toBe("true");
    expect(await pickPhoto(store, "person", "p4", new Blob(["BITMAP 10x10"]), stubCodec)).toBe(false);

    release();
    expect(await first).toBe(true);
    expect(store.shrinkingPhoto).toBe(false);
    const sets = conn.sent.filter((m) => m.type === "hearth_crm/photo/set");
    expect(sets).toHaveLength(1);
    expect(decoded(sets[0].data)).toBe("JPEG 1024x768 q0.85");
    document.body.innerHTML = "";
  });

  it("shrinking ends even when the file is unusable", async () => {
    const { store } = await readyStore();
    expect(await pickPhoto(store, "person", "p4", new Blob(["nope"]), stubCodec)).toBe(false);
    expect(store.shrinkingPhoto).toBe(false);
  });
});

describe("drafts", () => {
  it("keeps a draft while on its path or under it, and drops it on leaving", () => {
    const changes = vi.fn();
    const drafts = new Drafts(changes);
    const first = drafts.open("edit:p1", "/hearth/person/p1/edit", () => ({ name: "Alex" }));
    expect(first).toEqual({ name: "Alex" });
    drafts.patch("edit:p1", { name: "Alex M." });
    expect(changes).toHaveBeenCalledTimes(1);
    // Opening again returns what was typed, not a fresh copy.
    expect(drafts.open("edit:p1", "/hearth/person/p1/edit", () => ({ name: "Alex" }))).toEqual({ name: "Alex M." });

    drafts.leaveTo("/hearth/person/p1/edit/");
    drafts.leaveTo("/hearth/person/p1/edit/photo");
    expect(drafts.get("edit:p1")).toEqual({ name: "Alex M." });
    // A sibling path that only shares a prefix is a different place.
    drafts.leaveTo("/hearth/person/p1/editor");
    expect(drafts.get("edit:p1")).toBeUndefined();
  });

  it("keeps the values a draft opened with as its base", () => {
    const drafts = new Drafts();
    drafts.open("edit:p1", "/hearth/person/p1/edit", () => ({ name: "Alex", tags: ["a"] }));
    drafts.patch("edit:p1", { name: "Alex M.", tags: ["a", "b"] });
    expect(drafts.get("edit:p1")).toEqual({ name: "Alex M.", tags: ["a", "b"] });
    expect(drafts.base("edit:p1")).toEqual({ name: "Alex", tags: ["a"] });
    // Opening again doesn't move the base.
    drafts.open("edit:p1", "/hearth/person/p1/edit", () => ({ name: "Someone else", tags: [] }));
    expect(drafts.base("edit:p1")).toEqual({ name: "Alex", tags: ["a"] });
    // A put starts afresh: its value is its base.
    drafts.put("edit:p1", "/hearth/person/p1/edit", { name: "Robin", tags: [] });
    expect(drafts.base("edit:p1")).toEqual({ name: "Robin", tags: [] });
    drafts.drop("edit:p1");
    expect(drafts.base("edit:p1")).toBeUndefined();
  });

  it("patching a dropped draft does nothing", () => {
    const drafts = new Drafts();
    drafts.patch("gone", { a: 1 });
    expect(drafts.get("gone")).toBeUndefined();
    drafts.put("confirm", "/hearth/group/g1", { open: true });
    drafts.drop("confirm");
    expect(drafts.get("confirm")).toBeUndefined();
  });
});

describe("fields", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("each field reads and writes its draft and shows its error", async () => {
    const { store } = await readyStore({
      "hearth_crm/update": () => {
        throw { code: "invalid", message: "website: must be at most 2000 characters" };
      },
    });
    const key = "edit:p4";
    store.drafts.open(key, "/hearth/person/p4/edit", () => ({
      name: "Sam Okafor", notes: "", birthday: "1990-06-02", birth_year_unknown: false, favorite: false,
      household_id: "", address: "", website: "",
    }));
    await store.save("person", "p4", { website: "x" });
    const b = bindDraft(store, key);
    const host = draw(
      // Several fields at once, as a screen would.
      (await import("lit")).html`${textField(b, "name", "Name", { required: true })}
        ${dateField(b, "birthday", "Birthday", "birth_year_unknown")}
        ${toggleField(b, "favorite", "Favorite")}
        ${selectField(b, "household_id", "Household", [{ value: "", label: "None" }, { value: "h1", label: "Marlow Family" }])}
        ${placeField(b, "address", "Address")} ${urlField(b, "website", "Website")}`,
    );

    const input = (name: string) => host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
    expect(input("name").value).toBe("Sam Okafor");
    expect(input("birthday").value).toBe("1990-06-02");
    expect((input("website") as HTMLInputElement).type).toBe("url");

    const setValue = (name: string, value: string) => {
      input(name).value = value;
      input(name).dispatchEvent(new Event("input"));
    };
    setValue("name", "Sam O.");
    setValue("address", "4 Oak Rd");
    const toggle = input("favorite") as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    const yearUnknown = input("birth_year_unknown") as HTMLInputElement;
    yearUnknown.checked = true;
    yearUnknown.dispatchEvent(new Event("change"));
    input("household_id").value = "h1";
    input("household_id").dispatchEvent(new Event("change"));

    expect(store.drafts.get(key)).toMatchObject({
      name: "Sam O.", address: "4 Oak Rd", favorite: true, birth_year_unknown: true, household_id: "h1",
    });
    // The server's message sits under the field it names, and only there.
    expect(host.querySelector('[data-error-for="website"]')?.textContent?.trim()).toBe("must be at most 2000 characters");
    expect(host.querySelector('[data-error-for="name"]')).toBeNull();
  });

  it("clearing a birthday also clears year unknown", async () => {
    const { store } = await readyStore();
    const key = "edit:p4";
    store.drafts.open(key, "/hearth/person/p4/edit", () => ({ birthday: "1990-06-02", birth_year_unknown: true }));
    const host = draw(dateField(bindDraft(store, key), "birthday", "Birthday", "birth_year_unknown"));
    const input = host.querySelector<HTMLInputElement>('[name="birthday"]')!;
    input.value = "";
    input.dispatchEvent(new Event("input"));
    expect(store.drafts.get(key)).toEqual({ birthday: "", birth_year_unknown: false });
  });

  it("fieldError matches the field and its parts", () => {
    const err = Object.assign(new Error("address.lat: out of range"), { code: "invalid", field: "address.lat" });
    expect(fieldError(err as never, "address")).toBe("out of range");
    expect(fieldError(err as never, "addr")).toBeNull();
    expect(fieldError(null, "address")).toBeNull();
  });
});

describe("person picker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds people by name, leaving out the excluded and the chosen", async () => {
    const { store } = await readyStore();
    const picked: string[] = [];
    const removed: string[] = [];
    const draw2 = () =>
      draw(
        personPicker(store, {
          id: "members", label: "Members", path: "/hearth/group/g1/edit",
          exclude: ["p2"], selected: ["p1"], onPick: (id) => picked.push(id), onRemove: (id) => removed.push(id),
        }),
      );
    let host = draw2();
    // The chosen person shows as a chip with a remove button; no list until something is typed.
    expect(host.querySelector(".chip")?.textContent).toContain("Alex Marlow");
    expect(host.querySelectorAll(".picker-choice")).toHaveLength(0);

    const box = host.querySelector<HTMLInputElement>("#members")!;
    box.value = "marlow";
    box.dispatchEvent(new Event("input"));
    document.body.innerHTML = "";
    host = draw2();
    const names = [...host.querySelectorAll(".picker-choice .name")].map((n) => n.textContent?.trim());
    // Alex is already chosen and Jordan is excluded; Riley is left.
    expect(names).toEqual(["Riley Marlow"]);
    host.querySelector<HTMLButtonElement>(".picker-choice")!.click();
    expect(picked).toEqual(["p3"]);
    host.querySelector<HTMLButtonElement>('.chip button[aria-label="Remove Alex Marlow"]')!.click();
    expect(removed).toEqual(["p1"]);
  });

  it("clears its search after a pick", async () => {
    const { store } = await readyStore();
    const opts = { id: "other", label: "Person", path: "/hearth/person/p1/relationship/new", onPick: () => {} };
    store.drafts.open("picker:other", opts.path, () => ({ query: "okafor" }));
    const host = draw(personPicker(store, opts));
    host.querySelector<HTMLButtonElement>(".picker-choice")!.click();
    expect(store.drafts.get("picker:other")).toEqual({ query: "" });
  });
});

describe("person picker: create", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const typed = async (text: string, extra: Record<string, unknown>) => {
    const { store } = await readyStore();
    const opts = { id: "other", label: "Person", path: "/hearth/person/p1/relationship/new", onPick: () => {}, ...extra };
    store.drafts.open("picker:other", opts.path, () => ({ query: text }));
    return { store, host: draw(personPicker(store, opts as never)) };
  };

  it("offers Create with what was typed, after the matches, only when asked for", async () => {
    const names: string[] = [];
    const { host } = await typed("Zed Quill", { onCreate: (n: string) => names.push(n) });
    expect(host.querySelector(".picker-create")!.textContent).toContain("Create “Zed Quill”");
    expect(host.querySelector(".list")!.lastElementChild).toBe(host.querySelector(".picker-create"));
    // The real matches still come first and stay unchanged: Create is not a picker-choice row.
    expect(host.querySelectorAll(".picker-choice")).toHaveLength(0);
    const { host: without } = await typed("Zed Quill", {});
    expect(without.querySelector(".picker-create")).toBeNull();
    const { host: empty } = await typed("  ", { onCreate: (n: string) => names.push(n) });
    expect(empty.querySelector(".picker-create")).toBeNull();
  });

  it("clicking Create passes the typed name on and clears the search", async () => {
    const names: string[] = [];
    const { store, host } = await typed("  Zed Quill ", { onCreate: (n: string) => names.push(n) });
    host.querySelector<HTMLButtonElement>(".picker-create")!.click();
    expect(names).toEqual(["Zed Quill"]);
    expect(store.drafts.get("picker:other")).toEqual({ query: "" });
  });

  it("is disabled for a name longer than the server allows", async () => {
    const { host } = await typed("x".repeat(201), { onCreate: () => {} });
    expect(host.querySelector<HTMLButtonElement>(".picker-create")!.disabled).toBe(true);
  });
});

describe("confirm dialog", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows its title and lines and runs the callback from the destructive button", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const host = draw(
      confirmDialog({
        title: "Delete Trail Crew?", lines: ["3 people stay; they just leave this group."], confirmLabel: "Delete group",
        onConfirm, onCancel,
      }),
    );
    const dialog = host.querySelector('[role="alertdialog"]')!;
    expect(dialog.getAttribute("aria-label")).toBe("Delete Trail Crew?");
    expect(dialog.textContent).toContain("3 people stay; they just leave this group.");
    const buttons = [...dialog.querySelectorAll("button")];
    buttons.find((b) => b.textContent?.trim() === "Cancel")!.click();
    expect(onCancel).toHaveBeenCalled();
    const destructive = buttons.find((b) => b.textContent?.trim() === "Delete group")!;
    expect(destructive.classList.contains("danger")).toBe(true);
    destructive.click();
    expect(onConfirm).toHaveBeenCalled();
  });
});

// ---- On the panel ----

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
  return { el, conn };
}

const go = async (el: HearthPanel, path: string) => {
  el.route = { prefix: "/hearth", path };
  await settle(el);
};

function type(el: HearthPanel, selector: string, value: string) {
  const input = root(el).querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

describe("drafts on the panel", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/hearth");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    cleanups.forEach((c) => c());
    cleanups = [];
  });

  it("leaving a form's path drops its draft; coming back starts fresh from the snapshot", async () => {
    const { el } = await mount("/interaction/i1/edit");
    type(el, "#log-summary", "Half-typed");
    await settle(el);
    // A re-render on the same path keeps it.
    await go(el, "/interaction/i1/edit");
    expect(root(el).querySelector<HTMLInputElement>("#log-summary")!.value).toBe("Half-typed");

    await go(el, "/interaction/i1");
    await go(el, "/interaction/i1/edit");
    expect(root(el).querySelector<HTMLInputElement>("#log-summary")!.value).toBe("Coffee and a long catch-up");

    // The add form and an open delete confirmation are dropped the same way.
    await go(el, "/add");
    type(el, "#add-name", "Robin");
    await go(el, "/home");
    await go(el, "/add");
    expect(root(el).querySelector<HTMLInputElement>("#add-name")!.value).toBe("");

    await go(el, "/interaction/i1");
    root(el).querySelector<HTMLButtonElement>('button[aria-label="Delete interaction"]')!.click();
    await settle(el);
    expect(root(el).querySelector('[role="alertdialog"]')).toBeTruthy();
    await go(el, "/person/p1");
    await go(el, "/interaction/i1");
    expect(root(el).querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("saving an edit whose interaction was deleted elsewhere closes the sheet with the deleted toast", async () => {
    let deleted = false;
    const { el } = await mount(
      "/interaction/i1/edit",
      {
        "hearth_crm/update": () => {
          deleted = true;
          throw { code: "not_found", message: "interaction 'i1' does not exist" };
        },
      },
      () => {
        const s = sampleSnapshot();
        return deleted ? { ...s, interactions: s.interactions.filter((i) => i.id !== "i1") } : s;
      },
    );
    type(el, "#log-summary", "Coffee, then a walk");
    await settle(el);
    [...root(el).querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Save")!.click();
    await settle(el);
    expect(root(el).querySelector('[role="dialog"]')).toBeNull();
    expect(root(el).querySelector(".toast")?.textContent).toContain("That was already deleted.");
    expect(root(el).querySelector("#content")?.textContent).toContain("This interaction no longer exists.");
  });

  it("deleting an interaction that was already deleted closes the confirmation", async () => {
    const { el } = await mount("/interaction/i1", {
      "hearth_crm/delete": () => {
        throw { code: "not_found", message: "interaction 'i1' does not exist" };
      },
    });
    root(el).querySelector<HTMLButtonElement>('button[aria-label="Delete interaction"]')!.click();
    await settle(el);
    [...root(el).querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')].find((b) => b.textContent?.trim() === "Delete")!.click();
    await settle(el);
    expect(root(el).querySelector('[role="alertdialog"]')).toBeNull();
    expect(el.route!.path).toBe("/person/p1");
    expect(root(el).querySelector(".toast")?.textContent).toContain("That was already deleted.");
  });
});
