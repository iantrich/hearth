import { html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import { avatar, label, personRow } from "../components";
import { plural } from "../format";
import { compareNames, householdIsNamed, householdTitle } from "../logic/names";
import { searchPeople } from "../logic/peopleSearch";
import { href } from "../router";
import type { SearchChip, Store } from "../store";
import type { ContactGroup, Household } from "../types";
import { snapshotOf, type View } from "./view";

const chips: readonly (readonly [SearchChip, string])[] = [
  ["people", "People"],
  ["households", "Households"],
  ["groups", "Groups"],
];

const matches = (text: string, query: string) => query === "" || text.toLocaleLowerCase().includes(query.toLocaleLowerCase());

function householdRow(h: Household) {
  const name = householdTitle(h);
  return html`<a class="row" href=${href.household(h.id)}>
    ${avatar(name, h.photo_url)}
    <span class="main"><div class="name ${householdIsNamed(h) ? "" : "muted"}">${name}</div></span>
    <span class="meta">${plural(h.member_ids.length, "member")}</span>
  </a>`;
}

function groupRow(g: ContactGroup) {
  return html`<a class="row" href=${href.group(g.id)}>
    ${avatar(g.name, g.photo_url)}
    <span class="main">
      <div class="name">${g.name}</div>
      ${g.description ? html`<div class="sub">${g.description}</div>` : nothing}
    </span>
    <span class="meta">${plural(g.member_ids.length, "member")}</span>
  </a>`;
}

function results(store: Store) {
  const { people, households, groups, relationships } = snapshotOf(store);
  const query = store.search.text.trim();
  switch (store.search.chip) {
    case "people": {
      const found = searchPeople(query, people, relationships);
      return html`${found.direct.map((p) => personRow(p))}
      ${found.connected.length
        ? html`${label("Connected")} ${found.connected.map((m) => personRow(m.person, m.reason))}`
        : nothing}
      ${found.direct.length + found.connected.length === 0 ? html`<div class="empty">No one matches “${query}”.</div>` : nothing}`;
    }
    case "households":
      return households
        .map((h) => ({ h, name: householdTitle(h) }))
        .filter(({ name }) => matches(name, query))
        .sort((a, b) => compareNames(a.name, b.name))
        .map(({ h }) => householdRow(h));
    case "groups":
      return groups
        .filter((g) => matches(g.name, query))
        .sort((a, b) => compareNames(a.name, b.name))
        .map(groupRow);
  }
}

/** Households and groups are made here; people are made from the Add tab. */
function newButton(chip: SearchChip) {
  if (chip === "people") return nothing;
  const [label, link] = chip === "households" ? ["New household", href.newHousehold()] : ["New group", href.newGroup()];
  return html`<div style="padding:0 16px 8px"><a class="btn secondary new-record" style="display:inline-flex;align-items:center" href=${link}>${label}</a></div>`;
}

export function searchView(store: Store): View {
  const { text, chip } = store.search;
  return {
    title: null,
    back: false,
    actions: [],
    body: html`<div class="page">
      <div style="padding:10px 16px 0">
        <input
          id="search-field"
          class="input"
          type="search"
          placeholder="Search"
          aria-label="Search"
          autocomplete="off"
          .value=${live(text)}
          @input=${(e: InputEvent) => store.setSearch({ text: (e.target as HTMLInputElement).value })}
        />
      </div>
      <div class="pills" style="padding:8px 16px">
        ${chips.map(
          ([key, name]) => html`<button
            class="pill mono ${chip === key ? "on" : ""}"
            aria-pressed=${chip === key ? "true" : "false"}
            @click=${() => store.setSearch({ chip: key })}
          >
            ${name}
          </button>`,
        )}
      </div>
      ${newButton(chip)}
      <div class="list">${results(store)}</div>
    </div>`,
  };
}
