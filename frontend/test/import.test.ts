import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HearthApi, type Auth } from "../src/api";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import { fakeConnection, sampleSnapshot, type Handler } from "./fixtures";

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

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const bundle = () => new File(["zip bytes"], "hearth-export.zip", { type: "application/zip" });

let fetchMock: ReturnType<typeof vi.fn>;
let auth: Auth;

async function mount(handlers: Record<string, Handler> = {}) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot(), ...handlers });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path: "/settings" };
  el.hass = { connection: conn, auth, user: { id: "u1", name: "Test User" } };
  history.replaceState(null, "", "/hearth/settings");
  document.body.appendChild(el);
  await settle(el);
  return { el, conn };
}

/** Picks `file` in the Import file picker, as the browser would. */
async function pickFile(el: HearthPanel, file: File) {
  const input = root(el).querySelector<HTMLInputElement>("#import-file")!;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new Event("change"));
  await settle(el);
}

const dialog = (el: HearthPanel) => root(el).querySelector<HTMLElement>('[role="alertdialog"]');
const dialogButton = (el: HearthPanel, label: string) =>
  [...(dialog(el)?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) => b.textContent?.trim() === label);

/** Picks `file` and confirms the import. */
async function choose(el: HearthPanel, file: File) {
  await pickFile(el, file);
  dialogButton(el, "Import")!.click();
  await settle(el);
}

describe("import from Settings", () => {
  beforeEach(() => {
    localStorage.clear();
    auth = { data: { access_token: "tok-123" }, expired: false, refreshAccessToken: vi.fn(async () => {}) };
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("the card says an import replaces everything", async () => {
    const { el } = await mount();
    expect(content(el)).toContain("Replaces everything in your Hearth with a Hearth export (.zip).");
    expect(content(el)).not.toContain("Brings");
  });

  it("picking a file asks first, and cancelling sends nothing", async () => {
    const { el } = await mount();
    await pickFile(el, bundle());
    expect(fetchMock).not.toHaveBeenCalled();
    const asked = dialog(el)!;
    expect(asked.getAttribute("aria-label")).toBe("Import hearth-export.zip?");
    expect(asked.textContent).toContain("Everything in your Hearth is replaced by what's in this file.");
    expect(dialogButton(el, "Import")!.classList.contains("danger")).toBe(true);
    dialogButton(el, "Cancel")!.click();
    await settle(el);
    expect(dialog(el)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("confirming the import uploads the file once", async () => {
    fetchMock.mockResolvedValue(json(200, { summary: "Imported 2 people.", counts: {} }));
    const { el } = await mount();
    await pickFile(el, bundle());
    dialogButton(el, "Import")!.click();
    await settle(el);
    expect(dialog(el)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1].body as FormData).get("replace_existing")).toBe("false");
    expect(content(el)).toContain("Imported 2 people.");
  });

  it("import sends the bearer token and multipart body", async () => {
    fetchMock.mockResolvedValue(json(200, { summary: "Imported 433 people, 3 households.", counts: { people: 433 } }));
    const { el } = await mount();
    await choose(el, bundle());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/hearth_crm/import");
    expect(String(url)).not.toContain("tok-123");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer tok-123" });
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get("file") as File).name).toBe("hearth-export.zip");
    expect(body.get("replace_existing")).toBe("false");
    expect(content(el)).toContain("Imported 433 people, 3 households.");
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes an expired token before uploading", async () => {
    auth.expired = true;
    (auth.refreshAccessToken as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      auth.data = { access_token: "fresh" };
    });
    fetchMock.mockResolvedValue(json(200, { summary: "Imported.", counts: {} }));
    await new HearthApi(fakeConnection(), () => auth).importBundle(bundle(), false);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer fresh" });
  });

  it("shows a busy state with the controls disabled while uploading", async () => {
    let finish!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => (finish = r)));
    const { el } = await mount();
    await choose(el, bundle());
    expect(content(el)).toContain("Uploading and importing…");
    expect(root(el).querySelector<HTMLInputElement>("#import-file")!.disabled).toBe(true);
    expect(button(el, "Export now")!.disabled).toBe(true);
    finish(json(200, { summary: "Imported 2 people.", counts: {} }));
    await settle(el);
    expect(content(el)).not.toContain("Uploading and importing…");
    expect(root(el).querySelector<HTMLInputElement>("#import-file")!.disabled).toBe(false);
  });

  it("import offers replace only for local changes", async () => {
    fetchMock.mockResolvedValueOnce(json(422, { reason: "local_changes", message: "Pass replace_existing: true to overwrite.", problems: [] }));
    const { el } = await mount();
    await choose(el, bundle());
    expect(content(el)).toContain("Your Hearth has changes made here since the last import. Importing replaces everything in it.");
    expect(content(el)).not.toContain("replace_existing");
    const replace = button(el, "Replace everything")!;
    expect(replace.classList.contains("danger")).toBe(true);

    fetchMock.mockResolvedValueOnce(json(200, { summary: "Imported 5 people.", counts: {} }));
    replace.click();
    await settle(el);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retry = fetchMock.mock.calls[1][1].body as FormData;
    expect(retry.get("replace_existing")).toBe("true");
    expect((retry.get("file") as File).name).toBe("hearth-export.zip");
    expect(content(el)).toContain("Imported 5 people.");
    expect(button(el, "Replace everything")).toBeUndefined();
  });

  it("cancelling the replace offer drops it and the file", async () => {
    fetchMock.mockResolvedValue(json(422, { reason: "local_changes", message: "x", problems: [] }));
    const { el } = await mount();
    await choose(el, bundle());
    button(el, "Cancel")!.click();
    await settle(el);
    expect(button(el, "Replace everything")).toBeUndefined();
    expect(content(el)).not.toContain("changes made here");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaving Settings drops a refused import", async () => {
    fetchMock.mockResolvedValue(json(422, { reason: "local_changes", message: "x", problems: [] }));
    const { el } = await mount();
    await choose(el, bundle());
    el.route = { prefix: "/hearth", path: "/" };
    await settle(el);
    el.route = { prefix: "/hearth", path: "/settings" };
    await settle(el);
    expect(button(el, "Replace everything")).toBeUndefined();
    expect(content(el)).not.toContain("changes made here");
  });

  it("import after cutover explains and offers nothing", async () => {
    fetchMock.mockResolvedValue(json(422, { reason: "cutover_confirmed", message: "x", problems: [] }));
    const { el } = await mount();
    await choose(el, bundle());
    expect(content(el)).toContain("Imports are turned off because this Hearth is now your main copy.");
    expect(button(el, "Replace everything")).toBeUndefined();
  });

  it("invalid bundle lists its problems", async () => {
    fetchMock.mockResolvedValue(json(422, { reason: "invalid", message: "bad", problems: ["people.json is missing", "2 people have no name"] }));
    const { el } = await mount();
    await choose(el, bundle());
    const items = [...root(el).querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["people.json is missing", "2 people have no name"]);
    expect(button(el, "Replace everything")).toBeUndefined();
  });

  it("a backup in progress is the backup toast, not a refusal card", async () => {
    fetchMock.mockResolvedValue(json(422, { reason: "backup_in_progress", message: "x", problems: [] }));
    const { el } = await mount();
    await choose(el, bundle());
    expect(root(el).querySelector(".toast")?.textContent).toContain("Home Assistant is making a backup. Try again in a moment.");
    expect(root(el).querySelector("[role=alert]")).toBeNull();
  });

  it("an unexpected plain-text server error says so", async () => {
    fetchMock.mockResolvedValue(new Response("500 Internal Server Error", { status: 500 }));
    const { el } = await mount();
    await choose(el, bundle());
    expect(root(el).querySelector(".toast")?.textContent).toBe("Import failed unexpectedly; see the Home Assistant log.");
  });

  it("an upload that can't reach the server is refused as offline", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { el } = await mount();
    await choose(el, bundle());
    expect(root(el).querySelector(".toast")?.textContent).toContain("You're offline.");
  });
});
