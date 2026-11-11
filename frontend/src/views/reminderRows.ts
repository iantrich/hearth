// Reminders listed on a person's or an interaction's screen. A row opens the reminder's sheet;
// an open one has a Done control (a repeating one moves on to its next date on the server).
import { html, nothing, type TemplateResult } from "lit";
import { avatar } from "../components";
import { dueLabel, repeatLabel } from "../logic/reminders";
import { href } from "../router";
import type { Store } from "../store";
import type { Person, Reminder } from "../types";
import { snapshotOf } from "./view";

/** One reminder row; pass `who` where the screen isn't already theirs, to show their avatar and name. */
export function reminderRow(store: Store, r: Reminder, today: string, who?: Person): TemplateResult {
  const open = r.state !== "done";
  const when = open ? dueLabel(r, today) : "Done";
  const repeat = r.repeat_every && r.repeat_unit ? ` · ${repeatLabel(r.repeat_every, r.repeat_unit)}` : "";
  return html`<div class="row reminder-row">
    ${who ? avatar(who.name, who.photo_url) : nothing}
    <a class="main" href=${href.reminder(r.id)}>
      ${who ? html`<div class="sub">${who.name}</div>` : nothing}
      <div class="name">${r.note || "Reminder"}</div>
      <div class="sub" style=${r.state === "overdue" ? "color:var(--danger)" : ""}>${when}${repeat}</div>
    </a>
    ${open
      ? html`<button class="pill" ?disabled=${store.busy} @click=${() => void store.completeReminder(r.id)}>Done</button>`
      : nothing}
  </div>`;
}

/** A "Reminders" heading and card, or nothing when there are none. */
export function reminderSection(store: Store, reminders: Reminder[], headingStyle: string, cardStyle: string): TemplateResult | typeof nothing {
  if (!reminders.length) return nothing;
  const { today } = snapshotOf(store);
  return html`<div class="label" style=${headingStyle}>Reminders</div>
    <div class="card" style=${cardStyle}>${reminders.map((r) => reminderRow(store, r, today))}</div>`;
}
