// Mirrors the JSON from custom_components/hearth_crm (serialize.to_dict + derive.build_snapshot).
// Field names stay snake_case. Derived values are computed in Python and never recomputed here.

export type Urgency = "ok" | "due_soon" | "overdue";
export type NameStatus = "generated" | "override" | "needs_name" | "not_a_household";
export type EntityKind = "person" | "household" | "contact_group" | "relationship" | "interaction" | "reminder";
/** The kinds that can have a photo. */
export type PhotoKind = "person" | "household" | "contact_group";

export interface Place {
  formatted: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface ContactStatusInfo {
  last_contacted: string | null; // YYYY-MM-DD
  days_since_contact: number | null;
  urgency: Urgency;
}

export interface Person {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  email2: string | null;
  occupation: string | null;
  employer: string | null;
  how_i_know_them: string | null;
  notes: string | null;
  birthday: string | null; // YYYY-MM-DD
  birth_year_unknown: boolean;
  favorite: boolean;
  close_friend: boolean;
  website: string | null;
  linkedin: string | null;
  facebook: string | null;
  instagram: string | null;
  address: Place | null;
  school: Place | null;
  relationship_summary: string | null;
  summary_updated: string | null;
  photo_hash: string | null;
  household_id: string | null;
  google_contact_id: string | null;
  google_synced_at: string | null;
  google_photo_hash: string | null;
  google_sync_error: string | null;
  photo_url: string | null;
  // derived
  contact_status: ContactStatusInfo;
  days_until_birthday: number | null;
  age: number | null;
  household_name: string | null;
}

export interface Household {
  id: string;
  created_at: string;
  updated_at: string;
  name_override: string | null;
  address: Place | null;
  notes: string | null;
  photo_hash: string | null;
  photo_url: string | null;
  // derived
  name: string | null;
  name_status: NameStatus;
  member_ids: string[];
}

export interface ContactGroup {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  description: string | null;
  photo_hash: string | null;
  photo_url: string | null;
  member_ids: string[];
}

export interface Relationship {
  id: string;
  person_a_id: string;
  person_b_id: string;
  type: string; // ConnectionType value: how person B relates to person A
  created_at: string;
  updated_at: string;
  notes: string | null;
  // derived
  label: string;
  inverse_type: string;
}

export interface Interaction {
  id: string;
  summary: string;
  date: string; // YYYY-MM-DD
  type: string; // InteractionType value
  created_at: string;
  updated_at: string;
  notes: string | null;
  person_ids: string[];
}

export type ReminderState = "done" | "someday" | "overdue" | "due_today" | "upcoming";

export interface Reminder {
  id: string;
  person_id: string;
  note: string | null;
  due_at: string | null; // aware ISO
  due_date: string | null; // YYYY-MM-DD, in Home Assistant's zone
  due_time: string | null; // HH:MM, in Home Assistant's zone
  repeat_every: number | null;
  repeat_unit: "day" | "week" | "month" | "year" | null;
  interaction_id: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
  state: ReminderState;
}

export interface Snapshot {
  people: Person[];
  households: Household[];
  groups: ContactGroup[];
  relationships: Relationship[];
  interactions: Interaction[];
  reminders: Reminder[];
  reminder_units: string[];
  interaction_types: string[];
  connection_types: string[];
  me_person_id: string | null;
  today: string; // YYYY-MM-DD
}

export interface CrmStatus {
  has_crm: boolean;
  loaded: boolean;
  entry_id: string | null;
}

// The Google Contacts sync, from custom_components/hearth_crm (google_runtime.status and
// google_sync.report_to_dict).

// Phone notifications, from custom_components/hearth_crm/notifications.py.

export type NotificationKind = "birthdays" | "log_reminder";

export interface NotificationSetting {
  enabled: boolean;
  /** "HH:MM", in Home Assistant's time zone. */
  time: string;
}

export interface NotificationsStatus {
  settings: Record<NotificationKind, NotificationSetting>;
  /** How many of the owner's Companion app devices can be notified. */
  devices: number;
}

export type GoogleStopReason = "auth" | "rate_limited" | "account_mismatch" | "disabled" | "api_disabled";

/** Each person counted once, in this order of precedence: missing, errors, skipped, pending, synced. */
export interface GoogleCounts {
  synced: number;
  pending: number;
  skipped: number;
  missing: number;
  errors: number;
}

export interface GoogleProblem {
  person_id: string;
  name: string;
  kind: "created" | "updated" | "photo" | "skipped" | "missing" | "error";
  message: string | null;
}

/** What one run (or dry-run preview) did. `created` and `updated` are what would happen when `dry_run`. */
export interface GoogleReport {
  dry_run: boolean;
  started_at: string; // ISO
  created: number;
  updated: number;
  photos: number;
  skipped: number;
  missing: number;
  errors: number;
  pending: number;
  stopped_reason: GoogleStopReason | null;
  problems: GoogleProblem[];
  would_create: string[]; // dry run only: names
  would_update: number;
}

export interface GoogleStatus {
  connected: boolean;
  enabled: boolean;
  cutover_confirmed: boolean;
  running: boolean;
  last_run: GoogleReport | null;
  last_error: string | null;
  counts: GoogleCounts;
}
