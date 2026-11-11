import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { avatar } from "../components";
import { confirmDialog } from "../forms/confirm";
import { searchPeople } from "../logic/peopleSearch";
import { href } from "../router";
import type { ImportState, Store } from "../store";
import { PANEL_VERSION } from "../version";
import { googleOverlay, googleSection } from "./googleSettings";
import { notificationsSection } from "./notificationSettings";
import { snapshotOf, type View } from "./view";

const PICKER_LIMIT = 8;
/** The "This is me" picker's search text, a draft only while the picker is open. */
const ME_KEY = "me-picker";
type MePicker = { query: string };

// "This is me": who the CRM's owner is. Hearth leaves them out of everyone's connections.
function meSection(store: Store): TemplateResult {
  const { people, relationships, me_person_id } = snapshotOf(store);
  const me = me_person_id ? people.find((p) => p.id === me_person_id) : undefined;
  const query = store.drafts.get<MePicker>(ME_KEY)?.query ?? null;
  const close = () => store.drafts.drop(ME_KEY);
  const choose = async (personId: string | null) => {
    if (await store.setMe(personId)) close();
  };

  const current = html`<div style="display:flex;align-items:center;gap:12px">
    ${me
      ? html`${avatar(me.name, me.photo_url, 36)}<span style="flex:1;font-weight:600">${me.name}</span>`
      : html`<span class="muted" style="flex:1">Not set</span>`}
    ${query === null
      ? html`<button class="btn secondary" @click=${() => store.drafts.put<MePicker>(ME_KEY, href.settings(), { query: "" })}>Change</button>
          ${me ? html`<button class="btn secondary" ?disabled=${store.busy} @click=${() => choose(null)}>Clear</button>` : nothing}`
      : nothing}
  </div>`;

  if (query === null) return html`<div class="card" style="padding:13px">${current}</div>`;

  const found = searchPeople(query.trim(), people, relationships).direct.slice(0, PICKER_LIMIT);
  return html`<div class="card" style="padding:13px;display:grid;gap:10px">
    ${current}
    <input
      id="me-search"
      class="input"
      type="search"
      placeholder="Search people"
      aria-label="Search people"
      autocomplete="off"
      .value=${live(query)}
      @input=${(e: InputEvent) => store.drafts.patch<MePicker>(ME_KEY, { query: (e.target as HTMLInputElement).value })}
    />
    <div class="list">
      ${found.length
        ? found.map(
            (p) => html`<button class="row me-choice" style="width:100%;text-align:left" ?disabled=${store.busy} @click=${() => choose(p.id)}>
              ${avatar(p.name, p.photo_url)}<span class="main"><div class="name">${p.name}</div></span>
            </button>`,
          )
        : html`<div class="empty">No one matches “${query.trim()}”.</div>`}
    </div>
    <button class="btn secondary" @click=${close}>Cancel</button>
  </div>`;
}

/** The panel's own words for a refused import; the server's message is not shown. */
function refusalText(state: Extract<ImportState, { kind: "refused" }>): string {
  switch (state.reason) {
    case "local_changes":
      return "Your Hearth has changes made here since the last import. Importing replaces everything in it.";
    case "cutover_confirmed":
      return "Imports are turned off because this Hearth is now your main copy.";
    case "invalid":
      return "That file can't be imported.";
    case "too_large":
      return "That file is too large to import.";
    case "no_crm":
      return "You don't have a Hearth to import into yet.";
    default:
      return "That file couldn't be read as a Hearth bundle.";
  }
}

/** The file picked for import, waiting for the user to confirm, as a draft while it's asked. */
const IMPORT_KEY = "confirm-import";
type ImportConfirm = { file: File };

// An import replaces everything, so picking a file asks first; nothing is sent until Import.
function confirmImport(store: Store, file: File): TemplateResult {
  return confirmDialog({
    title: `Import ${file.name}?`,
    lines: ["Everything in your Hearth is replaced by what's in this file."],
    confirmLabel: "Import",
    busy: store.busy,
    onCancel: () => store.drafts.drop(IMPORT_KEY),
    onConfirm: () => {
      store.drafts.drop(IMPORT_KEY);
      void store.importBundle(file, false);
    },
  });
}

// Import a bundle into this user's own Hearth.
function importSection(store: Store): TemplateResult {
  const state = store.importState;
  const uploading = state.kind === "uploading";
  const pick = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // so choosing the same file again still fires
    if (file) store.drafts.put<ImportConfirm>(IMPORT_KEY, href.settings(), { file });
  };
  return html`<div class="card" style="padding:13px;display:grid;gap:10px">
    <div class="muted" style="font-size:12.5px">Replaces everything in your Hearth with a Hearth export (.zip).</div>
    <input
      id="import-file"
      type="file"
      accept=".zip,application/zip"
      aria-label="Choose a Hearth export to import"
      ?disabled=${store.busy}
      @change=${pick}
    />
    ${uploading ? html`<div class="notice" role="status" style="margin:0">Uploading and importing…</div>` : nothing}
    ${state.kind === "done" ? html`<div class="notice" role="status" style="margin:0">${state.summary}</div>` : nothing}
    ${state.kind === "refused"
      ? html`<div role="alert" style="display:grid;gap:8px">
          <div>${refusalText(state)}</div>
          ${state.reason === "invalid" && state.problems.length
            ? html`<ul class="muted" style="margin:0;padding-left:18px;font-size:12.5px">
                ${state.problems.map((problem) => html`<li>${problem}</li>`)}
              </ul>`
            : nothing}
          ${state.reason === "local_changes"
            ? html`<div class="actions" style="display:flex;gap:8px">
                <button class="btn secondary" ?disabled=${store.busy} @click=${() => store.clearImport()}>Cancel</button>
                <button class="btn danger" ?disabled=${store.busy} @click=${() => void store.importBundle(state.file, true)}>Replace everything</button>
              </div>`
            : nothing}
        </div>`
      : nothing}
  </div>`;
}

// Replaces Thread's notification settings.
export function settingsView(store: Store): View {
  const importing = store.drafts.get<ImportConfirm>(IMPORT_KEY);
  return {
    overlay: importing ? confirmImport(store, importing.file) : googleOverlay(store),
    title: "Settings",
    back: true,
    actions: [],
    body: html`<div class="page">
      <div class="label" style="padding:16px 20px 8px">This is me</div>
      ${meSection(store)}

      <div class="label" style="padding:0 20px 8px">Notifications</div>
      ${notificationsSection(store)}

      <div class="label" style="padding:0 20px 8px">Export</div>
      <div class="card" style="padding:13px;display:grid;gap:10px">
        <div class="muted" style="font-size:12.5px">Saves everything in your Hearth as one file in your Hearth exports folder.</div>
        <button class="btn" ?disabled=${store.busy} @click=${() => void store.exportNow()}>Export now</button>
      </div>

      <div class="label" style="padding:0 20px 8px">Import</div>
      ${importSection(store)}

      <div class="label" style="padding:0 20px 8px">Google Contacts</div>
      ${googleSection(store)}

      <div class="label" style="padding:0 20px 8px">About</div>
      <div class="card" style="padding:13px">Version ${PANEL_VERSION ?? "unknown"}</div>
    </div>`,
  };
}
