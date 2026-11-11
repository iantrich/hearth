// Add or change one reminder, as a sheet over the screen it opened from: a person's screen (add,
// for them), an interaction's (add, linked to it, for its first person unless another is chosen)
// or Reach out (edit; a reminder's person doesn't change). The
// form is a draft for the sheet's path. An edit sends only what changed since the sheet opened.
import { html, nothing, type TemplateResult } from "lit";
import { avatar } from "../components";
import { confirmDialog } from "../forms/confirm";
import { bindDraft } from "../forms/fields";
import { personPicker } from "../forms/personPicker";
import { blankReminder, reminderChangesOf, reminderFields, reminderFormOf, type ReminderForm } from "../forms/reminderFields";
import { interactionPeople } from "../logic/interactionFeed";
import { goBack, href, type Route } from "../router";
import type { Store } from "../store";
import type { Interaction, Person, Reminder } from "../types";
import { interactionView } from "./interaction";
import { personView } from "./person";
import { reachOutView } from "./reachOut";
import { arriving, notFound, snapshotOf, type View } from "./view";

export type ReminderRoute = Extract<Route, { name: "reminder" | "reminderNewAny" | "reminderNew" | "interactionReminderNew" }>;

/** The person's id, "" until chosen, plus the reminder's own fields. */
type SheetForm = ReminderForm & { person: string };

interface SheetSpec {
  key: string;
  path: string;
  /** Where Cancel and Save go back to when there's no history. */
  closeTo: string;
  /** Who it's for when the sheet opens. */
  person: Person | null;
  /** True when the person can't be changed: opened from their screen, or editing. */
  locked: boolean;
  interaction: Interaction | null;
  existing: Reminder | null;
}

export function reminderSheetView(store: Store, route: ReminderRoute): View {
  const snapshot = snapshotOf(store);
  switch (route.name) {
    case "reminderNewAny": {
      // From Reach out, nobody chosen yet.
      const path = href.newReminderAny();
      return { ...reachOutView(store), overlay: sheet(store, { key: "reminder:new:any", path, closeTo: href.reachOut(), person: null, locked: false, interaction: null, existing: null }) };
    }
    case "reminderNew": {
      const base = personView(store, route.personId, null);
      const person = snapshot.people.find((p) => p.id === route.personId);
      // The person is gone (or still arriving): their screen says so, with no sheet over it.
      if (!person) return base;
      const path = href.newReminder(person.id);
      return { ...base, overlay: sheet(store, { key: `reminder:new:person:${person.id}`, path, closeTo: href.person(person.id), person, locked: true, interaction: null, existing: null }) };
    }
    case "interactionReminderNew": {
      const base = interactionView(store, route.interactionId, null);
      const interaction = snapshot.interactions.find((i) => i.id === route.interactionId);
      if (!interaction) return base;
      // For its first person to start with, changeable; when its people are all gone, nobody yet.
      const lead = interactionPeople(interaction, snapshot.people)[0] ?? null;
      const path = href.newInteractionReminder(interaction.id);
      return {
        ...base,
        overlay: sheet(store, { key: `reminder:new:interaction:${interaction.id}`, path, closeTo: href.interaction(interaction.id), person: lead, locked: false, interaction, existing: null }),
      };
    }
    case "reminder": {
      const existing = snapshot.reminders.find((r) => r.id === route.id);
      // Deleted elsewhere (Claude, another tab, an import) while open, or a stale link.
      if (!existing) return store.isArriving(route.id) ? arriving : notFound("reminder");
      const person = snapshot.people.find((p) => p.id === existing.person_id) ?? null;
      const interaction = existing.interaction_id ? (snapshot.interactions.find((i) => i.id === existing.interaction_id) ?? null) : null;
      const spec = { key: `edit:reminder:${existing.id}`, path: href.reminder(existing.id), closeTo: href.reachOut(), person, locked: true, interaction, existing };
      return { ...reachOutView(store), overlay: sheet(store, spec) };
    }
  }
}

const confirmKey = (id: string) => `confirm-delete:reminder:${id}`;

function sheet(store: Store, spec: SheetSpec): TemplateResult {
  const snapshot = snapshotOf(store);
  const { key, path, existing, interaction } = spec;
  const form = store.drafts.open<SheetForm>(key, path, () => ({
    ...(existing ? reminderFormOf(existing) : blankReminder()),
    person: spec.person?.id ?? existing?.person_id ?? "",
  }));
  const chosen = spec.locked ? spec.person : (snapshot.people.find((p) => p.id === form.person) ?? null);

  const done = () => {
    store.drafts.drop(key);
    goBack(spec.closeTo);
  };
  const valid = !!chosen && reminderChangesOf(form) !== null;
  const save = async () => {
    const current = store.drafts.get<SheetForm>(key);
    const changes = current && reminderChangesOf(current);
    if (!current || !changes || !chosen) return;
    if (existing) {
      // The base is the reminder as it opened, its due time as a naive local string, so an
      // unchanged one isn't sent again.
      const base = store.drafts.base<SheetForm>(key);
      const ok = await store.updateReminder(existing.id, changes, (base && reminderChangesOf(base)) ?? undefined);
      if (ok) done();
      return;
    }
    const id = await store.addReminder({ person_id: chosen.id, interaction_id: interaction?.id ?? null, ...changes });
    if (id) done();
  };

  const b = bindDraft(store, key);
  return html`<div class="sheet-backdrop" @click=${(e: Event) => e.target === e.currentTarget && done()}>
      <div class="sheet" role="dialog" aria-label=${existing ? "Edit reminder" : "Add reminder"}>
        <div class="topbar">
          <button class="icon-btn" style="padding:0 12px" @click=${done}>Cancel</button>
          <span class="title" style="text-align:center">${existing ? "Reminder" : "Add reminder"}</span>
          <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!valid || store.busy} @click=${save}>
            Save
          </button>
        </div>
        <div class="sheet-body">
          <div class="form">
            ${spec.locked
              ? html`<div class="field">
                  <span>Person</span>
                  ${chosen
                    ? html`<div style="display:flex;align-items:center;gap:10px">${avatar(chosen.name, chosen.photo_url, 26)} ${chosen.name}</div>`
                    : html`<div class="muted">No longer in Hearth</div>`}
                </div>`
              : personPicker(store, {
                  id: "reminder-person",
                  label: "Person",
                  path,
                  selected: chosen ? [chosen.id] : [],
                  onPick: (id) => store.drafts.patch<SheetForm>(key, { person: id }),
                  onRemove: () => store.drafts.patch<SheetForm>(key, { person: "" }),
                  disabled: store.busy,
                })}
            ${interaction ? html`<div class="muted" style="font-size:12.5px">From: ${interaction.summary}</div>` : nothing}
            ${reminderFields(b, snapshot.today, snapshot.reminder_units, store.busy)}
            ${existing
              ? html`<button
                  class="btn danger"
                  style="margin-top:12px"
                  ?disabled=${store.busy}
                  @click=${() => store.drafts.put(confirmKey(existing.id), path, {})}
                >
                  Delete reminder
                </button>`
              : nothing}
          </div>
        </div>
      </div>
    </div>
    ${existing && store.drafts.get(confirmKey(existing.id)) ? confirmDelete(store, existing, chosen, done) : nothing}`;
}

// Says exactly what goes. Deletes in Hearth are permanent; one already deleted elsewhere counts as done.
function confirmDelete(store: Store, existing: Reminder, person: Person | null, done: () => void): TemplateResult {
  const key = confirmKey(existing.id);
  const what = existing.note ? `“${existing.note}”` : "This reminder";
  return confirmDialog({
    title: "Delete this reminder?",
    lines: [`${what}${person ? ` for ${person.name}` : ""} is removed for good. This can't be undone.`],
    confirmLabel: "Delete",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (!(await store.deleteReminder(existing.id))) return;
      store.drafts.drop(key);
      done();
    },
  });
}
