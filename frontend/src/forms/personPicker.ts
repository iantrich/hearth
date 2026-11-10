// Choose one or more people by name, with the panel's people search. The search text is a draft
// of the screen it's on, so it survives re-renders and is dropped on leaving.
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { avatar } from "../components";
import { searchPeople } from "../logic/peopleSearch";
import type { Store } from "../store";
import type { Person } from "../types";
import { snapshotOf } from "../views/view";

const LIMIT = 8;

export interface PersonPickerOptions {
  /** The search box's id; also names the picker's draft. */
  id: string;
  label: string;
  /** The path of the screen the picker is on (an `href.*` value). */
  path: string;
  /** People who can't be chosen, for example the viewer. */
  exclude?: readonly string[];
  /** Who is chosen now. Shown as chips (with remove buttons when `onRemove` is given) and left out of the results. */
  selected?: readonly string[];
  onPick: (personId: string) => void;
  onRemove?: (personId: string) => void;
  disabled?: boolean;
}

type PickerDraft = { query: string };

export function personPicker(store: Store, options: PersonPickerOptions): TemplateResult {
  const { people, relationships } = snapshotOf(store);
  const key = `picker:${options.id}`;
  const query = store.drafts.open<PickerDraft>(key, options.path, () => ({ query: "" })).query;
  const selected = options.selected ?? [];
  const hidden = new Set([...(options.exclude ?? []), ...selected]);
  const chosen = selected.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);

  const needle = query.trim();
  const results: { person: Person; reason?: string }[] = [];
  if (needle) {
    const found = searchPeople(needle, people, relationships);
    for (const person of found.direct) results.push({ person });
    for (const match of found.connected) results.push(match);
  }
  const shown = results.filter((r) => !hidden.has(r.person.id)).slice(0, LIMIT);

  const pick = (personId: string) => {
    store.drafts.patch<PickerDraft>(key, { query: "" });
    options.onPick(personId);
  };

  return html`<div class="field person-picker">
    <label for=${options.id}><span>${options.label}</span></label>
    ${chosen.length
      ? html`<div class="chips">
          ${chosen.map(
            (p) => html`<span class="chip">
              ${avatar(p.name, p.photo_url, 18)} ${p.name}
              ${options.onRemove
                ? html`<button
                    class="chip-remove"
                    aria-label=${`Remove ${p.name}`}
                    title=${`Remove ${p.name}`}
                    ?disabled=${options.disabled ?? false}
                    @click=${() => options.onRemove!(p.id)}
                  >
                    ×
                  </button>`
                : nothing}
            </span>`,
          )}
        </div>`
      : nothing}
    <input
      id=${options.id}
      class="input"
      type="search"
      placeholder="Search people"
      autocomplete="off"
      .value=${live(query)}
      @input=${(e: Event) => store.drafts.patch<PickerDraft>(key, { query: (e.target as HTMLInputElement).value })}
    />
    ${needle
      ? html`<div class="list">
          ${shown.length
            ? shown.map(
                ({ person, reason }) => html`<button
                  class="row picker-choice"
                  ?disabled=${options.disabled ?? false}
                  @click=${() => pick(person.id)}
                >
                  ${avatar(person.name, person.photo_url)}
                  <span class="main">
                    <div class="name">${person.name}</div>
                    ${reason ? html`<div class="sub">${reason}</div>` : nothing}
                  </span>
                </button>`,
              )
            : html`<div class="empty">No one matches “${needle}”.</div>`}
        </div>`
      : nothing}
  </div>`;
}
