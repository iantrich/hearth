import { html, nothing, type TemplateResult } from "lit";
import { avatar, type TopBarAction } from "../components";
import { confirmDialog } from "../forms/confirm";
import { formatLongDate } from "../format";
import { icons } from "../icons";
import { interactionPeople } from "../logic/interactionFeed";
import type { Store } from "../store";
import { goBack, href } from "../router";
import type { Interaction, Person } from "../types";
import { logSheet } from "./log";
import { notFound, snapshotOf, type View } from "./view";

/**
 * Edit and Delete. Edit needs a lead person for its sheet, as in Thread, so it's disabled on an
 * interaction whose people are all gone.
 */
export function interactionActions(store: Store, interaction: Interaction, lead: Person | undefined): TopBarAction[] {
  const edit: TopBarAction = lead
    ? { icon: icons.pencil, label: "Edit", href: href.editInteraction(interaction.id) }
    : { icon: icons.pencil, label: "Edit", disabled: true };
  return [
    edit,
    {
      icon: icons.trash,
      label: "Delete interaction",
      onClick: () => store.drafts.put(confirmKey(interaction.id), href.interaction(interaction.id), {}),
    },
  ];
}

const confirmKey = (id: string) => `confirm-delete:interaction:${id}`;

// Says exactly what goes: the summary and the date. Deletes in Hearth are permanent. One
// already deleted elsewhere counts as done, so the dialog closes either way.
function confirmDelete(store: Store, interaction: Interaction, lead: Person | undefined): TemplateResult {
  const key = confirmKey(interaction.id);
  return confirmDialog({
    title: "Delete this interaction?",
    lines: [`“${interaction.summary}” on ${formatLongDate(interaction.date)} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (!(await store.deleteInteraction(interaction.id))) return;
      store.drafts.drop(key);
      goBack(lead ? href.person(lead.id) : href.home());
    },
  });
}

export function interactionView(store: Store, id: string, sheet: "edit" | null): View {
  const { interactions, people: everyone } = snapshotOf(store);
  const interaction = interactions.find((i) => i.id === id);
  if (!interaction) return notFound("interaction");
  const people = interactionPeople(interaction, everyone);
  const lead = people[0];

  return {
    title: null,
    back: true,
    actions: interactionActions(store, interaction, lead),
    body: html`<div class="page" style="padding:20px;display:grid;gap:18px">
      ${people.length
        ? html`<div style="display:grid;gap:12px">
            ${people.length > 1 ? html`<div class="label">People</div>` : nothing}
            ${people.map(
              (p) => html`<a href=${href.person(p.id)} style="display:flex;align-items:center;gap:12px">
                ${avatar(p.name, p.photo_url)}<span class="accent" style="font-weight:600;font-size:15px">${p.name}</span>
              </a>`,
            )}
          </div>`
        : nothing}
      <div>
        <div class="label">${formatLongDate(interaction.date)}</div>
        <div class="mono accent" style="font-size:10.5px">${interaction.type}</div>
      </div>
      <div class="h-serif" style="font-size:19px">${interaction.summary}</div>
      ${interaction.notes
        ? html`<div><div class="label" style="margin-bottom:6px">Notes</div><div style="white-space:pre-wrap">${interaction.notes}</div></div>`
        : nothing}
    </div>`,
    overlay: html`${sheet === "edit" && lead ? logSheet(store, lead, interaction) : nothing}${store.drafts.get(confirmKey(id))
      ? confirmDelete(store, interaction, lead)
      : nothing}`,
  };
}
