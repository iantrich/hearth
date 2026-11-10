import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { confirmDialog } from "../forms/confirm";
import { href } from "../router";
import type { Store } from "../store";
import type { GoogleReport, GoogleStatus, Person } from "../types";
import { snapshotOf } from "./view";

const INTEGRATION_URL = "/config/integrations/integration/hearth_crm";

// The stored errors the sync writes on a person (google_payload.py). Anything else is Google's
// or the network's own wording and is shown as it is.
const CONTACT_MISSING = "contact missing";
const CREATE_UNCERTAIN = "create uncertain";

const ENABLE_KEY = "confirm-google-enable";
const CLEAR_KEY = "confirm-google-clear";
type ClearConfirm = { personId: string; uncertain: boolean };

/** What a person's stored sync error means, in plain words. */
export function googleErrorText(error: string): string {
  switch (error) {
    case CONTACT_MISSING:
      return "This contact was deleted in Google.";
    case CREATE_UNCERTAIN:
      return "Hearth couldn't confirm whether Google created this contact.";
    default:
      return error;
  }
}

/** Why a run ended early, or null when it ran to the end. */
export function stopText(report: GoogleReport): string | null {
  switch (report.stopped_reason) {
    case "auth":
      return "Google needs you to sign in again (Settings → Devices & services → Hearth).";
    case "rate_limited":
      return "Google asked Hearth to slow down; it will continue on the next sweep.";
    case "api_disabled":
      return "The Google People API isn't enabled or Hearth lacks permission. Enable the People API for your Google Cloud project, or reconnect (Settings → Devices & services → Hearth → Reconfigure).";
    case "disabled":
      return "Stopped because the sync was switched off.";
    case "account_mismatch":
      return "These contacts weren't found in the connected Google account. Is it the same account the contacts were first synced to? Nothing was changed.";
    default:
      return null;
  }
}

function whenText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function runLine(report: GoogleReport): string {
  const parts = [`${report.created} created`, `${report.updated} updated`];
  if (report.photos) parts.push(`${report.photos} photos`);
  if (report.errors) parts.push(`${report.errors} with errors`);
  if (report.missing) parts.push(`${report.missing} missing in Google`);
  if (report.pending) parts.push(`${report.pending} still to do`);
  return parts.join(", ");
}

function notConnected(): TemplateResult {
  return html`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">
      Hearth can keep your contacts in your Google account up to date. It's optional, and Hearth works the same without it.
    </div>
    <div class="muted" style="font-size:12.5px">
      To connect: Settings → Devices & services → Hearth → Reconfigure.
    </div>
    <a class="accent" style="font-size:12.5px" href=${INTEGRATION_URL} target="_blank" rel="noopener noreferrer">Open Hearth in Home Assistant</a>
  </div>`;
}

function statusLines(status: GoogleStatus): TemplateResult {
  const { counts, last_run: run } = status;
  const stop = run ? stopText(run) : null;
  return html`<div id="google-status" style="display:grid;gap:4px;font-size:12.5px">
    <div>
      ${counts.synced} synced, ${counts.pending} waiting, ${counts.skipped} skipped${counts.missing ? html`, ${counts.missing} missing in Google` : nothing}${counts.errors
        ? html`, ${counts.errors} with errors`
        : nothing}
    </div>
    ${status.running ? html`<div class="muted">Syncing now…</div>` : nothing}
    ${run && !run.dry_run
      ? html`<div class="muted">Last run ${whenText(run.started_at)}: ${runLine(run)}</div>`
      : html`<div class="muted">No sync has run yet.</div>`}
    ${stop ? html`<div role="alert">${stop}</div>` : nothing}
    ${status.last_error ? html`<div role="alert">The last run failed: ${status.last_error}</div>` : nothing}
  </div>`;
}

function enableSwitch(store: Store, status: GoogleStatus): TemplateResult {
  // Turning it off is always allowed; turning it on waits for cutover.
  const blocked = !status.cutover_confirmed && !status.enabled;
  const change = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.checked) {
      input.checked = false; // stays off until the user confirms
      store.drafts.put(ENABLE_KEY, href.settings(), {});
    } else {
      void store.setGoogleEnabled(false);
    }
  };
  return html`<div style="display:grid;gap:4px">
    <label class="check">
      <input
        id="google-enable"
        type="checkbox"
        role="switch"
        ?disabled=${blocked || store.busy}
        aria-describedby=${blocked ? "google-enable-why" : nothing}
        .checked=${live(status.enabled)}
        @change=${change}
      />
      <span>Keep Google Contacts up to date</span>
    </label>
    ${blocked
      ? html`<div class="muted" id="google-enable-why" style="font-size:12.5px">
          Available once cutover is confirmed, so test edits in Hearth never reach your Google account. Run the Hearth “Confirm cutover” action (Developer tools → Actions) once your import is final. You can still preview below.
        </div>`
      : nothing}
  </div>`;
}

function previewResult(report: GoogleReport): TemplateResult {
  // The server lists at most 200 names; say how many more there are.
  const more = report.created - report.would_create.length;
  return html`<div id="google-preview" role="status" style="display:grid;gap:6px;font-size:12.5px">
    <div>
      Would create ${report.created}, update ${report.updated}, skip ${report.skipped}${report.photos
        ? `, and ${report.photos} ${report.photos === 1 ? "photo" : "photos"} to upload`
        : nothing}
    </div>
    ${report.would_create.length
      ? html`<div class="muted">Would create:</div>
          <ul style="margin:0;padding-left:18px">
            ${report.would_create.map((name) => html`<li>${name}</li>`)}
          </ul>
          ${more > 0 ? html`<div class="muted" id="google-preview-more">and ${more} more</div>` : nothing}`
      : nothing}
  </div>`;
}

function syncResult(report: GoogleReport): TemplateResult {
  const stop = stopText(report);
  return html`<div id="google-sync-result" role="status" style="display:grid;gap:4px;font-size:12.5px">
    <div>Sync finished: ${runLine(report)}</div>
    ${stop ? html`<div>${stop}</div>` : nothing}
  </div>`;
}

/** People with a stored sync error, from the panel's own snapshot. */
function problemPeople(store: Store): Person[] {
  return snapshotOf(store).people.filter((p) => p.google_sync_error);
}

function problems(store: Store): TemplateResult | typeof nothing {
  const people = problemPeople(store);
  if (!people.length) return nothing;
  return html`<div id="google-problems" style="display:grid;gap:10px">
    <div class="label" style="padding:0">Needs attention</div>
    ${people.map((person) => {
      const error = person.google_sync_error!;
      const uncertain = error === CREATE_UNCERTAIN && !person.google_contact_id;
      const offerNew = uncertain || (error === CONTACT_MISSING && !!person.google_contact_id);
      return html`<div class="google-problem" style="display:flex;align-items:center;gap:10px">
        <span style="flex:1;min-width:0">
          <a href=${href.person(person.id)} style="font-weight:600">${person.name}</a>
          <div class="muted" style="font-size:12.5px">${googleErrorText(error)}</div>
        </span>
        ${offerNew
          ? html`<button
              class="btn secondary"
              ?disabled=${store.busy}
              @click=${() => store.drafts.put<ClearConfirm>(CLEAR_KEY, href.settings(), { personId: person.id, uncertain })}
            >
              Create a new contact
            </button>`
          : nothing}
      </div>`;
    })}
  </div>`;
}

/** The Google Contacts card in Settings. */
export function googleSection(store: Store): TemplateResult {
  const { status, loadError, preview, lastSync, working } = store.google;
  if (!status) {
    return html`<div class="card" style="padding:13px">
      <div class="muted" style="font-size:12.5px">${loadError ? `Couldn't load the Google sync status: ${loadError}` : "Loading…"}</div>
    </div>`;
  }
  if (!status.connected) return notConnected();
  return html`<div class="card" style="padding:13px;display:grid;gap:12px">
    ${loadError ? html`<div class="muted" id="google-refresh-error" role="status" style="font-size:12.5px">Couldn't refresh Google status</div>` : nothing}
    ${statusLines(status)} ${enableSwitch(store, status)}
    <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn secondary" id="google-preview-btn" ?disabled=${store.busy || working !== null} @click=${() => void store.previewGoogle()}>
        ${working === "preview" ? "Previewing…" : "Preview"}
      </button>
      <button
        class="btn"
        id="google-sync-btn"
        ?disabled=${store.busy || working !== null || !status.enabled}
        @click=${() => void store.syncGoogleNow()}
      >
        ${working === "sync" ? "Syncing…" : "Sync now"}
      </button>
    </div>
    ${preview ? previewResult(preview) : nothing} ${lastSync ? syncResult(lastSync) : nothing} ${problems(store)}
  </div>`;
}

/** The enable and new-contact confirmations, when one is open. */
export function googleOverlay(store: Store): TemplateResult | undefined {
  if (store.drafts.get(ENABLE_KEY)) {
    return confirmDialog({
      title: "Turn on Google sync?",
      lines: ["Contacts will be created and updated in your Google account. Hearth never deletes a Google contact."],
      confirmLabel: "Turn on",
      busy: store.busy,
      onCancel: () => store.drafts.drop(ENABLE_KEY),
      onConfirm: () => {
        store.drafts.drop(ENABLE_KEY);
        void store.setGoogleEnabled(true);
      },
    });
  }
  const clear = store.drafts.get<ClearConfirm>(CLEAR_KEY);
  if (clear) {
    return confirmDialog({
      title: "Create a new contact?",
      lines: [
        clear.uncertain
          ? "Hearth couldn't confirm whether Google created this contact. Check Google Contacts for a stray copy first; a new one will be created."
          : "A new contact will be created in Google. The old one is not touched.",
      ],
      confirmLabel: "Create new contact",
      busy: store.busy,
      onCancel: () => store.drafts.drop(CLEAR_KEY),
      onConfirm: () => {
        store.drafts.drop(CLEAR_KEY);
        void store.clearGoogleContact(clear.personId);
      },
    });
  }
  return undefined;
}
