import { html, type TemplateResult } from "lit";
import type { TopBarAction } from "../components";
import type { Route } from "../router";
import type { Store } from "../store";
import type { Snapshot } from "../types";

// What every screen hands the shell: its top bar and its body, plus an optional overlay
// (a sheet or dialog) drawn above everything.
export interface View {
  title: string | null;
  back: boolean;
  actions: TopBarAction[];
  body: TemplateResult;
  overlay?: TemplateResult;
}

/** A screen draws one route from the store's current snapshot. Called on every render. */
export type Screen = (store: Store, route: Route) => View;

/** The snapshot a screen draws from. Screens only run in the ready phase, which always has one. */
export function snapshotOf(store: Store): Snapshot {
  if (!store.snapshot) throw new Error("No snapshot to draw from");
  return store.snapshot;
}

/**
 * A detail screen whose record is gone: deleted elsewhere (by Claude, an import, another tab)
 * while it was open, or a stale link. The next snapshot redraws the screen into this.
 */
export function notFound(what: "person" | "household" | "group" | "interaction"): View {
  return { title: null, back: true, actions: [], body: html`<div class="empty">This ${what} no longer exists.</div>` };
}

/** A record just created whose snapshot is still on its way (`store.isArriving`). */
export const arriving: View = {
  title: null,
  back: true,
  actions: [],
  body: html`<div class="center"><div><div class="spinner"></div></div></div>`,
};
