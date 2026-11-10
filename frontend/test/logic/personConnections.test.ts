import { describe, expect, it } from "vitest";
import { buildPersonConnections, connectionTo, isEmptyConnections } from "../../src/logic/personConnections";
import type { ContactGroup, Household, Person, Relationship } from "../../src/types";
import { group as makeGroup, household as makeHousehold, person as makePerson, relationship } from "../fixtures";

const me = "owner";
const capitalized = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const person = (id: string, birthday: string | null = null): Person => makePerson(id, capitalized(id), { birthday });
const household = (name: string, memberIds: string[]): Household => makeHousehold("h", name, memberIds);
const group = (id: string, memberIds: string[]): ContactGroup => makeGroup(id, capitalized(id), memberIds);
const INVERSE: Record<string, string> = { Child: "Parent", Parent: "Child" };
// b is `type` of a.
const link = (id: string, a: string, b: string, type: string): Relationship => relationship(id, a, b, type, INVERSE[type] ?? type);

function build(
  personId: string,
  people: Person[],
  { households = [], groups = [], relationships = [] }: { households?: Household[]; groups?: ContactGroup[]; relationships?: Relationship[] } = {},
) {
  return buildPersonConnections(personId, { people, households, groups, relationships, excludedId: me });
}

describe("connectionTo", () => {
  it("reads type from person A's side and inverse_type from person B's", () => {
    const r = link("r", "dana", "alex", "Child");
    expect(connectionTo(r, "dana")).toEqual({ otherId: "alex", type: "Child" });
    expect(connectionTo(r, "alex")).toEqual({ otherId: "dana", type: "Parent" });
  });

  it("is null for someone not on the link and for a self-link", () => {
    expect(connectionTo(link("r", "dana", "alex", "Child"), "pat")).toBeNull();
    expect(connectionTo(link("r", "dana", "dana", "Other"), "dana")).toBeNull();
  });
});

describe("household", () => {
  it("groups members under the household", () => {
    const result = build("quinn", [person("quinn"), person("harper"), person("lena")], {
      households: [household("Quinn & Harper Vale", ["quinn", "harper", "lena"])],
    });
    expect(result.household?.name).toBe("Quinn & Harper Vale");
    expect(result.householdMembers.map((r) => r.person.id)).toEqual(["harper", "lena"]);
  });

  it("doesn't list the subject among their own household", () => {
    const result = build("quinn", [person("quinn"), person("harper")], { households: [household("Vale", ["quinn", "harper"])] });
    expect(result.householdMembers.some((r) => r.person.id === "quinn")).toBe(false);
  });

  it("is alphabetical with no relationship data", () => {
    const result = build("quinn", [person("quinn"), person("harper"), person("lena")], {
      households: [household("Vale", ["quinn", "lena", "harper"])],
    });
    expect(result.householdMembers.map((r) => r.person.id)).toEqual(["harper", "lena"]);
  });

  it("orders parents before children", () => {
    const result = build("quinn", [person("quinn"), person("dana", "1980-01-01"), person("alex", "2015-01-01")], {
      households: [household("Vale", ["quinn", "alex", "dana"])],
      relationships: [link("r", "dana", "alex", "Child")],
    });
    // Alphabetically Alex precedes Dana; being the parent puts Dana first.
    expect(result.householdMembers.map((r) => r.person.id)).toEqual(["dana", "alex"]);
  });

  it("is absent for someone with no household", () => {
    const result = build("quinn", [person("quinn")]);
    expect(result.household).toBeNull();
    expect(result.householdMembers).toEqual([]);
  });

  it("carries each member's connection type, or null without a record", () => {
    const withType = build("quinn", [person("quinn"), person("lena")], {
      households: [household("Vale", ["quinn", "lena"])],
      relationships: [link("r", "quinn", "lena", "Child")],
    });
    expect(withType.householdMembers[0]?.connectionType).toBe("Child");
    const fromChild = build("lena", [person("quinn"), person("lena")], {
      households: [household("Vale", ["quinn", "lena"])],
      relationships: [link("r", "quinn", "lena", "Child")],
    });
    expect(fromChild.householdMembers[0]?.connectionType).toBe("Parent");
    const without = build("quinn", [person("quinn"), person("lena")], { households: [household("Vale", ["quinn", "lena"])] });
    expect(without.householdMembers[0]?.connectionType).toBeNull();
  });
});

describe("others", () => {
  it("orients the type from the subject's side, using inverse_type", () => {
    // "lena is the child of quinn", so on Lena's screen Quinn is her Parent.
    const result = build("lena", [person("quinn"), person("lena")], { relationships: [link("r", "quinn", "lena", "Child")] });
    expect(result.others[0]?.connectionType).toBe("Parent");
  });

  it("holds relationships outside the household, without repeating members", () => {
    const result = build("quinn", [person("quinn"), person("harper"), person("tobin")], {
      households: [household("Vale", ["quinn", "harper"])],
      relationships: [link("r1", "quinn", "harper", "Spouse"), link("r2", "quinn", "tobin", "Coworker")],
    });
    expect(result.householdMembers.map((r) => r.person.id)).toEqual(["harper"]);
    expect(result.others.map((r) => r.person.id)).toEqual(["tobin"]);
  });

  it("sorts same-type connections by name", () => {
    const result = build("quinn", [person("quinn"), person("zoe"), person("alice")], {
      relationships: [link("r1", "quinn", "zoe", "Friend"), link("r2", "quinn", "alice", "Friend")],
    });
    expect(result.others.map((r) => r.person.id)).toEqual(["alice", "zoe"]);
  });

  it("excludes the owner from others and from household members", () => {
    expect(build("quinn", [person("quinn"), person(me)], { relationships: [link("r", "quinn", me, "College Friend")] }).others).toEqual([]);
    const result = build("harper", [person("harper"), person(me), person("lena")], {
      households: [household("Vale", ["harper", me, "lena"])],
    });
    expect(result.householdMembers.map((r) => r.person.id)).toEqual(["lena"]);
  });

  it("still shows the owner's people on the owner's own screen", () => {
    const result = build(me, [person(me), person("tobin")], { relationships: [link("r", me, "tobin", "Friend")] });
    expect(result.others.map((r) => r.person.id)).toEqual(["tobin"]);
  });

  it("skips unknown people, duplicate pairs and self-links", () => {
    expect(build("quinn", [person("quinn")], { relationships: [link("r", "quinn", "ghost", "Friend")] }).others).toEqual([]);
    const duplicates = build("quinn", [person("quinn"), person("tobin")], {
      relationships: [link("r1", "quinn", "tobin", "Coworker"), link("r2", "quinn", "tobin", "Friend")],
    });
    expect(duplicates.others.map((r) => [r.person.id, r.connectionType])).toEqual([["tobin", "Coworker"]]);
    expect(build("quinn", [person("quinn")], { relationships: [link("r", "quinn", "quinn", "Other")] }).others).toEqual([]);
  });
});

describe("groups", () => {
  it("returns only groups containing the person, by name", () => {
    const result = build("quinn", [person("quinn")], {
      groups: [group("younger", ["quinn"]), group("hikers", ["quinn", "tobin"]), group("college", ["tobin"])],
    });
    expect(result.groups.map((g) => g.id)).toEqual(["hikers", "younger"]);
  });
});

describe("emptiness", () => {
  it("is empty with nothing to show", () => {
    expect(isEmptyConnections(build("quinn", [person("quinn")]))).toBe(true);
  });

  it("isn't empty with only groups or only a household", () => {
    expect(isEmptyConnections(build("quinn", [person("quinn")], { groups: [group("hikers", ["quinn"])] }))).toBe(false);
    expect(
      isEmptyConnections(build("quinn", [person("quinn"), person("harper")], { households: [household("Vale", ["quinn", "harper"])] })),
    ).toBe(false);
  });

  it("drops a one-person household rather than heading an empty list", () => {
    const result = build("quinn", [person("quinn")], { households: [household("Vale", ["quinn"])] });
    expect(result.household).toBeNull();
    expect(isEmptyConnections(result)).toBe(true);
  });
});
