import { html, nothing, type TemplateResult } from "lit";
import { topBarAction } from "./components";
import { icons } from "./icons";
import { goBack, href, type Route, type Tab } from "./router";
import type { Store } from "./store";
import { addView } from "./views/add";
import { birthdaysView, homeView, interactionsView } from "./views/home";
import { interactionView } from "./views/interaction";
import { groupEditView, groupNewView } from "./views/groupEdit";
import { householdEditView, householdNewView } from "./views/householdEdit";
import { groupView, householdView } from "./views/members";
import { personView } from "./views/person";
import { personEditView } from "./views/personEdit";
import { relationshipView } from "./views/relationshipSheet";
import { reachOutView } from "./views/reachOut";
import { searchView } from "./views/search";
import { settingsView } from "./views/settings";
import type { View } from "./views/view";

// Thread's Claude tab: an action, not a destination. It opens Claude, where Hearth's tools live.
export const CLAUDE_URL = "https://claude.ai/new";

const OFFLINE_NOTE = "Offline. Showing what was last loaded; changes are paused.";

/** The view for each route. */
export function viewFor(store: Store, route: Route): View {
  switch (route.name) {
    case "home":
      return homeView(store);
    case "search":
      return searchView(store);
    case "reachOut":
      return reachOutView(store);
    case "add":
      return addView(store);
    case "birthdays":
      return birthdaysView(store);
    case "interactions":
      return interactionsView(store);
    case "settings":
      return settingsView(store);
    case "person":
      return personView(store, route.id, route.sheet);
    case "personEdit":
      return personEditView(store, route.id);
    case "relationship":
      return relationshipView(store, route.personId, route.relId);
    case "household":
      return householdView(store, route.id);
    case "householdNew":
      return householdNewView(store);
    case "householdEdit":
      return householdEditView(store, route.id);
    case "group":
      return groupView(store, route.id);
    case "groupNew":
      return groupNewView(store);
    case "groupEdit":
      return groupEditView(store, route.id);
    case "interaction":
      return interactionView(store, route.id, route.sheet);
  }
}

/** What the shell needs from the panel besides the view. */
export interface ShellContext {
  store: Store;
  narrow: boolean;
  lastTab: Tab;
  toast: string | null;
  refreshing: boolean;
  onRefresh: () => void;
}

const TABS: { tab: Tab; href: string; icon: TemplateResult; label: string }[] = [
  { tab: "home", href: href.home(), icon: icons.home, label: "Home" },
  { tab: "search", href: href.search(), icon: icons.search, label: "Search" },
  { tab: "reachOut", href: href.reachOut(), icon: icons.bell, label: "Reach out" },
  { tab: "add", href: href.add(), icon: icons.plusCircle, label: "Add" },
];

// Claude sits between Search and Reach out, as on iOS.
function tabBar(lastTab: Tab): TemplateResult {
  const link = (t: (typeof TABS)[number]) =>
    html`<a href=${t.href} class=${lastTab === t.tab ? "active" : ""} aria-label=${t.label} title=${t.label}
      aria-current=${lastTab === t.tab ? "page" : "false"}>${t.icon}</a>`;
  return html`<nav class="tabbar">
    ${TABS.slice(0, 2).map(link)}
    <a href=${CLAUDE_URL} target="_blank" rel="noopener noreferrer" aria-label="Talk to Claude" title="Talk to Claude">${icons.mic}</a>
    ${TABS.slice(2).map(link)}
  </nav>`;
}

// On a phone HA hides its sidebar; this asks HA to slide it out.
function menuButton(): TemplateResult {
  const toggle = (e: Event) =>
    (e.currentTarget as HTMLElement).dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
  return html`<button class="icon-btn" aria-label="Menu" title="Menu" @click=${toggle}>${icons.menu}</button>`;
}

function toast(message: string | null): TemplateResult | typeof nothing {
  return message ? html`<div class="toast" role="status">${message}</div>` : nothing;
}

export function shell(view: View, ctx: ShellContext): TemplateResult {
  const showTopBar = ctx.narrow || view.back || view.title || view.actions.length;
  return html`<div class="shell">
    ${showTopBar
      ? html`<header class="topbar">
          ${ctx.narrow ? menuButton() : nothing}
          ${view.back
            ? html`<button class="icon-btn" aria-label="Back" title="Back" @click=${() => goBack(href.home())}>
                ${icons.back}
              </button>`
            : nothing}
          <span class="title">${view.title ?? ""}</span>
          ${view.actions.map(topBarAction)}
          <button class="icon-btn muted" aria-label="Refresh" title="Refresh" ?disabled=${ctx.refreshing} @click=${ctx.onRefresh}>
            ${icons.refresh}
          </button>
        </header>`
      : nothing}
    <main class="content" id="content">
      ${ctx.store.offline ? html`<div class="notice" role="status">${OFFLINE_NOTE}</div>` : nothing} ${view.body}
    </main>
    ${tabBar(ctx.lastTab)} ${view.overlay ?? nothing} ${toast(ctx.toast)}
  </div>`;
}

/** Loading, create, not-loaded and error screens: no tabs, but the menu stays reachable on a phone. */
export function statusShell(body: TemplateResult, ctx: Pick<ShellContext, "narrow" | "toast">): TemplateResult {
  return html`<div class="shell">
    ${ctx.narrow
      ? html`<header class="topbar">${menuButton()}<span class="title">Hearth</span></header>`
      : nothing}
    <main class="content status">${body}</main>
    ${toast(ctx.toast)}
  </div>`;
}
