import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { avatar } from "../components";
import { bindDraft, fieldError } from "../forms/fields";
import { personPicker } from "../forms/personPicker";
import { blankReminder, nestedBinding, reminderChangesOf, reminderFields, type ReminderForm } from "../forms/reminderFields";
import { icons } from "../icons";
import { goBack, href } from "../router";
import type { InteractionChanges, Store } from "../store";
import type { Interaction, Person } from "../types";
import { snapshotOf } from "./view";

// The shell's Claude link (kept here too: importing the shell would be a cycle).
const CLAUDE_URL = "https://claude.ai/new";

/** The inline reminder: for the interaction's person to start with, changeable ("" until chosen). */
type LogReminder = ReminderForm & { person: string };

/** The log and edit interaction sheet's input. */
interface LogForm {
  type: string;
  date: string;
  summary: string;
  notes: string;
  /** A reminder to save with a new interaction, linked to it; null when none was added. */
  reminder: LogReminder | null;
}

// The form is a draft keyed by which sheet it is, so typing survives re-renders, a different
// sheet starts fresh, and leaving the sheet's path drops it.
function formFor(store: Store, key: string, path: string, editing: Interaction | null): LogForm {
  return store.drafts.open<LogForm>(key, path, () => {
    const { interaction_types, today } = snapshotOf(store);
    return {
      type: editing?.type ?? interaction_types[0] ?? "",
      date: editing?.date ?? today,
      summary: editing?.summary ?? "",
      notes: editing?.notes ?? "",
      reminder: null,
    };
  });
}

/** What the sheet saves: text trimmed, blank notes as null. */
const changesOf = (form: LogForm): InteractionChanges => ({
  type: form.type,
  date: form.date,
  summary: form.summary.trim(),
  notes: form.notes.trim() || null,
});

// Logging and editing share one sheet. Editing never touches who the interaction was with, so
// the extra people on a shared one survive a save.
export function logSheet(store: Store, person: Person, editing: Interaction | null): TemplateResult {
  const key = editing ? `edit:${editing.id}` : `log:${person.id}`;
  const form = formFor(store, key, editing ? href.editInteraction(editing.id) : href.logInteraction(person.id), editing);
  const types = snapshotOf(store).interaction_types;
  // Back to the screen under the sheet: the person, or the interaction.
  const done = () => {
    store.drafts.drop(key);
    goBack(editing ? href.interaction(editing.id) : href.person(person.id));
  };
  const set = (patch: Partial<LogForm>) => store.drafts.patch<LogForm>(key, patch);
  // An added reminder must be complete too (a due choice, a custom date, a good repeat count).
  const reminderOk = !form.reminder || (reminderChangesOf(form.reminder) !== null && snapshotOf(store).people.some((p) => p.id === form.reminder?.person));
  const valid = form.summary.trim() !== "" && form.date !== "" && form.type !== "" && reminderOk;
  // The server's error for a field it refused, shown under that field.
  const error = (name: "summary" | "notes") => fieldError(store.writeError, name);
  const errorSlot = (name: "summary" | "notes") => {
    const message = error(name);
    return message ? html`<div class="field-error" role="alert" data-error-for=${name}>${message}</div>` : nothing;
  };

  const save = async () => {
    if (!valid) return;
    const changes = changesOf(form);
    // An edit sends only what changed since the sheet opened (its base).
    const base = store.drafts.base<LogForm>(key);
    if (editing) {
      if (await store.updateInteraction(editing.id, changes, base && changesOf(base))) done();
      return;
    }
    // The interaction first, then the reminder linked to it, for the person chosen. If the
    // reminder fails the interaction is already saved: the sheet closes and the toast says so.
    const id = await store.createInteraction({ person_ids: [person.id], ...changes });
    if (id === null) return;
    const reminder = form.reminder && reminderChangesOf(form.reminder);
    if (reminder && form.reminder) await store.addReminder({ person_id: form.reminder.person, interaction_id: id, ...reminder });
    done();
  };

  return html`<div class="sheet-backdrop" @click=${(e: Event) => e.target === e.currentTarget && done()}>
    <div class="sheet" role="dialog" aria-label=${editing ? "Edit interaction" : "Log interaction"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${done}>Cancel</button>
        <span class="title" style="text-align:center">${editing ? "Edit" : "Log"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!valid || store.busy} @click=${save}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          <div class="field">
            <span>Person</span>
            <div style="display:flex;align-items:center;gap:10px">${avatar(person.name, person.photo_url, 26)} ${person.name}</div>
          </div>
          <div class="field">
            <span>Type</span>
            <div class="pills">
              ${types.map(
                (type) => html`<button
                  class="pill ${form.type === type ? "on" : ""}"
                  aria-pressed=${form.type === type ? "true" : "false"}
                  @click=${() => set({ type })}
                >
                  ${type}
                </button>`,
              )}
            </div>
          </div>
          <label class="field">
            <span>Date</span>
            <input id="log-date" class="input" type="date" required .value=${live(form.date)}
              @input=${(e: InputEvent) => set({ date: (e.target as HTMLInputElement).value })} />
          </label>
          <label class="field">
            <span>Summary</span>
            <input id="log-summary" class="input" maxlength="300" aria-invalid=${error("summary") ? "true" : "false"}
              .value=${live(form.summary)} @input=${(e: InputEvent) => set({ summary: (e.target as HTMLInputElement).value })} />
            ${errorSlot("summary")}
          </label>
          <label class="field">
            <span>Notes</span>
            <textarea id="log-notes" class="input" maxlength="20000" aria-invalid=${error("notes") ? "true" : "false"}
              .value=${live(form.notes)} @input=${(e: InputEvent) => set({ notes: (e.target as HTMLTextAreaElement).value })}></textarea>
            ${errorSlot("notes")}
          </label>
          ${reminderPart(store, key, form, editing, person)}
          <a href=${CLAUDE_URL} target="_blank" rel="noopener noreferrer" style="display:grid;justify-items:center;gap:8px;padding:8px 0">
            <span class="action primary" style="width:44px;height:44px;border-radius:50%">${icons.mic}</span>
            <span class="muted" style="font-size:11.5px">Or tell Claude about it, and it logs it in Hearth for you.</span>
          </a>
        </div>
      </div>
    </div>
  </div>`;
}

// Editing an interaction: its reminders are their own records, added from the interaction's
// screen (a link here would leave the sheet and drop unsaved edits). Logging one: a reminder
// can be added here and is saved with it.
function reminderPart(store: Store, key: string, form: LogForm, editing: Interaction | null, person: Person) {
  if (editing) return nothing;
  const set = (reminder: LogReminder | null) => store.drafts.patch<LogForm>(key, { reminder });
  if (!form.reminder) return html`<button class="btn secondary" @click=${() => set({ ...blankReminder(), person: person.id })}>Add reminder</button>`;
  const { people, today, reminder_units } = snapshotOf(store);
  const b = nestedBinding(bindDraft(store, key), "reminder");
  const chosen = people.find((p) => p.id === form.reminder?.person);
  return html`<div class="label">Reminder</div>
    ${personPicker(store, {
      id: "log-reminder-person",
      label: "For",
      path: href.logInteraction(person.id),
      selected: chosen ? [chosen.id] : [],
      onPick: (id) => b.set("person", id),
      onRemove: () => b.set("person", ""),
      disabled: store.busy,
    })}
    ${reminderFields(b, today, reminder_units, store.busy)}
    <button class="btn secondary" @click=${() => set(null)}>Remove reminder</button>`;
}
