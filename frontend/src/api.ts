import type {
  CrmStatus, EntityKind, GoogleReport, GoogleStatus, NotificationKind, NotificationSetting, NotificationsStatus, PhotoKind, Snapshot,
} from "./types";

/** The slice of Home Assistant's hass.connection (home-assistant-js-websocket) that Hearth uses. */
export interface Connection {
  sendMessagePromise<T = unknown>(msg: Record<string, unknown>): Promise<T>;
  subscribeMessage<T = unknown>(
    callback: (event: T) => void,
    msg: Record<string, unknown>,
    options?: { resubscribe?: boolean },
  ): Promise<() => Promise<void>>;
  addEventListener(type: "ready" | "disconnected" | "reconnect-error", cb: () => void): void;
  removeEventListener(type: "ready" | "disconnected" | "reconnect-error", cb: () => void): void;
}

/** The slice of Home Assistant's hass.auth that Hearth uses, for the import upload. */
export interface Auth {
  data: { access_token: string };
  expired?: boolean;
  refreshAccessToken(): Promise<void>;
}

/** What a finished import reports. */
export interface ImportResult {
  summary: string;
  counts: Record<string, number>;
}

/** The server's change notice. Only `entity` is read, to tell a Google sync run from a record edit. */
export interface ChangeNotice {
  entity?: string;
}

function asNotice(event: unknown): ChangeNotice | null {
  return event && typeof event === "object" ? (event as ChangeNotice) : null;
}

export class HearthError extends Error {
  constructor(
    public code: string,
    message: string,
    /** For `invalid`: the field the server rejected, from its "<field>: <message>" (for example "address.lat"). */
    public field?: string,
    /** For an import refused as `invalid`: what is wrong with the bundle. */
    public problems: string[] = [],
  ) {
    super(message);
    this.name = "HearthError";
  }
}

const INVALID_FIELD = /^([A-Za-z_][\w.]*): /;

function toHearthError(err: unknown): HearthError {
  if (err instanceof HearthError) return err;
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : String(err);
  if (typeof e.code === "string" && e.code) {
    const field = e.code === "invalid" ? INVALID_FIELD.exec(message)?.[1] : undefined;
    return new HearthError(e.code, message, field);
  }
  // home-assistant-js-websocket rejects with numeric codes (e.g. ERR_CONNECTION_LOST = 3) when the
  // socket is down, and with a bare non-Error value in some transport failures.
  if (typeof e.code === "number") return new HearthError("offline", message);
  // Any other Error (for example a programmer TypeError) must not masquerade as a lost connection.
  if (err instanceof Error) return new HearthError("unknown_error", message);
  return new HearthError("offline", message);
}

export class HearthApi {
  /** `auth` is read when an upload starts, because Home Assistant swaps it when the token refreshes. */
  constructor(
    private conn: Connection,
    private auth: () => Auth | undefined = () => undefined,
  ) {}

  private async send<T>(msg: Record<string, unknown>): Promise<T> {
    try {
      return await this.conn.sendMessagePromise<T>(msg);
    } catch (err) {
      throw toHearthError(err);
    }
  }

  status(): Promise<CrmStatus> {
    return this.send({ type: "hearth_crm/crm/status" });
  }

  createCrm(): Promise<{ entry_id: string }> {
    return this.send({ type: "hearth_crm/crm/create" });
  }

  snapshot(): Promise<Snapshot> {
    return this.send({ type: "hearth_crm/snapshot" });
  }

  /**
   * Calls onChange for every change event, with the notice ({source, entity, entity_id, action}).
   * Resolves to an unsubscribe function.
   */
  async subscribe(onChange: (notice: ChangeNotice | null) => void): Promise<() => Promise<void>> {
    try {
      // The store owns resubscription (on `ready`), so the library must not also resubscribe,
      // which would leave an orphan subscription nobody can unsubscribe.
      return await this.conn.subscribeMessage((event) => onChange(asNotice(event)), { type: "hearth_crm/subscribe" }, { resubscribe: false });
    } catch (err) {
      throw toHearthError(err);
    }
  }

  create(kind: EntityKind, fields: Record<string, unknown>): Promise<unknown> {
    return this.send({ type: "hearth_crm/create", kind, fields });
  }

  update(kind: EntityKind, entityId: string, changes: Record<string, unknown>): Promise<unknown> {
    return this.send({ type: "hearth_crm/update", kind, entity_id: entityId, changes });
  }

  remove(kind: EntityKind, entityId: string): Promise<unknown> {
    return this.send({ type: "hearth_crm/delete", kind, entity_id: entityId });
  }

  /** `data` is the photo as base64, with no data: prefix. */
  setPhoto(kind: PhotoKind, entityId: string, data: string): Promise<{ photo_hash: string }> {
    return this.send({ type: "hearth_crm/photo/set", kind, entity_id: entityId, data });
  }

  clearPhoto(kind: PhotoKind, entityId: string): Promise<unknown> {
    return this.send({ type: "hearth_crm/photo/clear", kind, entity_id: entityId });
  }

  /** Replaces the group's members with exactly `personIds`. */
  setGroupMembers(groupId: string, personIds: string[]): Promise<unknown> {
    return this.send({ type: "hearth_crm/group/set_members", group_id: groupId, person_ids: personIds });
  }

  settingsGet(): Promise<{ me_person_id: string | null }> {
    return this.send({ type: "hearth_crm/settings/get" });
  }

  settingsSet(mePersonId: string | null): Promise<unknown> {
    return this.send({ type: "hearth_crm/settings/set", changes: { me_person_id: mePersonId } });
  }

  notificationsGet(): Promise<NotificationsStatus> {
    return this.send({ type: "hearth_crm/notifications/get" });
  }

  /** Only what is mentioned changes. */
  notificationsSet(changes: Partial<Record<NotificationKind, Partial<NotificationSetting>>>): Promise<NotificationsStatus> {
    return this.send({ type: "hearth_crm/notifications/set", changes });
  }

  /** Refused with code `no_phone` when the owner has no Companion app device. */
  notificationsTest(): Promise<{ sent: number }> {
    return this.send({ type: "hearth_crm/notifications/test" });
  }

  googleStatus(): Promise<GoogleStatus> {
    return this.send({ type: "hearth_crm/google/status" });
  }

  /** Refused with code `cutover_not_confirmed` until the CRM's cutover is confirmed. */
  googleSetEnabled(enabled: boolean): Promise<GoogleStatus> {
    return this.send({ type: "hearth_crm/google/set_enabled", enabled });
  }

  googleSyncNow(): Promise<GoogleReport> {
    return this.send({ type: "hearth_crm/google/sync_now" });
  }

  /** A dry run: local only, no Google call and nothing written. */
  googlePreview(): Promise<GoogleReport> {
    return this.send({ type: "hearth_crm/google/preview" });
  }

  /** Forgets the person's Google link, so the next run creates a fresh contact. */
  googleClearContact(personId: string): Promise<unknown> {
    return this.send({ type: "hearth_crm/google/clear_contact", entity_id: personId });
  }

  async exportBundle(entryId: string): Promise<{ path: string }> {
    const result = await this.send<{ response: { path: string } }>({
      type: "call_service",
      domain: "hearth_crm",
      service: "export",
      service_data: { config_entry_id: entryId },
      return_response: true,
    });
    return result.response;
  }

  /**
   * Uploads a bundle into the caller's own CRM (the server picks it from the token's user).
   * Refusals reject with a HearthError whose code is the server's `reason`.
   */
  async importBundle(file: File, replaceExisting: boolean): Promise<ImportResult> {
    const auth = this.auth();
    if (!auth) throw new HearthError("unknown_error", "Not signed in to Home Assistant.");
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("replace_existing", replaceExisting ? "true" : "false");
    let response: Response;
    try {
      if (auth.expired) await auth.refreshAccessToken();
      // The token goes in the header only, never in the URL.
      response = await fetch("/api/hearth_crm/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.data.access_token}` },
        body,
      });
    } catch (err) {
      throw new HearthError("offline", err instanceof Error ? err.message : String(err));
    }
    if (response.ok) return (await response.json()) as ImportResult;
    let reply: { reason?: unknown; message?: unknown; problems?: unknown } | null = null;
    try {
      reply = await response.json();
    } catch {
      // An unexpected server error is plain text, not JSON.
    }
    if (typeof reply?.reason === "string") {
      const problems = Array.isArray(reply.problems) ? reply.problems.filter((p): p is string => typeof p === "string") : [];
      throw new HearthError(reply.reason, typeof reply.message === "string" ? reply.message : reply.reason, undefined, problems);
    }
    throw new HearthError("import_failed", "Import failed unexpectedly; see the Home Assistant log.");
  }
}
