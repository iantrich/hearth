// The Notifications card in Settings: a switch and a time for each notification Hearth can send
// to the owner's phone, and a button that sends a sample so the tap behaviour can be checked.
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { Store } from "../store";
import type { NotificationKind } from "../types";

const ROWS: { kind: NotificationKind; id: string; label: string; help: string }[] = [
  {
    kind: "birthdays",
    id: "notify-birthdays",
    label: "Birthdays",
    help: "On the day, with their age when it's known. Tapping it opens a text to them.",
  },
  {
    kind: "log_reminder",
    id: "notify-log",
    label: "Log reminder",
    help: "A reminder if you haven't logged an interaction today.",
  },
];

export function notificationsSection(store: Store): TemplateResult {
  const { status, loadError, testing } = store.notifications;
  if (!status) {
    return html`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${loadError ? `Couldn't load the notification settings: ${loadError}` : "Loading…"}</div>
    </div>`;
  }
  const noPhone = status.devices === 0;
  return html`<div class="card" style="padding:13px;display:grid;gap:14px">
    ${noPhone
      ? html`<div class="muted" id="notify-no-phone" role="status" style="font-size:12.5px">
          No phone is set up for notifications. Install the Home Assistant Companion app and sign in as yourself.
        </div>`
      : nothing}
    ${ROWS.map(({ kind, id, label, help }) => {
      const setting = status.settings[kind];
      return html`<div style="display:grid;gap:6px">
        <label class="check">
          <input
            id=${id}
            type="checkbox"
            role="switch"
            ?disabled=${store.busy}
            .checked=${live(setting.enabled)}
            @change=${(e: Event) => void store.setNotification(kind, { enabled: (e.target as HTMLInputElement).checked })}
          />
          <span>${label}</span>
        </label>
        <div class="muted" style="font-size:12.5px">${help}</div>
        <label class="field">
          <span>Time</span>
          <input
            id=${`${id}-time`}
            class="input"
            type="time"
            step="60"
            ?disabled=${store.busy}
            .value=${live(setting.time)}
            @change=${(e: Event) => {
              const time = (e.target as HTMLInputElement).value;
              if (time) void store.setNotification(kind, { time });
            }}
          />
        </label>
      </div>`;
    })}
    <button class="btn secondary" id="notify-test" ?disabled=${store.busy || testing || noPhone} @click=${() => void store.sendTestNotification()}>
      ${testing ? "Sending…" : "Send a test"}
    </button>
  </div>`;
}
