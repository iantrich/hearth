// Path routes under /hearth. Home Assistant hands the panel `route.path` (the part after
// /hearth), so deep links and the browser's back button work natively.

export type Tab = "home" | "search" | "reachOut" | "add";

export type Route =
  | { name: "home" }
  | { name: "search" }
  | { name: "reachOut" }
  | { name: "add" }
  | { name: "birthdays" }
  | { name: "interactions" }
  | { name: "settings" }
  | { name: "person"; id: string; sheet: "log" | null }
  | { name: "personEdit"; id: string }
  // The add/edit relationship sheet over a person's screen; relId is null for a new one.
  | { name: "relationship"; personId: string; relId: string | null }
  | { name: "household"; id: string }
  | { name: "householdNew" }
  | { name: "householdEdit"; id: string }
  | { name: "group"; id: string }
  | { name: "groupNew" }
  | { name: "groupEdit"; id: string }
  | { name: "interaction"; id: string; sheet: "edit" | null }
  | { name: "reminder"; id: string }
  | { name: "reminderNew"; personId: string }
  | { name: "interactionReminderNew"; interactionId: string };

export const PANEL_PATH = "/hearth";

/** `path` is the panel's route.path, for example "/person/abc"; "" or "/" is home. */
export function parseRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean).map(safeDecode);
  const [first, id, extra] = parts;
  switch (first) {
    case undefined:
      return { name: "home" };
    case "search":
      return { name: "search" };
    case "reach-out":
      return { name: "reachOut" };
    case "add":
      return { name: "add" };
    case "birthdays":
      return { name: "birthdays" };
    case "interactions":
      return { name: "interactions" };
    case "settings":
      return { name: "settings" };
    case "person":
      if (id && extra === "edit") return { name: "personEdit", id };
      if (id && extra === "reminder" && parts[3] === "new") return { name: "reminderNew", personId: id };
      if (id && extra === "relationship") {
        const relId = parts[3];
        if (relId) return { name: "relationship", personId: id, relId: relId === "new" ? null : relId };
      }
      if (id) return { name: "person", id, sheet: extra === "log" ? "log" : null };
      break;
    // Record ids are never "new".
    case "household":
      if (id === "new") return { name: "householdNew" };
      if (id && extra === "edit") return { name: "householdEdit", id };
      if (id) return { name: "household", id };
      break;
    case "group":
      if (id === "new") return { name: "groupNew" };
      if (id && extra === "edit") return { name: "groupEdit", id };
      if (id) return { name: "group", id };
      break;
    case "reminder":
      if (id) return { name: "reminder", id };
      break;
    case "interaction":
      if (id && extra === "reminder" && parts[3] === "new") return { name: "interactionReminderNew", interactionId: id };
      if (id) return { name: "interaction", id, sheet: extra === "edit" ? "edit" : null };
      break;
  }
  return { name: "home" };
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

const enc = encodeURIComponent;

export const href = {
  home: () => PANEL_PATH,
  search: () => `${PANEL_PATH}/search`,
  reachOut: () => `${PANEL_PATH}/reach-out`,
  add: () => `${PANEL_PATH}/add`,
  birthdays: () => `${PANEL_PATH}/birthdays`,
  interactions: () => `${PANEL_PATH}/interactions`,
  settings: () => `${PANEL_PATH}/settings`,
  person: (id: string) => `${PANEL_PATH}/person/${enc(id)}`,
  logInteraction: (personId: string) => `${PANEL_PATH}/person/${enc(personId)}/log`,
  editPerson: (id: string) => `${PANEL_PATH}/person/${enc(id)}/edit`,
  newRelationship: (personId: string) => `${PANEL_PATH}/person/${enc(personId)}/relationship/new`,
  relationship: (personId: string, relId: string) => `${PANEL_PATH}/person/${enc(personId)}/relationship/${enc(relId)}`,
  household: (id: string) => `${PANEL_PATH}/household/${enc(id)}`,
  newHousehold: () => `${PANEL_PATH}/household/new`,
  editHousehold: (id: string) => `${PANEL_PATH}/household/${enc(id)}/edit`,
  group: (id: string) => `${PANEL_PATH}/group/${enc(id)}`,
  newGroup: () => `${PANEL_PATH}/group/new`,
  editGroup: (id: string) => `${PANEL_PATH}/group/${enc(id)}/edit`,
  interaction: (id: string) => `${PANEL_PATH}/interaction/${enc(id)}`,
  editInteraction: (id: string) => `${PANEL_PATH}/interaction/${enc(id)}/edit`,
  reminder: (id: string) => `${PANEL_PATH}/reminder/${enc(id)}`,
  newReminder: (personId: string) => `${PANEL_PATH}/person/${enc(personId)}/reminder/new`,
  newInteractionReminder: (interactionId: string) => `${PANEL_PATH}/interaction/${enc(interactionId)}/reminder/new`,
};

/** True for "/hearth" and anything under "/hearth/": links the panel handles itself. */
export function isPanelPath(path: string): boolean {
  return path === PANEL_PATH || path.startsWith(`${PANEL_PATH}/`) || path.startsWith(`${PANEL_PATH}?`);
}

// Tab roots show the tab bar highlight; other screens keep the last tab's.
export function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case "home":
    case "search":
    case "reachOut":
    case "add":
      return route.name;
    default:
      return null;
  }
}

export function isTabRoot(route: Route): boolean {
  return tabOf(route) !== null;
}

// Each entry the panel pushes records how deep into the panel it is, so Back can tell an
// in-panel step (go back through history) from a deep link opened directly (go to the parent).
const DEPTH_KEY = "hearthDepth";

function depth(): number {
  const value = (history.state as Record<string, unknown> | null)?.[DEPTH_KEY];
  return typeof value === "number" ? value : 0;
}

/** Change the URL and tell Home Assistant, which then updates the panel's `route`. */
export function navigate(path: string, replace = false): void {
  if (replace) history.replaceState({ [DEPTH_KEY]: depth() }, "", path);
  else history.pushState({ [DEPTH_KEY]: depth() + 1 }, "", path);
  window.dispatchEvent(new Event("location-changed"));
}

export function goBack(fallback: string): void {
  if (depth() > 0) history.back();
  else navigate(fallback, true);
}
