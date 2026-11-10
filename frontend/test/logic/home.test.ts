import { describe, expect, it } from "vitest";
import { upcomingBirthdays } from "../../src/logic/birthdays";
import { addDays } from "../../src/logic/calendarDay";
import { favorites, MAX_FAVORITES } from "../../src/logic/favorites";
import {
  interactionPeople,
  interactionPeopleSummary,
  interactionsFor,
  visibleInteractions,
} from "../../src/logic/interactionFeed";
import { firstName } from "../../src/logic/names";
import type { Interaction, Person } from "../../src/types";
import { interaction as makeInteraction, person as makePerson } from "../fixtures";

const today = "2026-08-21";

describe("calendar days", () => {
  it("adds and subtracts whole days across month and year ends", () => {
    expect(addDays("2026-08-21", -30)).toBe("2026-07-22");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("birthdays", () => {
  const people = [
    makePerson("a", "Later", { birthday: "1990-09-10", days_until_birthday: 20 }),
    makePerson("b", "Sooner", { birthday: "1990-08-25", days_until_birthday: 4 }),
    makePerson("c", "Hidden", { birthday: "2015-08-22", days_until_birthday: 1, hide_from_list: true }),
    makePerson("d", "Unknown"),
    makePerson("e", "Also Sooner", { birthday: "1988-08-25", days_until_birthday: 4 }),
  ];

  it("lists upcoming birthdays soonest first, then by name, without hidden people", () => {
    expect(upcomingBirthdays(people).map((p) => [p.name, p.days_until_birthday])).toEqual([
      ["Also Sooner", 4],
      ["Sooner", 4],
      ["Later", 20],
    ]);
  });

  it("limits to a window of days, inclusive", () => {
    expect(upcomingBirthdays(people, 10).map((p) => p.name)).toEqual(["Also Sooner", "Sooner"]);
    expect(upcomingBirthdays(people, 20).map((p) => p.name)).toEqual(["Also Sooner", "Sooner", "Later"]);
  });

  it("keeps today's birthday at 0", () => {
    expect(upcomingBirthdays([makePerson("t", "Today", { birthday: "2000-08-21", days_until_birthday: 0 })], 0)).toHaveLength(1);
  });
});

describe("favorites", () => {
  const fav = (id: string, name: string, overrides: Partial<Person> = {}) => makePerson(id, name, { favorite: true, ...overrides });

  it("includes only visible favorites", () => {
    expect(favorites([fav("a", "Ada"), fav("b", "Bo", { favorite: false })]).map((p) => p.id)).toEqual(["a"]);
    expect(favorites([fav("a", "Ada"), fav("b", "Bo", { hide_from_list: true })]).map((p) => p.id)).toEqual(["a"]);
  });

  it("holds at most two rows of three, in source order", () => {
    expect(MAX_FAVORITES).toBe(6);
    const nine = Array.from({ length: 9 }, (_, i) => fav(`p${i}`, `Person ${i}`));
    expect(favorites(nine)).toHaveLength(6);
    const family = [fav("w", "Willa"), fav("o", "Otis"), fav("f", "Fern"), fav("b", "Bram")];
    expect(favorites(family).map((p) => p.name)).toEqual(["Willa", "Otis", "Fern", "Bram"]);
  });

  it("uses the leading word as the first name", () => {
    expect(firstName("Theo Brannock")).toBe("Theo");
    expect(firstName("Marisol")).toBe("Marisol");
    expect(firstName("Casey Lindqvist-Ober")).toBe("Casey");
    expect(firstName("  Wren Brannock ")).toBe("Wren");
    expect(firstName("   ")).toBe("");
  });
});

describe("interaction feed", () => {
  const person = (id: string, hidden = false) => makePerson(id, id, { hide_from_list: hidden });
  const interaction = (id: string, personIds: string[], daysAgo: number): Interaction =>
    makeInteraction(id, id, addDays(today, -daysAgo), personIds);
  const feed = (interactions: Interaction[], people: Person[], options: { since?: string; limit?: number } = {}) =>
    visibleInteractions(interactions, people, { limit: 10, ...options }).map((i) => i.id);

  it("hides an interaction whose only person is hidden", () => {
    expect(feed([interaction("i1", ["ghost"], 1)], [person("ghost", true)])).toEqual([]);
  });

  it("keeps an interaction when anyone on it is visible", () => {
    expect(feed([interaction("i1", ["ghost", "adam"], 1)], [person("ghost", true), person("adam")])).toEqual(["i1"]);
  });

  it("drops an interaction whose people are all unknown", () => {
    expect(feed([interaction("i1", ["nobody"], 1)], [person("adam")])).toEqual([]);
  });

  it("sorts newest first, then applies the limit", () => {
    const all = [interaction("old", ["adam"], 30), interaction("new", ["adam"], 1), interaction("mid", ["adam"], 10)];
    expect(feed(all, [person("adam")])).toEqual(["new", "mid", "old"]);
    expect(feed(all, [person("adam")], { limit: 2 })).toEqual(["new", "mid"]);
  });

  it("drops interactions before the cutoff", () => {
    const all = [interaction("old", ["adam"], 45), interaction("new", ["adam"], 5)];
    expect(feed(all, [person("adam")], { since: addDays(today, -30) })).toEqual(["new"]);
  });

  it("resolves people in relation order, skipping unknown ids", () => {
    const people = [person("harper"), person("adam")];
    expect(interactionPeople(interaction("i1", ["adam", "harper"], 1), people).map((p) => p.id)).toEqual(["adam", "harper"]);
    expect(interactionPeople(interaction("i1", ["nobody", "adam"], 1), people).map((p) => p.id)).toEqual(["adam"]);
  });

  it("lists one person's interactions newest first, hidden or not", () => {
    const all = [interaction("old", ["adam"], 30), interaction("other", ["bea"], 2), interaction("new", ["bea", "adam"], 1)];
    expect(interactionsFor(all, "adam").map((i) => i.id)).toEqual(["new", "old"]);
  });
});

describe("interaction people summary", () => {
  const names = (...list: string[]) => interactionPeopleSummary(list.map((n) => makePerson(n, n)));

  it("names one person in full", () => {
    expect(names("Adam Fenwick")).toBe("Adam Fenwick");
  });

  it("joins two first names", () => {
    expect(names("Adam Fenwick", "Harper Vale")).toBe("Adam & Harper");
    expect(names("Cher", "Prince")).toBe("Cher & Prince");
  });

  it("leads with one name and counts the rest past two", () => {
    expect(names("Adam Fenwick", "Harper Vale", "Quinn Vale")).toBe("Adam and 2 others");
    expect(names("Adam Fenwick", "Harper Vale", "Quinn Vale", "Priya Anand")).toBe("Adam and 3 others");
  });

  it("is empty with nobody", () => {
    expect(names()).toBe("");
  });
});
