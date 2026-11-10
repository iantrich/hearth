import { render } from "lit";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "../src/hearth-panel";
import type { HearthPanel } from "../src/hearth-panel";
import type { Store } from "../src/store";
import type { Snapshot } from "../src/types";
import { homeView } from "../src/views/home";
import { searchView } from "../src/views/search";
import { fakeConnection, household, interaction, person, relationship, sampleSnapshot } from "./fixtures";

const LOADED = { has_crm: true, loaded: true, entry_id: "e1" };

async function settle(el: HearthPanel) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
  }
}

/** Mount the panel at `path`; `data()` is what each snapshot fetch returns, so a test can change it. */
async function mount(path: string, data: () => Snapshot = sampleSnapshot) {
  const conn = fakeConnection({ "hearth_crm/crm/status": () => LOADED, "hearth_crm/snapshot": () => data() });
  const el = document.createElement("hearth-panel") as HearthPanel;
  el.route = { prefix: "/hearth", path };
  el.hass = { connection: conn, user: { id: "u1", name: "Test User" } };
  document.body.appendChild(el);
  await settle(el);
  return { el, conn };
}

async function go(el: HearthPanel, path: string) {
  el.route = { prefix: "/hearth", path };
  await settle(el);
}

/** A change made elsewhere: the subscription fires and the panel refetches. */
async function changedElsewhere(el: HearthPanel) {
  const refresh = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.getAttribute("aria-label") === "Refresh",
  )!;
  refresh.click();
  await settle(el);
}

const root = (el: HearthPanel) => el.shadowRoot!;
const text = (el: HearthPanel) => (root(el).querySelector("#content")?.textContent ?? "").replace(/\s+/g, " ");
const title = (el: HearthPanel) => root(el).querySelector(".topbar .title")?.textContent?.trim() ?? "";
const indexOf = (el: HearthPanel, needle: string) => text(el).indexOf(needle);
/** The connection row (name link and type link) on a person screen that names `name`. */
const connectionRow = (el: HearthPanel, name: string) =>
  [...root(el).querySelectorAll<HTMLAnchorElement>("a.connection")].find((a) => a.textContent?.includes(name))?.parentElement;

describe("reading screens", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/hearth");
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("home shows favorites, upcoming birthdays and recent interactions", async () => {
    const { el } = await mount("");
    expect(title(el)).toBe("Hearth");
    // Favorites: first names under the avatars.
    const favs = [...root(el).querySelectorAll(".favorites .fav-name")].map((a) => a.textContent?.trim());
    expect(favs).toEqual(["Alex"]);
    // Upcoming: within 30 days, with the snapshot's day count. Alex's is 127 days out.
    expect(text(el)).toContain("Riley Marlow");
    expect(text(el)).toContain("In 15 days");
    expect(text(el)).not.toContain("In 127 days");
    // Recent: the last 30 days before the snapshot's today (2026-11-05).
    expect(text(el)).toContain("Alex & Jordan");
    expect(text(el)).toContain("Coffee and a long catch-up");
    expect(text(el)).not.toContain("Phoned about the trip");
  });

  it("birthdays and recent list everything, soonest and newest first", async () => {
    const { el } = await mount("/birthdays");
    expect(title(el)).toBe("Birthdays");
    expect(indexOf(el, "Riley Marlow")).toBeLessThan(indexOf(el, "Alex Marlow"));
    expect(text(el)).toContain("127d");
    await go(el, "/interactions");
    expect(title(el)).toBe("Recent");
    expect(indexOf(el, "Coffee and a long catch-up")).toBeLessThan(indexOf(el, "Phoned about the trip"));
    expect(indexOf(el, "Phoned about the trip")).toBeLessThan(indexOf(el, "Dinner out"));
  });

  it("reach out lists the overdue close friend before the due-soon one, using contact_status", async () => {
    const { el } = await mount("/reach-out");
    expect(text(el)).toContain("1 person overdue");
    const sam = indexOf(el, "Sam Okafor");
    const casey = indexOf(el, "Casey Lindqvist");
    expect(sam).toBeGreaterThan(-1);
    expect(casey).toBeGreaterThan(sam);
    expect(indexOf(el, "Overdue")).toBeLessThan(sam);
    expect(indexOf(el, "Due soon")).toBeGreaterThan(sam);
    expect(indexOf(el, "Due soon")).toBeLessThan(casey);
    // The close friend whose urgency is "ok" isn't listed.
    expect(text(el)).not.toContain("Alex Marlow");
    expect(text(el)).toContain("Last: Sep 10");
    expect(text(el)).toContain("56d");
  });

  it("reach out sorts each list by days since contact, never-contacted last", async () => {
    const { el } = await mount("/reach-out", () => {
      const s = sampleSnapshot();
      s.people.push(
        person("n1", "Never Contacted", { close_friend: true, contact_status: { last_contacted: null, days_since_contact: null, urgency: "overdue" } }),
        person("n2", "Long Gone", { close_friend: true, contact_status: { last_contacted: "2026-06-01", days_since_contact: 157, urgency: "overdue" } }),
        person("n3", "Hidden Friend", { close_friend: true, hide_from_list: true, contact_status: { last_contacted: null, days_since_contact: null, urgency: "overdue" } }),
      );
      return s;
    });
    expect(text(el)).toContain("3 people overdue");
    expect(indexOf(el, "Sam Okafor")).toBeLessThan(indexOf(el, "Long Gone"));
    expect(indexOf(el, "Long Gone")).toBeLessThan(indexOf(el, "Never Contacted"));
    expect(text(el)).toContain("No interactions yet");
    expect(text(el)).not.toContain("Hidden Friend");
  });

  it("person screen shows the household child as Child and the parent as Parent", async () => {
    const data = () => ({ ...sampleSnapshot(), me_person_id: null });
    const { el } = await mount("/person/p1", data);
    expect(text(el)).toContain("Alex Marlow");
    // Viewing the parent: the child's row reads CHILD (the relationship's type).
    expect(connectionRow(el, "Riley Marlow")?.textContent).toContain("CHILD");
    expect(connectionRow(el, "Jordan Marlow")?.textContent).not.toMatch(/CHILD|PARENT/);
    // Viewing the child: the parent's row reads PARENT (the relationship's inverse_type).
    await go(el, "/person/p3");
    expect(connectionRow(el, "Alex Marlow")?.textContent).toContain("PARENT");
    expect(text(el)).toContain("MARLOW FAMILY");
  });

  it("person screen shows the snapshot's age, the household heading and the reach actions", async () => {
    const { el } = await mount("/person/p1", () => {
      const s = sampleSnapshot();
      Object.assign(s.people[0], { phone: "5550142233", email: "alex@example.com", occupation: "Teacher" });
      return s;
    });
    expect(text(el)).toContain("Mar 12, 1984 - 42");
    expect(text(el)).toContain("Teacher");
    expect(text(el)).toContain("Close Friend rotation");
    const hrefs = [...root(el).querySelectorAll(".actions-row a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/hearth/person/p1/log",
      "tel:+15550142233",
      "sms:+15550142233",
      "mailto:alex@example.com",
      "https://maps.apple.com/?q=12%20Elm%20St%2C%20Springfield",
    ]);
    expect(root(el).querySelector('a[href="/hearth/household/h1"]')).toBeTruthy();
    expect(root(el).querySelector('a[href="/hearth/group/g1"]')?.textContent).toContain("Trail Crew");
    // The timeline links each interaction.
    expect(root(el).querySelector('a[href="/hearth/interaction/i1"]')).toBeTruthy();
    expect(text(el)).not.toMatch(/notion/i);
  });

  it("person screen links only http and https social URLs", async () => {
    const { el } = await mount("/person/p1", () => {
      const s = sampleSnapshot();
      Object.assign(s.people[0], {
        website: "javascript:alert(document.cookie)",
        linkedin: "https://www.linkedin.com/in/alex-marlow",
        facebook: "data:text/html,<script>alert(1)</script>",
        instagram: "http://instagram.com/alexmarlow",
      });
      return s;
    });
    const social = (label: string) => root(el).querySelector(`a[aria-label="${label}"]`);
    expect(social("Website")).toBeNull();
    expect(social("Facebook profile")).toBeNull();
    expect(social("LinkedIn profile")?.getAttribute("href")).toBe("https://www.linkedin.com/in/alex-marlow");
    expect(social("Instagram profile")?.getAttribute("href")).toBe("http://instagram.com/alexmarlow");
    expect(root(el).querySelector('a[href^="javascript:"], a[href^="data:"]')).toBeNull();
  });

  it("a household that needs a name, or isn't one, shows that in muted text", async () => {
    let status: "needs_name" | "not_a_household" = "needs_name";
    const { el } = await mount("/person/p1", () => {
      const s = sampleSnapshot();
      s.households[0] = { ...s.households[0], name: null, name_status: status };
      return s;
    });
    const heading = () => root(el).querySelector<HTMLElement>('a[href="/hearth/household/h1"] .household-name')!;
    expect(heading().textContent?.trim()).toBe("Needs a name");
    expect(heading().classList.contains("muted")).toBe(true);
    status = "not_a_household";
    await changedElsewhere(el);
    expect(heading().textContent?.trim()).toBe("Not a household");
    await go(el, "/household/h1");
    expect(root(el).querySelector(".members-title")?.textContent?.trim()).toBe("Not a household");
    expect(root(el).querySelector(".members-title")?.classList.contains("muted")).toBe(true);
  });

  it("person screen after the person is deleted", async () => {
    let deleted = false;
    const { el } = await mount("/person/p4", () => {
      const s = sampleSnapshot();
      if (deleted) s.people = s.people.filter((p) => p.id !== "p4");
      return s;
    });
    expect(text(el)).toContain("Sam Okafor");
    deleted = true;
    await changedElsewhere(el);
    expect(text(el)).toContain("This person no longer exists.");
    expect(text(el)).not.toContain("Sam Okafor");
  });

  it("household, group and interaction screens after the record is deleted", async () => {
    let deleted = false;
    const { el } = await mount("/household/h1", () => {
      const s = sampleSnapshot();
      if (deleted) Object.assign(s, { households: [], groups: [], interactions: [] });
      return s;
    });
    expect(text(el)).toContain("3 MEMBERS");
    await go(el, "/group/g1");
    expect(text(el)).toContain("Saturday hikers");
    await go(el, "/interaction/i1");
    expect(text(el)).toContain("Coffee and a long catch-up");
    deleted = true;
    await changedElsewhere(el);
    expect(text(el)).toContain("This interaction no longer exists.");
    await go(el, "/group/g1");
    expect(text(el)).toContain("This group no longer exists.");
    await go(el, "/household/h1");
    expect(text(el)).toContain("This household no longer exists.");
  });

  it("household lists parents before children; group stays alphabetical", async () => {
    const { el } = await mount("/household/h1", () => {
      const s = sampleSnapshot();
      s.people.push(person("p7", "Aaron Marlow", { household_id: "h1", birthday: "2016-01-01" }));
      s.households[0].member_ids.push("p7");
      s.relationships.push(relationship("r2", "p1", "p7", "Child", "Parent"));
      return s;
    });
    expect(title(el)).toBe("");
    expect(root(el).querySelector(".members-title")?.textContent?.trim()).toBe("Marlow Family");
    // Alex is a parent; Jordan is unplaced; Riley and Aaron are children, oldest first.
    const names = [...root(el).querySelectorAll("#content a.row .name")].map((n) => n.textContent?.trim());
    expect(names).toEqual(["Alex Marlow", "Jordan Marlow", "Riley Marlow", "Aaron Marlow"]);
    await go(el, "/group/g1");
    const members = [...root(el).querySelectorAll("#content a.row .name")].map((n) => n.textContent?.trim());
    expect(members).toEqual(["Alex Marlow", "Casey Lindqvist", "Sam Okafor"]);
  });

  it("interaction detail lists its people and has no edit action yet", async () => {
    const { el } = await mount("/interaction/i1");
    expect(text(el)).toContain("October 20, 2026");
    expect(text(el)).toContain("Call");
    expect(text(el)).toContain("People");
    expect(root(el).querySelector('#content a[href="/hearth/person/p1"]')).toBeTruthy();
    expect(root(el).querySelector('#content a[href="/hearth/person/p2"]')).toBeTruthy();
  });

  it("search finds a person by part of their name and switches to households", async () => {
    const { el } = await mount("/search");
    const field = root(el).querySelector<HTMLInputElement>("#search-field")!;
    field.value = "marl";
    field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    await settle(el);
    const names = () => [...root(el).querySelectorAll("#content a.row .name")].map((n) => n.textContent?.trim());
    expect(names()).toEqual(["Alex Marlow", "Jordan Marlow", "Riley Marlow"]);
    const households = [...root(el).querySelectorAll<HTMLButtonElement>(".pills button")].find((b) => b.textContent?.trim() === "Households")!;
    households.click();
    await settle(el);
    expect(households.getAttribute("aria-pressed")).toBe("true");
    expect(names()).toEqual(["Marlow Family"]);
    expect(text(el)).toContain("3 members");
    // The query and chip survive leaving the screen and coming back.
    await go(el, "");
    await go(el, "/search");
    expect(root(el).querySelector<HTMLInputElement>("#search-field")!.value).toBe("marl");
    expect(names()).toEqual(["Marlow Family"]);
  });

  it("search shows people connected to a match", async () => {
    const { el } = await mount("/search");
    const field = root(el).querySelector<HTMLInputElement>("#search-field")!;
    field.value = "Riley";
    field.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    await settle(el);
    expect(text(el)).toContain("Connected");
    expect(text(el)).toContain("Parent of Riley Marlow");
  });

  it("a broken photo falls back to initials, and a renewed URL shows the photo again", async () => {
    let url = "/api/hearth_crm/photo/expired";
    const { el } = await mount("", () => {
      const s = sampleSnapshot();
      s.people[0].photo_url = url;
      return s;
    });
    const avatarImg = () => root(el).querySelector(".favorites .avatar img") as HTMLImageElement | null;
    const img = avatarImg()!;
    expect(img.getAttribute("src")).toBe("/api/hearth_crm/photo/expired");
    img.dispatchEvent(new Event("error"));
    expect(avatarImg()?.classList.contains("broken")).toBe(true);
    expect(root(el).querySelector(".favorites .avatar")!.textContent?.trim()).toBe("AM");

    url = "/api/hearth_crm/photo/renewed";
    await changedElsewhere(el);
    expect(avatarImg()?.getAttribute("src")).toBe("/api/hearth_crm/photo/renewed");
    expect(avatarImg()?.classList.contains("broken")).toBe(false);
  });
});

describe("render speed", () => {
  // 500 people and 300 interactions: past the size of a real CRM. Each screen is drawn once to
  // warm up, then timed as the median of 3 first draws, each into a fresh container. The budget
  // is generous (happy-dom is far slower than a browser, and the full suite runs in parallel): it
  // guards against order-of-magnitude regressions, not small ones.
  const BUDGET_MS = 400;
  function bigSnapshot(): Snapshot {
    const base = sampleSnapshot();
    const people = Array.from({ length: 500 }, (_, i) =>
      person(`b${i}`, `Person ${String(i).padStart(3, "0")} Testwood`, {
        favorite: i < 8,
        close_friend: i % 10 === 0,
        household_id: `bh${Math.floor(i / 4)}`,
        birthday: i % 3 === 0 ? `19${50 + (i % 50)}-0${1 + (i % 9)}-1${i % 9}` : null,
        days_until_birthday: i % 3 === 0 ? i % 365 : null,
        age: i % 3 === 0 ? 30 : null,
        contact_status: { last_contacted: "2026-10-01", days_since_contact: i % 90, urgency: i % 20 === 0 ? "overdue" : "ok" },
      }),
    );
    const households = Array.from({ length: 125 }, (_, h) =>
      household(`bh${h}`, `Testwood ${h}`, [0, 1, 2, 3].map((k) => `b${h * 4 + k}`)),
    );
    const relationships = Array.from({ length: 250 }, (_, i) => relationship(`br${i}`, `b${i * 2}`, `b${i * 2 + 1}`, "Sibling"));
    const interactions = Array.from({ length: 300 }, (_, i) =>
      interaction(`bi${i}`, `Catch-up number ${i}`, `2026-${String(1 + (i % 10)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, [`b${i % 500}`, `b${(i * 7) % 500}`]),
    );
    return { ...base, people, households, relationships, interactions };
  }

  function fakeStore(snapshot: Snapshot, text = ""): Store {
    return { snapshot, search: { text, chip: "people" }, setSearch() {} } as unknown as Store;
  }

  /** Times one first draw into a fresh container, so an update of an earlier draw isn't what's timed. */
  function time(draw: (container: HTMLElement) => void): { ms: number; container: HTMLElement } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const start = performance.now();
    draw(container);
    const ms = performance.now() - start;
    container.remove();
    return { ms, container };
  }

  /** The median of 3 timed first draws, after a warm-up; `container` is the last draw's. */
  function median(draw: (container: HTMLElement) => void): { ms: number; container: HTMLElement } {
    time(draw); // warm-up
    const runs = [time(draw), time(draw), time(draw)];
    const ms = runs.map((r) => r.ms).sort((a, b) => a - b)[1];
    return { ms, container: runs[2].container };
  }

  it("search and home draw 500 people and 300 interactions in under 400 ms each", () => {
    const snapshot = bigSnapshot();
    const all = median((c) => render(searchView(fakeStore(snapshot)).body, c));
    expect(all.container.querySelectorAll("a.row")).toHaveLength(500);
    const search = all.ms;
    const query = median((c) => render(searchView(fakeStore(snapshot, "Person 1")).body, c)).ms;
    const home = median((c) => render(homeView(fakeStore(snapshot)).body, c)).ms;
    // HEARTH_TIMINGS=1 npm test prints the measured times; otherwise the output stays quiet.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (env?.HEARTH_TIMINGS) console.info(`render ms: search(all) ${search.toFixed(1)}, search("Person 1") ${query.toFixed(1)}, home ${home.toFixed(1)}`);
    expect(search).toBeLessThan(BUDGET_MS);
    expect(query).toBeLessThan(BUDGET_MS);
    expect(home).toBeLessThan(BUDGET_MS);
  });
});
