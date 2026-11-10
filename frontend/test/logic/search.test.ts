import { describe, expect, it } from "vitest";
import { searchPeople } from "../../src/logic/peopleSearch";
import type { Person, Relationship } from "../../src/types";
import { person as makePerson, relationship } from "../fixtures";

const person = (id: string, name: string) => makePerson(id, name);
const INVERSE: Record<string, string> = { Child: "Parent", Parent: "Child" };
const link = (a: string, b: string, type: string): Relationship => relationship(`${a}-${b}`, a, b, type, INVERSE[type] ?? type);
const cast = [person("theo", "Theo Brannock"), person("wren", "Wren Brannock"), person("kid", "Zoe Brannock")];
const search = (query: string, relationships: Relationship[] = [], people: Person[] = cast) =>
  searchPeople(query, people, relationships);

describe("ordering", () => {
  it("sorts results by name", () => {
    const result = search("", [], [person("zoe", "Zoe Adams"), person("adam", "Adam Baker"), person("mira", "Mira Castell")]);
    expect(result.direct.map((p) => p.id)).toEqual(["adam", "mira", "zoe"]);
  });

  it("sorts connected matches by name", () => {
    const result = search("Theo", [link("theo", "zoe", "Friend"), link("theo", "adam", "Friend")], [
      person("theo", "Theo Brannock"),
      person("zoe", "Zoe Adams"),
      person("adam", "Adam Baker"),
    ]);
    expect(result.connected.map((m) => m.person.id)).toEqual(["adam", "zoe"]);
  });
});

describe("direct matches", () => {
  it("matches by name, ignoring case", () => {
    expect(search("Theo").direct.map((p) => p.id)).toEqual(["theo"]);
    expect(search("tHeO").direct.map((p) => p.id)).toEqual(["theo"]);
  });

  it("matches part of a name", () => {
    expect(search("rann").direct.map((p) => p.id)).toEqual(["theo", "wren", "kid"]);
  });

  it("returns everyone and no connections for an empty query", () => {
    const result = search("", [link("theo", "wren", "Spouse")]);
    expect(result.direct).toHaveLength(3);
    expect(result.connected).toEqual([]);
  });

});

describe("connected matches", () => {
  it("surfaces people related to a direct match", () => {
    expect(search("Theo", [link("theo", "wren", "Spouse")]).connected.map((m) => m.person.id)).toEqual(["wren"]);
  });

  it("explains the connection from the connected person's side", () => {
    expect(search("Theo", [link("theo", "wren", "Spouse")]).connected[0]?.reason).toBe("Spouse of Theo Brannock");
    // "kid is the child of theo", so on the kid's row they're Theo's Child.
    expect(search("Theo", [link("theo", "kid", "Child")]).connected[0]?.reason).toBe("Child of Theo Brannock");
    // Stored the other way round, the snapshot's inverse_type gives the same answer.
    expect(search("Theo", [link("kid", "theo", "Parent")]).connected[0]?.reason).toBe("Child of Theo Brannock");
  });

  it("doesn't repeat direct matches as connected", () => {
    const result = search("Brannock", [link("theo", "wren", "Spouse")]);
    expect(result.direct).toHaveLength(3);
    expect(result.connected).toEqual([]);
  });

  it("lists someone related to two matches once", () => {
    const result = search("Brannock", [link("theo", "out", "Friend"), link("wren", "out", "Friend")], [
      person("theo", "Theo Brannock"),
      person("wren", "Wren Brannock"),
      person("out", "Outsider"),
    ]);
    expect(result.connected.map((m) => m.person.id)).toEqual(["out"]);
  });

  it("ignores unknown people and links that don't touch a match", () => {
    expect(search("Theo", [link("theo", "ghost", "Friend")], [person("theo", "Theo Brannock")]).connected).toEqual([]);
    expect(search("Theo", [link("wren", "kid", "Child")]).connected).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    const result = search("Zzz", [link("theo", "wren", "Spouse")]);
    expect(result.direct).toEqual([]);
    expect(result.connected).toEqual([]);
  });
});
