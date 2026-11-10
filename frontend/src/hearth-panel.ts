import { LitElement, unsafeCSS, type PropertyValues, type TemplateResult } from "lit";
import { property, state } from "lit/decorators.js";
import { HearthApi, type Auth, type Connection } from "./api";
import { isPanelPath, navigate, PANEL_PATH, parseRoute, tabOf, type Route, type Tab } from "./router";
import { shell, statusShell, viewFor, type ShellContext } from "./shell";
import { Store } from "./store";
import styles from "./styles.css?inline";
import { crashScreen, createScreen, errorScreen, loadingScreen, notLoadedScreen } from "./views/status";

/** The slice of Home Assistant's `hass` object the panel uses. */
export interface Hass {
  connection: Connection;
  /** Used only to upload an import bundle. */
  auth?: Auth;
  user: { id: string; name: string };
}

/** HA's panel route: `prefix` is "/hearth", `path` is the rest, for example "/person/abc". */
export interface PanelRoute {
  prefix: string;
  path: string;
}

// The built panel is one bundled module, so this is the panel's own module URL there.
export { PANEL_VERSION } from "./version";

// HA hands the panel a new `hass` on every entity state change, often several times a second.
// The panel uses only the user and the connection, so anything else changing is no reason to
// draw again. Lit still stores the new object; it just doesn't schedule an update.
export function hassChanged(value: Hass | undefined, old: Hass | undefined): boolean {
  return value?.user?.id !== old?.user?.id || value?.connection !== old?.connection;
}

function routeChanged(value: PanelRoute | undefined, old: PanelRoute | undefined): boolean {
  return value?.path !== old?.path || value?.prefix !== old?.prefix;
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class HearthPanel extends LitElement {
  static styles = unsafeCSS(styles);

  @property({ attribute: false, hasChanged: hassChanged }) hass?: Hass;
  @property({ type: Boolean }) narrow = false;
  @property({ attribute: false, hasChanged: routeChanged }) route?: PanelRoute;
  @property({ attribute: false }) panel?: unknown;

  @state() private refreshing = false;

  private store: Store | null = null;
  /** The HA user the current store belongs to. A different user always gets a new store. */
  private storeUserId: string | null = null;
  private lastTab: Tab = "home";
  // Each screen keeps its scroll position for when you come back to it.
  private scrollPositions = new Map<string, number>();

  protected createRenderRoot() {
    const root = super.createRenderRoot();
    root.addEventListener("click", this.onClick as EventListener);
    return root;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Re-added after being removed: willUpdate builds the store again.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.dropStore();
  }

  private get currentRoute(): Route {
    return parseRoute(this.route?.path ?? "");
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    this.syncStore();
    if (changed.has("route")) {
      const previous = changed.get("route") as PanelRoute | undefined;
      const content = this.renderRoot.querySelector("#content");
      if (previous && content) this.scrollPositions.set(previous.path, content.scrollTop);
      this.lastTab = tabOf(this.currentRoute) ?? this.lastTab;
      // Before drawing: forms the route has left start fresh.
      this.store?.routeChanged(`${PANEL_PATH}${this.route?.path ?? ""}`);
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if (!changed.has("route") || !changed.get("route")) return;
    const content = this.renderRoot.querySelector("#content");
    if (content) content.scrollTop = this.scrollPositions.get(this.route?.path ?? "") ?? 0;
    if (this.currentRoute.name === "search") this.renderRoot.querySelector<HTMLElement>("#search-field")?.focus();
  }

  /** One store per HA user, built from hass.user.id, so one user's data never shows for another. */
  private syncStore(): void {
    const userId = this.isConnected ? (this.hass?.user?.id ?? null) : null;
    if (userId === this.storeUserId) return;
    this.dropStore();
    if (!userId || !this.hass) return;
    const store: Store = new Store(new HearthApi(this.hass.connection, () => this.hass?.auth), this.hass.connection, userId, browserStorage(), () =>
      this.onStoreChange(store),
    );
    this.store = store;
    this.storeUserId = userId;
    void store.start();
  }

  private dropStore(): void {
    this.store?.stop();
    this.store = null;
    this.storeUserId = null;
  }

  private onStoreChange(store: Store): void {
    if (store === this.store) this.requestUpdate();
  }

  private onRefresh = async (): Promise<void> => {
    if (!this.store || this.refreshing) return;
    this.refreshing = true;
    try {
      await this.store.refresh();
    } finally {
      this.refreshing = false;
    }
  };

  // Links to /hearth… move within the panel instead of reloading the page. External, tel:,
  // sms: and mailto: links, links with a target, and modified clicks are left to the browser.
  private onClick = (e: MouseEvent): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = e
      .composedPath()
      .find((node): node is HTMLAnchorElement => (node as Element).localName === "a");
    if (!anchor || anchor.hasAttribute("target") || anchor.hasAttribute("download")) return;
    const target = anchor.getAttribute("href");
    if (!target || !isPanelPath(target)) return;
    e.preventDefault();
    if (target !== `${location.pathname}${location.search}`) navigate(target);
  };

  protected render(): TemplateResult {
    const store = this.store;
    const status = { narrow: this.narrow, toast: store?.toast ?? null };
    if (!store) return statusShell(loadingScreen(), status);
    try {
      const phase = store.phase;
      switch (phase.kind) {
        case "loading":
          return statusShell(loadingScreen(), status);
        case "noCrm":
          return statusShell(createScreen(store), status);
        case "notLoaded":
          return statusShell(notLoadedScreen(store), status);
        case "error":
          return statusShell(errorScreen(store, phase.message), status);
        case "ready": {
          const ctx: ShellContext = { ...status, store, lastTab: this.lastTab, refreshing: this.refreshing, onRefresh: this.onRefresh };
          return shell(viewFor(store, this.currentRoute), ctx);
        }
      }
    } catch (error) {
      console.error(error);
      return statusShell(crashScreen(error), status);
    }
  }
}

if (!customElements.get("hearth-panel")) customElements.define("hearth-panel", HearthPanel);

declare global {
  interface HTMLElementTagNameMap {
    "hearth-panel": HearthPanel;
  }
}
