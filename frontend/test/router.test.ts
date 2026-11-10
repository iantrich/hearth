import { afterEach, describe, expect, it, vi } from "vitest";
import { goBack, href, isTabRoot, navigate, parseRoute, tabOf } from "../src/router";

describe("router", () => {
  afterEach(() => vi.restoreAllMocks());

  it("round-trips every route through its href", () => {
    const path = (full: string) => full.replace("/hearth", "");
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("/")).toEqual({ name: "home" });
    expect(parseRoute(path(href.home()))).toEqual({ name: "home" });
    expect(parseRoute(path(href.search()))).toEqual({ name: "search" });
    expect(parseRoute(path(href.reachOut()))).toEqual({ name: "reachOut" });
    expect(parseRoute(path(href.add()))).toEqual({ name: "add" });
    expect(parseRoute(path(href.birthdays()))).toEqual({ name: "birthdays" });
    expect(parseRoute(path(href.interactions()))).toEqual({ name: "interactions" });
    expect(parseRoute(path(href.settings()))).toEqual({ name: "settings" });
    expect(parseRoute(path(href.person("a b/c")))).toEqual({ name: "person", id: "a b/c", sheet: null });
    expect(parseRoute(path(href.logInteraction("p1")))).toEqual({ name: "person", id: "p1", sheet: "log" });
    expect(parseRoute(path(href.household("h1")))).toEqual({ name: "household", id: "h1" });
    expect(parseRoute(path(href.group("g1")))).toEqual({ name: "group", id: "g1" });
    expect(parseRoute(path(href.interaction("i1")))).toEqual({ name: "interaction", id: "i1", sheet: null });
    expect(parseRoute("/interaction/x/edit")).toEqual({ name: "interaction", id: "x", sheet: "edit" });
    expect(parseRoute("/nonsense")).toEqual({ name: "home" });
    expect(parseRoute("/person")).toEqual({ name: "home" });
  });

  it("hrefs are full paths under /hearth", () => {
    expect(href.home()).toBe("/hearth");
    expect(href.person("a b")).toBe("/hearth/person/a%20b");
    expect(href.editInteraction("i1")).toBe("/hearth/interaction/i1/edit");
  });

  it("knows which screens are tab roots", () => {
    expect(tabOf(parseRoute("/search"))).toBe("search");
    expect(tabOf(parseRoute("/person/p"))).toBeNull();
    expect(isTabRoot({ name: "home" })).toBe(true);
    expect(isTabRoot({ name: "settings" })).toBe(false);
  });

  it("navigate pushes or replaces the URL and tells Home Assistant", () => {
    const push = vi.spyOn(history, "pushState");
    const replace = vi.spyOn(history, "replaceState");
    const seen: string[] = [];
    const listener = () => seen.push(location.pathname);
    window.addEventListener("location-changed", listener);
    navigate("/hearth/search");
    navigate("/hearth/add", true);
    window.removeEventListener("location-changed", listener);
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["/hearth/search", "/hearth/add"]);
  });

  it("back goes through history after an in-panel navigation, else to the fallback", () => {
    navigate("/hearth/person/p1", true);
    const back = vi.spyOn(history, "back").mockImplementation(() => {});
    history.replaceState(null, "", "/hearth/person/p1");
    goBack(href.home());
    expect(back).not.toHaveBeenCalled();
    expect(location.pathname).toBe("/hearth");

    navigate("/hearth/person/p1");
    goBack(href.home());
    expect(back).toHaveBeenCalledTimes(1);
  });
});
