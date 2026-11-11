// A reminder's note and when it's due, shared by the reminder sheet and the log sheet's inline
// reminder. The quick picks fill the date and time from the snapshot's today (Home Assistant's
// local date); Custom shows them to change, with the repeat. What is sent is a naive local
// "YYYY-MM-DDTHH:MM", or null for Someday: the panel never works with time zones.
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { quickPickDue, repeatLabel, type QuickPick } from "../logic/reminders";
import type { ReminderChanges } from "../store";
import type { Reminder } from "../types";
import { multilineField, selectField, type Binding } from "./fields";

export type DuePick = QuickPick | "custom";

/** The form's reminder fields. The repeat count is text, as typed. */
export interface ReminderForm {
  note: string;
  /** Which button is on; null until one is chosen. */
  pick: DuePick | null;
  date: string; // YYYY-MM-DD, "" for Someday
  time: string; // HH:MM
  repeat_every: string;
  repeat_unit: string; // "" = doesn't repeat
}

const DEFAULT_TIME = "08:00";
/** The server's limits (service.py). */
const MAX_NOTE = 20_000;
const MAX_REPEAT = 999;

const PICKS: { pick: DuePick; label: string }[] = [
  { pick: "tomorrow", label: "Tomorrow" },
  { pick: "next_week", label: "Next week" },
  { pick: "month", label: "In a month" },
  { pick: "quarter", label: "In a quarter" },
  { pick: "year", label: "In a year" },
  { pick: "someday", label: "Someday" },
  { pick: "custom", label: "Custom" },
];

const UNIT_LABELS: Record<string, string> = { day: "Days", week: "Weeks", month: "Months", year: "Years" };

export function blankReminder(): ReminderForm {
  return { note: "", pick: null, date: "", time: DEFAULT_TIME, repeat_every: "1", repeat_unit: "" };
}

/** An existing reminder as the form opens it: Someday, or Custom at its date and time. */
export function reminderFormOf(r: Reminder): ReminderForm {
  return {
    note: r.note ?? "",
    pick: r.due_date ? "custom" : "someday",
    date: r.due_date ?? "",
    time: r.due_time ?? DEFAULT_TIME,
    repeat_every: String(r.repeat_every ?? 1),
    repeat_unit: r.repeat_unit ?? "",
  };
}

function repeatCount(text: string): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= MAX_REPEAT ? n : null;
}

/** What the form saves, or null while it's incomplete (no pick, no custom date, a bad repeat count). */
export function reminderChangesOf(form: ReminderForm): Required<ReminderChanges> | null {
  if (!form.pick) return null;
  const note = form.note.trim() || null;
  if (form.pick === "someday") return { note, due_at: null, repeat_every: null, repeat_unit: null };
  if (!form.date || !form.time) return null;
  const due_at = `${form.date}T${form.time}`;
  if (!form.repeat_unit) return { note, due_at, repeat_every: null, repeat_unit: null };
  const every = repeatCount(form.repeat_every);
  return every === null ? null : { note, due_at, repeat_every: every, repeat_unit: form.repeat_unit };
}

/** Binds fields to a reminder form held inside another draft (the log sheet's). */
export function nestedBinding(outer: Binding, name: string): Binding {
  return {
    get: (field) => ((outer.get(name) ?? {}) as Record<string, unknown>)[field],
    set: (field, value) => outer.set(name, { ...((outer.get(name) ?? {}) as object), [field]: value }),
    error: (field) => outer.error(field),
  };
}

/** The note, the quick picks and, under Custom, the date, time and repeat. */
export function reminderFields(b: Binding, today: string, units: string[], disabled = false): TemplateResult {
  const pick = b.get("pick") as DuePick | null;
  const choose = (next: DuePick) => {
    b.set("pick", next);
    if (next === "custom") return;
    // A quick pick is a one-off at its date: it never repeats.
    const due = quickPickDue(next, today);
    b.set("date", due ? due.slice(0, 10) : "");
    b.set("time", due ? due.slice(11) : DEFAULT_TIME);
    b.set("repeat_unit", "");
  };
  const unit = String(b.get("repeat_unit") ?? "");
  const count = String(b.get("repeat_every") ?? "");
  const every = repeatCount(count);
  const text = (name: string) => String(b.get(name) ?? "");
  const input = (name: string) => (e: Event) => b.set(name, (e.target as HTMLInputElement).value);

  return html`${multilineField(b, "note", "Note", MAX_NOTE)}
    <div class="field">
      <span>Remind me</span>
      <div class="pills" style="flex-wrap:wrap">
        ${PICKS.map(
          (p) => html`<button
            class="pill ${pick === p.pick ? "on" : ""}"
            aria-pressed=${pick === p.pick ? "true" : "false"}
            ?disabled=${disabled}
            @click=${() => choose(p.pick)}
          >
            ${p.label}
          </button>`,
        )}
      </div>
    </div>
    ${pick === "custom"
      ? html`<label class="field">
            <span>Date</span>
            <input id="field-date" name="date" class="input" type="date" .value=${live(text("date"))} @input=${input("date")} />
          </label>
          <label class="field">
            <span>Time</span>
            <input id="field-time" name="time" class="input" type="time" .value=${live(text("time"))} @input=${input("time")} />
          </label>
          ${selectField(b, "repeat_unit", "Repeat", [
            { value: "", label: "Doesn't repeat" },
            ...units.map((u) => ({ value: u, label: UNIT_LABELS[u] ?? u })),
          ])}
          ${unit
            ? html`<label class="field">
                <span>Every</span>
                <input id="field-repeat-every" name="repeat_every" class="input" type="number" inputmode="numeric" min="1" max=${MAX_REPEAT}
                  aria-invalid=${every === null ? "true" : "false"} .value=${live(count)} @input=${input("repeat_every")} />
                <div class="muted" style="font-size:12px">${every === null ? `A number from 1 to ${MAX_REPEAT}` : repeatLabel(every, unit)}</div>
              </label>`
            : nothing}`
      : nothing}`;
}
