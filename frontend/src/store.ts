import { HearthApi, HearthError, type ChangeNotice, type Connection, type ImportResult } from "./api";
import { PANEL_PATH } from "./router";
import { Drafts } from "./forms/drafts";
import { changedFields, editedFields, findRecord, hasRecord, newFields, type Fields } from "./storeWrites";
import type { EntityKind, GoogleReport, GoogleStatus, NotificationKind, NotificationSetting, NotificationsStatus, Person, PhotoKind, Snapshot } from "./types";

export type Phase =
  | { kind: "loading" }
  | { kind: "noCrm" }
  | { kind: "notLoaded" }
  | { kind: "error"; message: string }
  | { kind: "ready" };

export type SearchChip = "people" | "households" | "groups";

/** The search screen's box and chip: kept here so they survive leaving and coming back. */
export interface SearchState {
  text: string;
  chip: SearchChip;
}

/** What the log and edit sheets save. `notes` is null when blank. */
export interface InteractionChanges {
  type: string;
  date: string; // YYYY-MM-DD
  summary: string;
  notes: string | null;
}

/** What the add reminder form saves. `due_at` is a naive local "YYYY-MM-DDTHH:MM", or null for Someday. */
export interface NewReminder {
  person_id: string;
  note?: string | null;
  due_at?: string | null;
  repeat_every?: number | null;
  repeat_unit?: string | null;
  interaction_id?: string | null;
}

/** What the edit reminder form saves; a field left out is not changed. */
export type ReminderChanges = Partial<Omit<NewReminder, "person_id" | "interaction_id">>;

/** What the add person form saves. Blank and null fields are left out of what's sent. */
export interface NewPerson {
  name: string;
  phone: string | null;
  email: string | null;
  how_i_know_them: string | null;
  birthday: string | null; // YYYY-MM-DD
  birth_year_unknown: boolean;
  /** Put the new person straight into this household. */
  household_id?: string;
}

/** The Import card in Settings. A refusal keeps the file so "Replace everything" can retry it. */
export type ImportState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "done"; summary: string }
  | { kind: "refused"; reason: string; message: string; problems: string[]; file: File };

/** The Notifications card in Settings. */
export interface NotificationsView {
  status: NotificationsStatus | null;
  /** Why the last load failed; null when it worked. */
  loadError: string | null;
  /** True while the test notification is being sent. */
  testing: boolean;
}

/** The Google Contacts card in Settings. `working` is a preview or a sync waiting for the server. */
export interface GoogleView {
  status: GoogleStatus | null;
  /** Why the last status load failed; null when it worked. */
  loadError: string | null;
  /** The last dry run; dropped when a real sync finishes. */
  preview: GoogleReport | null;
  /** The last real run started from here. */
  lastSync: GoogleReport | null;
  working: "preview" | "sync" | null;
}

export const OFFLINE_WRITE = "You're offline. Changes are paused.";
export const STILL_SAVING = "Still saving…";
export const ALREADY_DELETED = "That was already deleted.";

/** Each user's offline copy of their snapshot is stored under this prefix plus their user id. */
const CACHE_PREFIX = "hearth_crm:snapshot:";

/** A snapshot from before reminders (an old cache, say) has none: read it as an empty list. */
function withReminders(snapshot: Snapshot): Snapshot {
  return snapshot.reminders && snapshot.reminder_units ? snapshot : { ...snapshot, reminders: snapshot.reminders ?? [], reminder_units: snapshot.reminder_units ?? [] };
}
const DEBOUNCE_MS = 250;
const TOAST_MS = 3500;
/** Delays before retrying a load that failed while data is on screen; the last repeats. */
const RETRY_DELAYS_MS = [2000, 5000, 10000];
/** How long a just-created record's screen waits for it to reach the snapshot. */
const ARRIVING_MS = 10_000;

interface WriteOptions<T> {
  /** The toast's lead-in when the write fails. */
  failure?: string;
  /**
   * When given, a `not_found` means the record was already deleted elsewhere: the store toasts
   * that, refetches so screens redraw without it, and resolves to `{ value: ifGone() }`.
   */
  ifGone?: () => T;
}

/** Panel state: what to show, the latest snapshot, live updates and the per-user offline cache. */
export class Store {
  phase: Phase = { kind: "loading" };
  snapshot: Snapshot | null = null;
  entryId: string | null = null;
  offline = false;
  /** The last non-connection error from a background refetch; cleared by the next successful fetch. */
  lastError: HearthError | null = null;
  /** Why the last "create my Hearth" failed, shown on the create screen; cleared on the next try. */
  createError: string | null = null;
  creating = false;
  /** True while the error screen's Retry is loading. */
  retrying = false;
  search: SearchState = { text: "", chip: "people" };
  /** Unsaved input and open dialogs, so they survive every re-render. See forms/drafts.ts. */
  drafts = new Drafts(() => this.onChange());
  /** True while a write other than favorite waits for the server. */
  busy = false;
  /** True while a chosen photo is being shrunk, before its upload starts (forms/photoPicker.ts). */
  shrinkingPhoto = false;
  /** Where the last import got to. */
  importState: ImportState = { kind: "idle" };
  /** Google sync health, shown in Settings. Loaded when Settings opens and when a google notice arrives. */
  google: GoogleView = { status: null, loadError: null, preview: null, lastSync: null, working: null };
  /** Notification switches and times, shown in Settings. Loaded when Settings opens and when a notifications notice arrives. */
  notifications: NotificationsView = { status: null, loadError: null, testing: false };
  /** A short message at the bottom of the screen; clears itself. */
  toast: string | null = null;
  /**
   * Why the last write failed, so a form can show an `invalid` error under its field. Cleared
   * when the next write starts and when the route changes.
   */
  writeError: HearthError | null = null;

  /**
   * The live subscription's unsubscribe, with the connection epoch it was made in. The library's
   * unsubscribe names the subscription by a number that restarts on every reconnect, so one kept
   * from an earlier connection would cancel whoever holds that number now (often one of Home
   * Assistant's own). It is only ever called in the epoch it was made in.
   */
  private subscription: { unsubscribe: () => Promise<void>; epoch: number } | null = null;
  /** Counts connection changes (disconnected and ready events). */
  private connEpoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private generation = 0;
  private stopped = false;
  private startRun: Promise<void> | null = null;
  private retryRun: Promise<void> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  /** Counts snapshot requests as they start, so a reply can be placed before or after a write. */
  private fetchSeq = 0;
  /** A record just created that may not be in the snapshot yet, and the last fetch started before. */
  private arriving: { id: string; afterSeq: number } | null = null;
  /** Member lists sent by setGroupMembers that no snapshot has caught up with yet, by group id. */
  private pendingMembers = new Map<string, { ids: string[]; afterSeq: number }>();
  private arrivingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Favorites saved but not yet answered: laid over any snapshot that lands meanwhile. */
  private pendingFavorites = new Map<string, boolean>();
  private onSettings = false;

  constructor(
    private api: HearthApi,
    private conn: Connection,
    private userId: string,
    private storage: Storage | null,
    private onChange: () => void,
  ) {}

  private get cacheKey(): string {
    return `${CACHE_PREFIX}${this.userId}`;
  }

  private onDisconnected = () => {
    // The subscription died with the socket; nothing restores it (resubscribe is off).
    this.connEpoch++;
    this.subscription = null;
    this.offline = true;
    this.onChange();
  };

  private onReady = () => {
    // A new socket, even if its disconnect went unseen: any handle from before is stale.
    this.connEpoch++;
    this.retryAttempt = 0;
    void this.load();
  };

  /**
   * A panel left open overnight gets no change notice when the day turns, so its birthdays and
   * "days since" would stay a day behind. Coming back to it on a new local day refetches. (When
   * the browser's zone differs from Home Assistant's, this can refetch once per return for part
   * of the day; the snapshot's `today` still comes from Python.)
   */
  private onVisibilityChange = () => {
    if (document.visibilityState !== "visible" || this.offline || !this.snapshot) return;
    if (localDay(new Date()) !== this.snapshot.today) void this.refresh();
  };

  start(): Promise<void> {
    // A second call (while started and not stopped) joins the first instead of listening again.
    this.startRun ??= this.begin();
    return this.startRun;
  }

  private async begin(): Promise<void> {
    this.stopped = false;
    this.removeOtherUsersCaches();
    this.conn.addEventListener("disconnected", this.onDisconnected);
    this.conn.addEventListener("ready", this.onReady);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    await this.load();
  }

  stop(): void {
    this.startRun = null;
    this.stopped = true;
    this.generation++;
    this.conn.removeEventListener("disconnected", this.onDisconnected);
    this.conn.removeEventListener("ready", this.onReady);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.stopArriving();
    this.clearRetry();
    void this.dropSubscription();
  }

  /**
   * Create this user's CRM. A failure keeps the create screen up, with the reason in createError.
   * `creating` stays true through the follow-up load, so the button can't be pressed twice.
   */
  async createCrm(): Promise<void> {
    if (this.creating) return;
    this.creating = true;
    this.createError = null;
    this.onChange();
    try {
      await this.api.createCrm();
      await this.load();
    } catch (err) {
      this.createError = errorMessage(err);
    } finally {
      this.creating = false;
      this.onChange();
    }
  }

  /** Load again from the start (status, subscribe, snapshot), as the error screen's Retry does. */
  retry(): Promise<void> {
    if (this.retryRun) return this.retryRun;
    this.retryAttempt = 0;
    this.retrying = true;
    this.onChange();
    this.retryRun = this.load().finally(() => {
      this.retryRun = null;
      this.retrying = false;
      this.onChange();
    });
    return this.retryRun;
  }

  setSearch(patch: Partial<SearchState>): void {
    this.search = { ...this.search, ...patch };
    this.onChange();
  }

  /**
   * The panel's route is now `path` (the full path, starting /hearth). Drafts for forms it has
   * left are dropped, and so is the last write's error. Called before drawing; no onChange.
   */
  routeChanged(path: string): void {
    this.drafts.leaveTo(path);
    this.writeError = null;
    this.onSettings = path === `${PANEL_PATH}/settings`;
    if (this.onSettings && this.phase.kind === "ready") {
      void this.loadGoogle();
      void this.loadNotifications();
    }
    // A refused import (and the file it holds) is only offered on Settings itself.
    if (this.importState.kind === "refused" && path !== `${PANEL_PATH}/settings`) this.importState = { kind: "idle" };
  }

  showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast = message;
    this.onChange();
    this.toastTimer = setTimeout(() => {
      this.toastTimer = null;
      this.toast = null;
      this.onChange();
    }, TOAST_MS);
  }

  // ---- Writes ----
  // Each waits for the server, then relies on the subscription's change notice to re-fetch the
  // snapshot. Only favorite is patched in by hand, so the star flips at once.

  /** Optimistic, like Thread's star: flips now, rolls back if the save fails. */
  async toggleFavorite(person: Person): Promise<void> {
    if (this.refuseOffline()) return;
    const next = !person.favorite;
    this.pendingFavorites.set(person.id, next);
    this.patchFavorite(person.id, next);
    this.onChange();
    try {
      await this.api.update("person", person.id, { favorite: next });
      this.pendingFavorites.delete(person.id);
    } catch (err) {
      this.pendingFavorites.delete(person.id);
      this.patchFavorite(person.id, person.favorite);
      this.showToast(writeError(err));
    }
  }

  async addInteraction(fields: InteractionChanges & { person_ids: string[] }): Promise<boolean> {
    return (await this.createInteraction(fields)) !== null;
  }

  /** Saves a new interaction and resolves to its id (null if it failed), for a reminder linked to it. */
  async createInteraction(fields: InteractionChanges & { person_ids: string[] }): Promise<string | null> {
    const { person_ids, type, date, summary, notes } = fields;
    const created = await this.write(() => this.api.create("interaction", { person_ids, type, date, summary, notes }) as Promise<{ id: string }>);
    return created ? created.value.id : null;
  }

  /**
   * Changes the interaction's own fields only, so the people on a shared one are kept. Only the
   * fields that differ from `base` (what the sheet opened with) and from the snapshot are sent, so
   * an imported summary over the edit limit doesn't block changing just the date. One deleted
   * elsewhere counts as done (with the deleted toast), so its sheet closes.
   */
  async updateInteraction(id: string, changes: InteractionChanges, base?: InteractionChanges): Promise<boolean> {
    const { type, date, summary, notes } = changes;
    const edited = editedFields({ type, date, summary, notes }, base ? { ...base } : undefined);
    const record = this.snapshot ? findRecord(this.snapshot, "interaction", id) : undefined;
    const send = record ? changedFields("interaction", record, edited) : edited;
    if (!Object.keys(send).length) return true;
    const run = () => this.api.update("interaction", id, send);
    return (await this.write(run, { ifGone: () => undefined })) !== null;
  }

  deleteInteraction(id: string): Promise<boolean> {
    return this.remove("interaction", id);
  }

  /** Saves a new reminder and resolves to its id (null if it failed). See `save` for arriving. */
  async addReminder(fields: NewReminder): Promise<string | null> {
    // A null due_at is Someday, which newFields would leave out; send it so the server doesn't default it.
    const sent = { ...newFields("reminder", { ...fields }), due_at: fields.due_at ?? null };
    const created = await this.write(() => this.api.create("reminder", sent) as Promise<{ id: string }>);
    if (!created) return null;
    this.markArriving(created.value.id);
    return created.value.id;
  }

  /** Only the fields that differ from `base` and the snapshot are sent. See `updateInteraction`. */
  async updateReminder(id: string, changes: ReminderChanges, base?: ReminderChanges): Promise<boolean> {
    const edited = editedFields({ ...changes }, base ? { ...base } : undefined);
    const record = this.snapshot ? findRecord(this.snapshot, "reminder", id) : undefined;
    const send = record ? changedFields("reminder", record, edited) : edited;
    if (!Object.keys(send).length) return true;
    const run = () => this.api.update("reminder", id, send);
    return (await this.write(run, { ifGone: () => undefined })) !== null;
  }

  deleteReminder(id: string): Promise<boolean> {
    return this.remove("reminder", id);
  }

  /** Marks it done (a repeating one rolls to its next date on the server), then refreshes. */
  async completeReminder(id: string): Promise<boolean> {
    const done = await this.write(() => this.api.reminderComplete(id), { failure: "Couldn't mark it done", ifGone: () => undefined });
    if (!done) return false;
    await this.refresh();
    return true;
  }

  /** Saves a new person and resolves to their id (null if it failed). See `save` for arriving. */
  async addPerson(draft: NewPerson): Promise<string | null> {
    const fields: Fields = { name: draft.name, phone: draft.phone, email: draft.email, how_i_know_them: draft.how_i_know_them };
    if (draft.household_id) fields.household_id = draft.household_id;
    if (draft.birthday?.trim()) {
      fields.birthday = draft.birthday;
      if (draft.birth_year_unknown) fields.birth_year_unknown = true;
    }
    return (await this.save("person", null, fields))?.id ?? null;
  }

  /**
   * Creates (id null) or updates a record from a form's fields; see storeWrites.ts for what is
   * sent. Resolves to the record's id, or null when refused or failed (with a toast).
   *
   * A new record's id is "arriving" until a snapshot fetched after the save lands, or for at
   * most ARRIVING_MS, so its screen can wait for it.
   *
   * Updating a record that was deleted elsewhere (gone from the snapshot, or `not_found` from the
   * server) toasts "That was already deleted." and resolves to null once the snapshot no longer
   * has it, so the form's screen redraws as "no longer exists".
   *
   * `base` is what an edit form opened with: only fields that differ from it are considered, so a
   * change made elsewhere while the form was open isn't reverted (see storeWrites.editedFields).
   */
  async save(kind: EntityKind, id: string | null, fields: Fields, base?: Fields): Promise<{ id: string } | null> {
    if (id === null) {
      const created = await this.write(() => this.api.create(kind, newFields(kind, fields)) as Promise<{ id: string }>);
      if (!created) return null;
      this.markArriving(created.value.id);
      return { id: created.value.id };
    }
    const record = this.snapshot ? findRecord(this.snapshot, kind, id) : undefined;
    if (!record) {
      if (!this.refuseOffline()) this.showToast(ALREADY_DELETED);
      return null;
    }
    const changes = changedFields(kind, record, editedFields(fields, base));
    if (!Object.keys(changes).length) return { id };
    const saved = await this.write(async () => (await this.api.update(kind, id, changes), true), { ifGone: () => false });
    return saved?.value ? { id } : null;
  }

  /** Deletes a record. One already deleted elsewhere counts as done, with the deleted toast. */
  async remove(kind: EntityKind, id: string): Promise<boolean> {
    return (await this.write(() => this.api.remove(kind, id), { ifGone: () => undefined })) !== null;
  }

  /** `base64` is the shrunk photo (forms/photoPicker.ts). */
  async setPhoto(kind: PhotoKind, id: string, base64: string): Promise<boolean> {
    return (await this.write(() => this.api.setPhoto(kind, id, base64))) !== null;
  }

  async clearPhoto(kind: PhotoKind, id: string): Promise<boolean> {
    return (await this.write(() => this.api.clearPhoto(kind, id))) !== null;
  }

  /**
   * Replaces the group's members with exactly `personIds`. A group deleted elsewhere gets the
   * deleted toast and a refetch, and resolves to false.
   *
   * The list sent is kept as the group's members (see `groupMembers`) until a snapshot catches up,
   * so a second change made before then builds on this one instead of undoing it.
   */
  async setGroupMembers(groupId: string, personIds: string[]): Promise<boolean> {
    const done = await this.write(async () => (await this.api.setGroupMembers(groupId, personIds), true), {
      ifGone: () => false,
    });
    if (!done) return false;
    if (!done.value) {
      // The group is gone; the refetch has already redrawn without it.
      this.pendingMembers.delete(groupId);
      return false;
    }
    this.pendingMembers.set(groupId, { ids: [...personIds], afterSeq: this.fetchSeq });
    if (this.snapshot) this.snapshot = this.withPendingMembers(this.snapshot);
    this.onChange();
    return true;
  }

  /** The group's members to build a membership write on: the last list sent, until a snapshot has it. */
  groupMembers(groupId: string): string[] {
    const pending = this.pendingMembers.get(groupId);
    if (pending) return [...pending.ids];
    return [...(this.snapshot?.groups.find((g) => g.id === groupId)?.member_ids ?? [])];
  }

  private withPendingMembers(snapshot: Snapshot): Snapshot {
    if (!this.pendingMembers.size) return snapshot;
    return {
      ...snapshot,
      groups: snapshot.groups.map((g) => {
        const pending = this.pendingMembers.get(g.id);
        return pending ? { ...g, member_ids: [...pending.ids] } : g;
      }),
    };
  }

  /** Pending member lists end once a snapshot has them, or a fetch started after the write lands. */
  private settlePendingMembers(fetched: Snapshot, seq: number): void {
    const same = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id));
    for (const [groupId, pending] of this.pendingMembers) {
      const group = fetched.groups.find((g) => g.id === groupId);
      if (seq > pending.afterSeq || !group || same(group.member_ids, pending.ids)) this.pendingMembers.delete(groupId);
    }
  }

  setShrinkingPhoto(value: boolean): void {
    this.shrinkingPhoto = value;
    this.onChange();
  }

  /** True for a record just created that isn't in the snapshot yet. */
  isArriving(id: string): boolean {
    return this.arriving?.id === id;
  }

  private markArriving(id: string): void {
    this.stopArriving();
    this.arriving = { id, afterSeq: this.fetchSeq };
    // If no snapshot with it ever comes (a lost change notice, say), its screen stops waiting.
    this.arrivingTimer = setTimeout(() => {
      this.arrivingTimer = null;
      if (this.arriving?.id !== id) return;
      this.arriving = null;
      this.onChange();
    }, ARRIVING_MS);
    this.onChange();
  }

  private stopArriving(): void {
    if (this.arrivingTimer) clearTimeout(this.arrivingTimer);
    this.arrivingTimer = null;
    this.arriving = null;
  }

  /** Who "this is me" is; null clears it. */
  async setMe(personId: string | null): Promise<boolean> {
    return (await this.write(() => this.api.settingsSet(personId))) !== null;
  }

  /** Writes an export bundle on the server and says where it went. */
  async exportNow(): Promise<boolean> {
    const entryId = this.entryId;
    if (!entryId) return false;
    const result = await this.write(() => this.api.exportBundle(entryId), { failure: "Couldn't export" });
    if (!result) return false;
    const { path } = result.value;
    const fileName = path.split(/[\\/]/).pop() || path;
    this.showToast(`Saved ${fileName} to your Hearth exports folder.`);
    return true;
  }

  /**
   * Uploads a bundle into this user's Hearth. The result is in `importState`: the summary, or a
   * refusal the Settings card explains. A backup in progress is a toast, like any write; the
   * snapshot refetches by itself from the server's change notice.
   */
  async importBundle(file: File, replaceExisting: boolean): Promise<boolean> {
    if (this.refuseOffline()) return false;
    if (this.busy) {
      this.showToast(STILL_SAVING);
      return false;
    }
    this.busy = true;
    this.importState = { kind: "uploading" };
    this.onChange();
    try {
      const result: ImportResult = await this.api.importBundle(file, replaceExisting);
      this.importState = { kind: "done", summary: result.summary };
      return true;
    } catch (err) {
      const error = err instanceof HearthError ? err : null;
      const reason = error?.code ?? "unknown_error";
      if (reason === "local_changes" || reason === "cutover_confirmed" || reason === "invalid" || reason === "too_large" || reason === "bad_request" || reason === "no_crm") {
        this.importState = { kind: "refused", reason, message: error?.message ?? reason, problems: error?.problems ?? [], file };
      } else {
        this.importState = { kind: "idle" };
        this.showToast(writeError(err, "Couldn't import"));
      }
      return false;
    } finally {
      this.busy = false;
      this.onChange();
    }
  }

  clearImport(): void {
    this.importState = { kind: "idle" };
    this.onChange();
  }

  // ---- Notifications ----

  /** Reloads the notification settings. Quiet when offline; a failure shows in the card. */
  async loadNotifications(): Promise<void> {
    if (this.offline) return;
    const generation = this.generation;
    try {
      const status = await this.api.notificationsGet();
      if (generation !== this.generation) return;
      this.notifications = { ...this.notifications, status, loadError: null };
    } catch (err) {
      if (generation !== this.generation) return;
      if (err instanceof HearthError && err.code === "offline") this.offline = true;
      else this.notifications = { ...this.notifications, loadError: errorMessage(err) };
    }
    this.onChange();
  }

  /** Changes one notification's switch or time; the server answers with the new settings. */
  async setNotification(kind: NotificationKind, change: Partial<NotificationSetting>): Promise<boolean> {
    const done = await this.write(() => this.api.notificationsSet({ [kind]: change }), { failure: "Couldn't change the notification" });
    if (!done) return false;
    this.notifications = { ...this.notifications, status: done.value, loadError: null };
    this.onChange();
    return true;
  }

  /** Sends a sample notification to the owner's phone. A refusal (no phone) shows as a toast. */
  async sendTestNotification(): Promise<void> {
    if (this.notifications.testing) return;
    this.notifications = { ...this.notifications, testing: true };
    this.onChange();
    const done = await this.write(() => this.api.notificationsTest(), { failure: "Couldn't send the test" });
    this.notifications = { ...this.notifications, testing: false };
    if (done) this.showToast(done.value.sent > 0 ? "Test sent. Check your phone." : "The test could not be delivered.");
    this.onChange();
  }

  // ---- Google Contacts sync ----

  /** Reloads the sync's status. Quiet when offline; a failure shows in the card, not a toast. */
  async loadGoogle(): Promise<void> {
    if (this.offline) return;
    const generation = this.generation;
    try {
      const status = await this.api.googleStatus();
      if (generation !== this.generation) return;
      this.google = { ...this.google, status, loadError: null };
    } catch (err) {
      if (generation !== this.generation) return;
      if (err instanceof HearthError && err.code === "offline") this.offline = true;
      else this.google = { ...this.google, loadError: errorMessage(err) };
    }
    this.onChange();
  }

  /** Switches the sync on or off. Refused before cutover, with the server's reason as a toast. */
  async setGoogleEnabled(enabled: boolean): Promise<boolean> {
    const done = await this.write(() => this.api.googleSetEnabled(enabled), { failure: "Couldn't change the Google sync" });
    if (!done) return false;
    await this.loadGoogle();
    return true;
  }

  /** Counts what a sync would do, without calling Google or writing anything. */
  previewGoogle(): Promise<boolean> {
    return this.runGoogle("preview", () => this.api.googlePreview(), "Couldn't preview");
  }

  /** Runs a sync and keeps its report. The server may take a while, so this doesn't hold `busy`. */
  syncGoogleNow(): Promise<boolean> {
    return this.runGoogle("sync", () => this.api.googleSyncNow(), "Couldn't sync");
  }

  private async runGoogle(kind: "preview" | "sync", run: () => Promise<GoogleReport>, failure: string): Promise<boolean> {
    if (this.refuseOffline()) return false;
    if (this.busy || this.google.working) {
      this.showToast(STILL_SAVING);
      return false;
    }
    this.google = { ...this.google, working: kind };
    this.onChange();
    const generation = this.generation;
    let report: GoogleReport | null = null;
    try {
      report = await run();
    } catch (err) {
      if (generation !== this.generation) return false;
      this.showToast(writeError(err, failure));
    }
    // Reconnected meanwhile: load() already freed the buttons, and a newer run may be in flight.
    if (generation !== this.generation) return report !== null;
    this.google =
      kind === "preview"
        ? { ...this.google, working: null, preview: report ?? this.google.preview }
        : { ...this.google, working: null, lastSync: report ?? this.google.lastSync, preview: report ? null : this.google.preview };
    this.onChange();
    await this.loadGoogle();
    return report !== null;
  }

  /** Forgets a person's Google link so the next run creates a new contact. */
  async clearGoogleContact(personId: string): Promise<boolean> {
    const done = await this.write(() => this.api.googleClearContact(personId), { ifGone: () => undefined });
    if (!done) return false;
    await this.loadGoogle();
    return true;
  }

  private refuseOffline(): boolean {
    if (!this.offline) return false;
    this.showToast(OFFLINE_WRITE);
    return true;
  }

  /** Runs one write at a time. Resolves to null, with a toast, when refused or failed. */
  private async write<T>(run: () => Promise<T>, options: WriteOptions<T> = {}): Promise<{ value: T } | null> {
    if (this.refuseOffline()) return null;
    if (this.busy) {
      this.showToast(STILL_SAVING);
      return null;
    }
    this.busy = true;
    this.writeError = null;
    this.onChange();
    try {
      return { value: await run() };
    } catch (err) {
      const error = err instanceof HearthError ? err : null;
      if (options.ifGone && error?.code === "not_found") {
        this.showToast(ALREADY_DELETED);
        await this.refresh();
        return { value: options.ifGone() };
      }
      this.writeError = error;
      this.showToast(writeError(err, options.failure));
      return null;
    } finally {
      this.busy = false;
      this.onChange();
    }
  }

  private patchFavorite(personId: string, favorite: boolean): void {
    if (!this.snapshot) return;
    this.snapshot = {
      ...this.snapshot,
      people: this.snapshot.people.map((p) => (p.id === personId ? { ...p, favorite } : p)),
    };
  }

  /** Re-fetch the snapshot now. Failures keep the data already shown. */
  async refresh(): Promise<void> {
    const generation = this.generation;
    try {
      const seq = ++this.fetchSeq;
      const snapshot = await this.api.snapshot();
      if (generation !== this.generation) return;
      this.accept(snapshot, seq);
    } catch (err) {
      if (generation !== this.generation) return;
      const error = err instanceof HearthError ? err : null;
      if (error?.code === "offline") {
        this.offline = true;
      } else if (error?.code === "no_crm" || error?.code === "crm_not_loaded") {
        await this.load();
        return;
      } else {
        this.lastError = error ?? new HearthError("unknown_error", errorMessage(err));
        // A background refetch that failed for a reason other than the connection is never silent.
        this.showToast(`Couldn't refresh: ${this.lastError.message}`);
        return;
      }
    }
    this.onChange();
  }

  /** Status, then subscribe and snapshot. Used for the first load and after every reconnect. */
  private async load(): Promise<void> {
    const generation = ++this.generation;
    this.clearRetry();
    // A preview or sync sent on an earlier connection may never answer; don't leave its button stuck.
    if (this.google.working) this.google = { ...this.google, working: null };
    try {
      const status = await this.api.status();
      if (generation !== this.generation) return;
      this.entryId = status.entry_id;
      if (!status.has_crm) {
        this.removeCache();
        return this.show({ kind: "noCrm" });
      }
      if (!status.loaded) {
        // After a restart the websocket can be up before hearth_crm has set up, and no `ready`
        // will come to try again. With data on screen or cached, keep it and retry; otherwise
        // show notLoaded and keep retrying behind it.
        if (!this.snapshot) this.snapshot = this.readCache();
        if (this.snapshot) return this.keepAndRetry();
        this.show({ kind: "notLoaded" });
        this.scheduleRetry();
        return;
      }
      // Subscribe before fetching so a change in between is not missed.
      await this.dropSubscription();
      const epoch = this.connEpoch;
      const unsubscribe = await this.api.subscribe((notice) => this.onNotice(notice));
      if (generation !== this.generation) {
        if (epoch === this.connEpoch) void unsubscribe().catch(() => {});
        return;
      }
      this.subscription = { unsubscribe, epoch };
      const seq = ++this.fetchSeq;
      const snapshot = await this.api.snapshot();
      if (generation !== this.generation) return;
      this.accept(snapshot, seq);
      this.phase = { kind: "ready" };
      this.retryAttempt = 0;
      this.onChange();
      if (this.onSettings) {
        void this.loadGoogle();
        void this.loadNotifications();
      }
    } catch (err) {
      if (generation !== this.generation) return;
      this.fail(err);
    }
  }

  private show(phase: Phase): void {
    this.phase = phase;
    this.snapshot = null;
    this.offline = false;
    this.onChange();
  }

  private fail(err: unknown): void {
    if (!this.snapshot) this.snapshot = this.readCache();
    if (this.snapshot) {
      this.offline = true;
      this.phase = { kind: "ready" };
      this.scheduleRetry();
    } else {
      this.phase = { kind: "error", message: errorMessage(err) };
    }
    this.onChange();
  }

  private keepAndRetry(): void {
    this.offline = true;
    this.phase = { kind: "ready" };
    this.scheduleRetry();
    this.onChange();
  }

  private scheduleRetry(): void {
    if (this.stopped) return;
    this.clearRetry();
    const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
    this.retryAttempt++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.load();
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  /** `seq` is the fetch's number from fetchSeq, taken when the request started. */
  private accept(fetched: Snapshot, seq: number): void {
    const arriving = this.arriving;
    // Cleared once it's in, or once a fetch started after the save doesn't have it (deleted).
    if (arriving && (seq > arriving.afterSeq || hasRecord(fetched, arriving.id))) this.stopArriving();
    const snapshot = this.pendingFavorites.size
      ? {
          ...fetched,
          people: fetched.people.map((p) =>
            this.pendingFavorites.has(p.id) ? { ...p, favorite: this.pendingFavorites.get(p.id)! } : p,
          ),
        }
      : fetched;
    this.settlePendingMembers(fetched, seq);
    this.snapshot = this.withPendingMembers(withReminders(snapshot));
    this.offline = false;
    this.lastError = null;
    try {
      this.storage?.setItem(this.cacheKey, JSON.stringify(fetched));
    } catch {
      // Storage can be full, blocked or absent. The cache is best-effort.
    }
  }

  /**
   * On a shared browser, one user's CRM must not stay readable after another signs in, so only
   * the current user's copy is kept.
   */
  private removeOtherUsersCaches(): void {
    try {
      const storage = this.storage;
      if (!storage) return;
      const stale: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(CACHE_PREFIX) && key !== this.cacheKey) stale.push(key);
      }
      for (const key of stale) storage.removeItem(key);
    } catch {
      // Storage can be blocked or absent.
    }
  }

  private removeCache(): void {
    try {
      this.storage?.removeItem(this.cacheKey);
    } catch {
      // Storage can be blocked or absent.
    }
  }

  private readCache(): Snapshot | null {
    try {
      const raw = this.storage?.getItem(this.cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Snapshot;
      return Array.isArray(parsed?.people) ? withReminders(parsed) : null;
    } catch {
      return null;
    }
  }

  /** Every notice refetches the snapshot; one from the Google sync also reloads its status. */
  private onNotice(notice: ChangeNotice | null): void {
    this.scheduleRefresh();
    if (notice?.entity === "google" && this.google.status) void this.loadGoogle();
    if (notice?.entity === "notifications" && this.notifications.status) void this.loadNotifications();
  }

  private scheduleRefresh(): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, DEBOUNCE_MS);
  }

  private async dropSubscription(): Promise<void> {
    const subscription = this.subscription;
    this.subscription = null;
    // One from an earlier connection is already gone, and its id may now be someone else's.
    if (!subscription || subscription.epoch !== this.connEpoch) return;
    try {
      await subscription.unsubscribe();
    } catch {
      // The socket may already be gone, which ends the subscription anyway.
    }
  }
}

/** The browser's local date as YYYY-MM-DD. */
function localDay(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The toast for a failed write. */
function writeError(err: unknown, failure = "Couldn't save"): string {
  const code = err instanceof HearthError ? err.code : null;
  switch (code) {
    case "offline":
      return OFFLINE_WRITE;
    case "backup_in_progress":
      return "Home Assistant is making a backup. Try again in a moment.";
    case "invalid":
      return errorMessage(err);
    case "not_found":
      return ALREADY_DELETED;
    case "import_failed":
    case "cutover_not_confirmed":
    case "sync_refused":
    case "sync_failed":
    case "not_blocked":
    case "no_phone":
      return errorMessage(err);
    default:
      return `${failure}: ${errorMessage(err)}`;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
