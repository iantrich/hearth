import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import css from "../src/styles.css?raw";
import { fakeConnection, sampleSnapshot, type FakeConnection, type Handler } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };
const NO_CRM = { has_crm: false, loaded: false, entry_id: null };

function hass(conn: FakeConnection, userId = "u1") {
  return { connection: conn, user: { id: userId, name: "Test User" } };
}

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

async function mount(handlers: Record<string, Handler>, opts: { narrow?: boolean; path?: string } = {}) {
  const conn = fakeConnection(handlers);
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.narrow = opts.narrow ?? false;
  el.route = { prefix: "/hearth", path: opts.path ?? "" };
  el.hass = hass(conn);
  document.body.appendChild(el);
  await settle(el);
  return { el, conn };
}

const text = (el: HearthPanel) => el.shadowRoot!.textContent ?? "";
const $ = <T extends Element = HTMLElement>(el: HearthPanel, selector: string) =>
  el.shadowRoot!.querySelector<T>(selector);
const button = (el: HearthPanel, label: string) =>
  [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.getAttribute("aria-label") === label || b.textContent?.trim() === label,
  );

const ready = { "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => sampleSnapshot() };

describe("hearth-panel", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/hearth");
  });
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders the create screen for a user without a CRM", async () => {
    const { el } = await mount({ "hearth_crm/crm/status": () => NO_CRM });
    expect(text(el)).toContain("Start your Hearth");
    expect(button(el, "Create my Hearth")).toBeTruthy();
  });

  it("create my Hearth creates the CRM and loads it", async () => {
    let created = false;
    const { el, conn } = await mount({
      "hearth_crm/crm/status": () => (created ? LOADED : NO_CRM),
      "hearth_crm/crm/create": () => { created = true; return { entry_id: "e1" }; },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    button(el, "Create my Hearth")!.click();
    await settle(el);
    expect(conn.sent.map((m) => m.type)).toContain("hearth_crm/crm/create");
    expect($(el, "nav.tabbar")).toBeTruthy();
  });

  it("a failed create stays on the create screen with the error next to the button", async () => {
    const { el } = await mount({
      "hearth_crm/crm/status": () => NO_CRM,
      "hearth_crm/crm/create": () => { throw { code: "create_failed", message: "Could not create" }; },
    });
    button(el, "Create my Hearth")!.click();
    await settle(el);
    expect(button(el, "Create my Hearth")).toBeTruthy();
    expect(text(el)).toContain("Could not create");
  });

  it("shows the not-loaded screen", async () => {
    const { el } = await mount({ "hearth_crm/crm/status": () => ({ has_crm: true, loaded: false, entry_id: "e1" }) });
    expect(text(el)).toContain("Your Hearth didn't load. Check Settings → Devices & services → Hearth.");
  });

  it("the not-loaded screen's Retry loads again", async () => {
    let loaded = false;
    const { el } = await mount({
      "hearth_crm/crm/status": () => ({ has_crm: true, loaded, entry_id: "e1" }),
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    expect(text(el)).toContain("Your Hearth didn't load.");
    loaded = true;
    button(el, "Retry")!.click();
    await settle(el);
    expect($(el, "nav.tabbar")).toBeTruthy();
  });

  it("the error screen's Retry loads again", async () => {
    let fail = true;
    const { el } = await mount({
      "hearth_crm/crm/status": () => {
        if (fail) throw { code: "unknown_error", message: "Something broke" };
        return LOADED;
      },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    expect(text(el)).toContain("Something broke");
    fail = false;
    button(el, "Retry")!.click();
    await settle(el);
    expect($(el, "nav.tabbar")).toBeTruthy();
    expect(text(el)).not.toContain("Something broke");
  });

  it("Retry shows a busy state while it loads", async () => {
    let fail = true;
    let release!: () => void;
    let gate: Promise<void> = Promise.resolve();
    const { el } = await mount({
      "hearth_crm/crm/status": async () => {
        await gate;
        if (fail) throw { code: "unknown_error", message: "Something broke" };
        return LOADED;
      },
      "hearth_crm/snapshot": () => sampleSnapshot(),
    });
    fail = false;
    gate = new Promise<void>((resolve) => (release = resolve));
    button(el, "Retry")!.click();
    await el.updateComplete;
    const busy = button(el, "Retrying…")!;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    release();
    await settle(el);
    expect($(el, "nav.tabbar")).toBeTruthy();
  });

  it("a new hass with the same user and connection does not re-render", async () => {
    const { el, conn } = await mount(ready);
    const render = vi.spyOn(el as unknown as { render: () => unknown }, "render");
    for (let i = 0; i < 5; i++) {
      el.hass = { ...hass(conn), states: { [`sensor.tick_${i}`]: {} } } as ReturnType<typeof hass>;
      el.route = { prefix: "/hearth", path: "" };
      await settle(el);
    }
    expect(render).not.toHaveBeenCalled();
    // A store change, a route change and narrow still draw.
    el.narrow = true;
    await settle(el);
    expect(render).toHaveBeenCalledTimes(1);
    el.route = { prefix: "/hearth", path: "/search" };
    await settle(el);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("a new connection for the same user re-renders", async () => {
    const { el } = await mount(ready);
    const render = vi.spyOn(el as unknown as { render: () => unknown }, "render");
    el.hass = hass(fakeConnection(ready));
    await settle(el);
    expect(render).toHaveBeenCalled();
  });

  it("renders the shell with the tab bar and the Claude link", async () => {
    const { el } = await mount(ready);
    const tabs = [...el.shadowRoot!.querySelectorAll("nav.tabbar a")].map((a) => a.getAttribute("href"));
    expect(tabs).toEqual(["/hearth", "/hearth/search", "https://claude.ai/new", "/hearth/reach-out", "/hearth/add"]);
    expect($(el, 'nav.tabbar a[aria-current="page"]')!.getAttribute("href")).toBe("/hearth");
  });

  it("narrow shell shows menu button that toggles the sidebar", async () => {
    const { el } = await mount(ready, { narrow: true });
    const toggled = vi.fn();
    window.addEventListener("hass-toggle-menu", toggled);
    const menu = button(el, "Menu");
    expect(menu).toBeTruthy();
    menu!.click();
    window.removeEventListener("hass-toggle-menu", toggled);
    expect(toggled).toHaveBeenCalledTimes(1);

    el.narrow = false;
    await settle(el);
    expect(button(el, "Menu")).toBeUndefined();
  });

  it("narrow status screens keep the menu button", async () => {
    const { el } = await mount({ "hearth_crm/crm/status": () => NO_CRM }, { narrow: true });
    expect(button(el, "Menu")).toBeTruthy();
  });

  it("clicking an internal link navigates without reloading", async () => {
    const { el } = await mount(ready);
    const push = vi.spyOn(history, "pushState");
    const changed = vi.fn();
    window.addEventListener("location-changed", changed);
    const link = $<HTMLAnchorElement>(el, 'a[href="/hearth/search"]')!;
    const click = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, button: 0 });
    link.dispatchEvent(click);
    window.removeEventListener("location-changed", changed);
    expect(click.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][2]).toBe("/hearth/search");
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("leaves external links and modified clicks alone", async () => {
    const { el } = await mount(ready);
    const push = vi.spyOn(history, "pushState");
    const claude = $<HTMLAnchorElement>(el, 'a[href="https://claude.ai/new"]')!;
    const external = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true });
    claude.addEventListener("click", (e) => e.preventDefault(), { once: true }); // keep happy-dom from opening it
    claude.dispatchEvent(external);
    const search = $<HTMLAnchorElement>(el, 'a[href="/hearth/search"]')!;
    const modified = new MouseEvent("click", { bubbles: true, composed: true, cancelable: true, metaKey: true });
    search.addEventListener("click", (e) => e.preventDefault(), { once: true });
    search.dispatchEvent(modified);
    expect(push).not.toHaveBeenCalled();
  });

  it("follows the route HA sets", async () => {
    const { el } = await mount(ready);
    el.route = { prefix: "/hearth", path: "/search" };
    await settle(el);
    expect($(el, 'nav.tabbar a[aria-current="page"]')!.getAttribute("href")).toBe("/hearth/search");
    el.route = { prefix: "/hearth", path: "/person/p1" };
    await settle(el);
    expect(button(el, "Back")).toBeTruthy();
    // A detail screen keeps the last tab highlighted.
    expect($(el, 'nav.tabbar a[aria-current="page"]')!.getAttribute("href")).toBe("/hearth/search");
  });

  it("refresh button refetches, and a refetch error shows as a toast", async () => {
    let snapshots = 0;
    const { el, conn } = await mount({
      "hearth_crm/crm/status": () => LOADED,
      "hearth_crm/snapshot": () => {
        snapshots++;
        if (snapshots > 1) throw { code: "backup_in_progress", message: "A backup is running" };
        return sampleSnapshot();
      },
    });
    button(el, "Refresh")!.click();
    await settle(el);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/snapshot")).toHaveLength(2);
    expect($(el, ".toast")?.textContent).toContain("A backup is running");
  });

  it("shows the offline banner while disconnected", async () => {
    const { el, conn } = await mount(ready);
    conn.fire("disconnected");
    await settle(el);
    expect(text(el)).toContain("Offline. Showing what was last loaded; changes are paused.");
  });

  it("a different HA user gets a fresh store and none of the first user's data", async () => {
    const { el, conn } = await mount(ready);
    expect($(el, "nav.tabbar")).toBeTruthy();
    const other = fakeConnection({ "hearth_crm/crm/status": () => NO_CRM });
    el.hass = hass(other, "u2");
    await settle(el);
    expect(conn.unsubscribed).toEqual([1]);
    expect(text(el)).toContain("Create my Hearth");
    // The old store's listeners are gone: a reconnect on the old socket sends nothing.
    const before = conn.sent.length;
    conn.fire("ready");
    await settle(el);
    expect(conn.sent.length).toBe(before);
  });

  it("stops the store when removed from the page and starts again when re-added", async () => {
    const { el, conn } = await mount(ready);
    el.remove();
    await settle(el);
    expect(conn.unsubscribed).toEqual([1]);
    document.body.appendChild(el);
    await settle(el);
    expect(conn.sent.filter((m) => m.type === "hearth_crm/subscribe")).toHaveLength(2);
    expect($(el, "nav.tabbar")).toBeTruthy();
  });

  it("styles take every color from the HA theme", () => {
    const stripped = stripVarCalls(css.replace(/\/\*[\s\S]*?\*\//g, ""));
    expect(stripped).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(stripped).not.toMatch(/\b(rgba?|hsla?)\(/i);
    expect(css).not.toMatch(/gradient\(/i);
    expect(css).not.toMatch(/color-scheme/i);
    // The safe area comes from HA's --safe-area-* variables; env() only as their last fallback.
    const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(uncommented).toContain("var(--safe-area-content-inset-left");
    expect(uncommented).toContain("var(--safe-area-inset-bottom");
    expect(stripVarCalls(uncommented, "var(--safe-area-")).not.toMatch(/env\(safe-area-inset/);
    for (const name of [
      "--primary-background-color", "--card-background-color", "--ha-card-background",
      "--primary-text-color", "--secondary-text-color", "--divider-color", "--primary-color",
      "--text-primary-color", "--error-color", "--warning-color", "--ha-font-family-body",
    ]) {
      expect(css).toContain(`var(${name}`);
    }
  });
});

/** Replace every call starting with `prefix` (fallbacks and nesting included) by a token. */
function stripVarCalls(source: string, prefix = "var("): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    if (source.startsWith(prefix, i)) {
      let depth = 0;
      let j = source.indexOf("(", i);
      for (; j < source.length; j++) {
        if (source[j] === "(") depth++;
        else if (source[j] === ")" && --depth === 0) break;
      }
      out += "VAR";
      i = j + 1;
    } else {
      out += source[i++];
    }
  }
  return out;
}
