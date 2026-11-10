import type { Connection } from "../src/api";
import type { ContactGroup, Household, Interaction, Person, Relationship, Snapshot } from "../src/types";

export type Handler = (msg: Record<string, any>) => unknown;

export interface FakeConnection extends Connection {
  sent: Record<string, any>[];
  /** The options passed to each subscribeMessage call, in order. */
  subscribeOptions: unknown[];
  /** Ids of the subscriptions an unsubscribe was sent for, in order. */
  unsubscribed: number[];
  /**
   * Fire a connection event to every registered listener. Like home-assistant-js-websocket,
   * "disconnected" drops every live subscription and starts ids again from 1, so an
   * unsubscribe kept from before then would name a subscription made since.
   */
  fire(event: "ready" | "disconnected" | "reconnect-error"): void;
  /** Lose the socket without telling the listeners: subscriptions end and ids restart from 1. */
  dropSocket(): void;
  /** Deliver an event to the live subscription with this id (1-based, subscribe order since the last disconnect). */
  push(subscriptionId: number, event?: unknown): void;
}

/** A stand-in for hass.connection. Handlers are keyed by message `type`; a handler that throws rejects. */
export function fakeConnection(handlers: Record<string, Handler> = {}): FakeConnection {
  const sent: Record<string, any>[] = [];
  const listeners = new Map<string, Set<() => void>>();
  // Live subscriptions by id. The ids restart after a disconnect, as the library's do.
  const subscriptions = new Map<number, (event: unknown) => void>();
  let nextId = 1;
  const subscribeOptions: unknown[] = [];
  const unsubscribed: number[] = [];
  return {
    sent,
    subscribeOptions,
    unsubscribed,
    async sendMessagePromise(msg: Record<string, any>) {
      sent.push(msg);
      const handler = handlers[msg.type];
      if (!handler) throw { code: "unknown_command", message: `no handler for ${msg.type}` };
      return handler(msg);
    },
    async subscribeMessage(callback: (event: unknown) => void, msg: Record<string, any>, options?: unknown) {
      sent.push(msg);
      subscribeOptions.push(options);
      const id = nextId++;
      subscriptions.set(id, callback);
      // As in the library, the closure keeps only the number: it cancels whatever holds that id now.
      return async () => {
        unsubscribed.push(id);
        subscriptions.delete(id);
      };
    },
    addEventListener(type: string, cb: () => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener(type: string, cb: () => void) {
      listeners.get(type)?.delete(cb);
    },
    dropSocket() {
      subscriptions.clear();
      nextId = 1;
    },
    fire(event) {
      if (event === "disconnected") this.dropSocket();
      for (const cb of [...(listeners.get(event) ?? [])]) cb();
    },
    push(subscriptionId, event = {}) {
      const callback = subscriptions.get(subscriptionId);
      if (!callback) throw new Error(`no live subscription ${subscriptionId}`);
      callback(event);
    },
  } as FakeConnection;
}

const STAMP = "2026-01-01T09:00:00+00:00";

/** A person with every field empty; override what a test needs. */
export function person(id: string, name: string, extra: Partial<Person> = {}): Person {
  return {
    id, name, created_at: STAMP, updated_at: STAMP,
    phone: null, phone2: null, email: null, email2: null, occupation: null, employer: null, how_i_know_them: null,
    notes: null, birthday: null, birth_year_unknown: false, favorite: false,
    close_friend: false, website: null, linkedin: null,
    facebook: null, instagram: null, address: null, school: null,
    relationship_summary: null, summary_updated: null, photo_hash: null,
    household_id: null, google_contact_id: null, google_synced_at: null,
    google_photo_hash: null, google_sync_error: null, photo_url: null,
    contact_status: { last_contacted: null, days_since_contact: null, urgency: "ok" },
    days_until_birthday: null, age: null, household_name: null,
    ...extra,
  };
}

export function interaction(
  id: string, summary: string, date: string, person_ids: string[], extra: Partial<Interaction> = {},
): Interaction {
  return {
    id, summary, date, type: "Call", created_at: STAMP, updated_at: STAMP,
    notes: null, person_ids, ...extra,
  };
}

export function household(id: string, name: string | null, member_ids: string[], extra: Partial<Household> = {}): Household {
  return {
    id, created_at: STAMP, updated_at: STAMP, name_override: null, address: null, notes: null,
    photo_hash: null, photo_url: null, name, name_status: name === null ? "needs_name" : "generated",
    member_ids, ...extra,
  };
}

export function group(id: string, name: string, member_ids: string[], extra: Partial<ContactGroup> = {}): ContactGroup {
  return {
    id, name, created_at: STAMP, updated_at: STAMP, description: null, photo_hash: null,
    photo_url: null, member_ids, ...extra,
  };
}

/** Person B is `type` of person A; `inverse_type` is what A is to B (Python derives it in the snapshot). */
export function relationship(id: string, a: string, b: string, type: string, inverse_type = type): Relationship {
  return {
    id, person_a_id: a, person_b_id: b, type, inverse_type, created_at: STAMP, updated_at: STAMP,
    notes: null, label: `${b} is ${a}'s ${type}`,
  };
}

/** Invented people only. "today" is 2026-11-05. */
export function sampleSnapshot(): Snapshot {
  return {
    people: [
      person("p1", "Alex Marlow", {
        household_id: "h1", household_name: "Marlow Family", birthday: "1984-03-12",
        age: 42, days_until_birthday: 127, close_friend: true, favorite: true,
        contact_status: { last_contacted: "2026-10-20", days_since_contact: 16, urgency: "ok" },
      }),
      person("p2", "Jordan Marlow", {
        household_id: "h1", household_name: "Marlow Family",
        contact_status: { last_contacted: "2026-10-20", days_since_contact: 16, urgency: "ok" },
      }),
      person("p3", "Riley Marlow", {
        household_id: "h1", household_name: "Marlow Family", birthday: "2013-11-20",
        age: 12, days_until_birthday: 15,
      }),
      person("p4", "Sam Okafor", {
        close_friend: true,
        contact_status: { last_contacted: "2026-09-10", days_since_contact: 56, urgency: "overdue" },
      }),
      person("p5", "Casey Lindqvist", {
        close_friend: true,
        contact_status: { last_contacted: "2026-09-27", days_since_contact: 39, urgency: "due_soon" },
      }),
      person("p6", "Taylor Brandt", {
        occupation: "Carpenter",
        contact_status: { last_contacted: "2026-08-01", days_since_contact: 96, urgency: "ok" },
      }),
    ],
    households: [
      {
        id: "h1", created_at: STAMP, updated_at: STAMP, name_override: null,
        address: { formatted: "12 Elm St, Springfield" }, notes: null, photo_hash: null,
        photo_url: null, name: "Marlow Family", name_status: "generated",
        member_ids: ["p1", "p2", "p3"],
      },
    ],
    groups: [
      {
        id: "g1", name: "Trail Crew", created_at: STAMP, updated_at: STAMP,
        description: "Saturday hikers", photo_hash: null, photo_url: null,
        member_ids: ["p1", "p4", "p5"],
      },
    ],
    relationships: [
      {
        id: "r1", person_a_id: "p1", person_b_id: "p3", type: "Child",
        created_at: STAMP, updated_at: STAMP, notes: null,
        label: "Riley Marlow is Alex Marlow's Child", inverse_type: "Parent",
      },
    ],
    interactions: [
      interaction("i1", "Coffee and a long catch-up", "2026-10-20", ["p1", "p2"]),
      interaction("i2", "Phoned about the trip", "2026-09-27", ["p5"]),
      interaction("i3", "Dinner out", "2026-09-10", ["p4"]),
    ],
    interaction_types: ["Call", "Text", "In person", "Email", "Other"],
    connection_types: ["Spouse", "Parent", "Child", "Sibling", "Friend", "Mentee", "Other"],
    me_person_id: "p1",
    today: "2026-11-05",
  };
}
