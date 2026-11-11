import { html, nothing, type TemplateResult } from "lit";
import { avatar } from "../components";
import { photoTap } from "../forms/photoPicker";
import { birthLine, formatMonthDayYear } from "../format";
import { icons } from "../icons";
import { callUrl, emailUrl, mapsUrl, messageUrl, webUrl } from "../logic/contactActions";
import { interactionsFor } from "../logic/interactionFeed";
import { householdIsNamed, householdTitle } from "../logic/names";
import { buildPersonConnections, isEmptyConnections, type PersonConnection } from "../logic/personConnections";
import { href } from "../router";
import type { Store } from "../store";
import type { Household, Interaction, Person, Snapshot } from "../types";
import { googleErrorText } from "./googleSettings";
import { logSheet } from "./log";
import { reminderSection } from "./reminderRows";
import { arriving, notFound, snapshotOf, type View } from "./view";

// tel:, sms: and mailto: open with target="_blank": inside the Companion app that's the only
// form that reaches Phone, Messages or Mail. Harmless in desktop browsers.
function actionLink(icon: TemplateResult, label: string, url: string) {
  return html`<a class="action" href=${url} target="_blank" rel="noopener noreferrer" aria-label=${label} title=${label}
    >${icon}</a
  >`;
}

// Unavailable actions are left out rather than dimmed, so the row shows only how this person
// can actually be reached. Log goes to the person's /log route, which opens the log sheet, and
// Add reminder to the reminder sheet.
function actionRow(person: Person, household: Household | null) {
  const call = callUrl(person.phone);
  const message = messageUrl(person.phone);
  const email = emailUrl(person.email);
  const map = mapsUrl(person, household);
  return html`<div class="actions-row">
    <a class="action primary" href=${href.logInteraction(person.id)} aria-label="Log interaction" title="Log interaction"
      >${icons.plus}</a
    >
    <a class="action" href=${href.newReminder(person.id)} aria-label="Add reminder" title="Add reminder">${icons.bell}</a>
    ${call ? actionLink(icons.phone, "Call", call) : nothing} ${message ? actionLink(icons.message, "Message", message) : nothing}
    ${email ? actionLink(icons.envelope, "Email", email) : nothing} ${map ? actionLink(icons.mapPin, "Map", map) : nothing}
  </div>`;
}

// The type is the snapshot's, already oriented from this person's side.
// The name goes to their screen; the type opens the relationship's sheet.
function connectionRow(personId: string, connection: PersonConnection) {
  const p = connection.person;
  return html`<div style="display:flex;align-items:center;gap:10px;padding:6px 0">
    <a class="connection" href=${href.person(p.id)} style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
      ${avatar(p.name, p.photo_url, 28)}
      <span style="flex:1;font-weight:600;font-size:13px">${p.name}</span>
    </a>
    ${connection.connectionType && connection.relationshipId
      ? html`<a
          class="connection-type mono muted"
          style="font-size:9px;padding:6px 0 6px 8px"
          href=${href.relationship(personId, connection.relationshipId)}
          aria-label=${`Edit relationship with ${p.name}`}
          >${connection.connectionType.toUpperCase()}</a
        >`
      : nothing}
  </div>`;
}

const divider = html`<div style="border-top:1px solid var(--border);margin:9px 0"></div>`;

// A household Python couldn't name, or says isn't one, shows that status in muted sentence
// case: it's a note about the record, not a name.
function householdHeading(household: Household) {
  const named = householdIsNamed(household);
  return html`<a href=${href.household(household.id)} style="display:flex;justify-content:space-between;padding-bottom:2px">
    <span class="mono household-name ${named ? "accent" : "muted"}" style="font-size:9.5px"
      >${named ? householdTitle(household).toUpperCase() : householdTitle(household)}</span
    >
    <span class="mono muted" style="font-size:9px">HOUSEHOLD</span>
  </a>`;
}

function connectionsCard(person: Person, snapshot: Snapshot) {
  const { people, households, groups, relationships, me_person_id } = snapshot;
  // The owner ("this is me") is left out: their name on every profile is noise.
  const c = buildPersonConnections(person.id, { people, households, groups, relationships, excludedId: me_person_id });
  const row = (connection: PersonConnection) => connectionRow(person.id, connection);
  const add = html`<a class="accent add-relationship" href=${href.newRelationship(person.id)} style="display:block;font-size:12.5px;padding:8px 20px 18px"
    >Add relationship</a
  >`;
  if (isEmptyConnections(c))
    return html`<div class="label" style="padding:0 20px 8px">Connections</div>${add}`;
  return html`<div class="label" style="padding:0 20px 8px">Connections</div>
    <div class="card">
      ${c.household ? html`${householdHeading(c.household)} ${c.householdMembers.map(row)}` : nothing}
      ${c.others.length
        ? html`${c.household ? html`${divider}<div class="mono muted" style="font-size:9.5px">ELSEWHERE</div>` : nothing}
          ${c.others.map(row)}`
        : nothing}
      ${c.groups.length
        ? html`${c.household || c.others.length ? divider : nothing}
            <div class="mono muted" style="font-size:9.5px;padding-bottom:5px">GROUPS</div>
            <div class="chips">
              ${c.groups.map(
                (g) =>
                  html`<a class="chip" href=${href.group(g.id)}
                    >${g.name}<span class="mono muted" style="font-size:8.5px">${g.member_ids.length}</span></a
                  >`,
              )}
            </div>`
        : nothing}
    </div>
    ${add}`;
}

function socials(person: Person) {
  const links = [
    [webUrl(person.website), icons.globe, "Website"],
    [webUrl(person.linkedin), icons.linkedIn, "LinkedIn profile"],
    [webUrl(person.facebook), icons.facebook, "Facebook profile"],
    [webUrl(person.instagram), icons.instagram, "Instagram profile"],
  ] as const;
  // Only http and https addresses become links; anything else is left out.
  const present = links.filter(([url]) => url);
  if (!present.length) return nothing;
  return html`<div style="display:flex;gap:14px;padding:0 20px 18px">
    ${present.map(
      ([url, icon, label]) =>
        html`<a class="accent" style="width:22px;height:22px;display:inline-flex" href=${url ?? ""} target="_blank" rel="noopener noreferrer" aria-label=${label} title=${label}
          >${icon}</a
        >`,
    )}
  </div>`;
}

function timeline(interactions: Interaction[]) {
  if (!interactions.length) return nothing;
  return html`<div class="label" style="padding:0 20px 8px">Timeline</div>
    <div style="display:grid;gap:16px;padding:0 20px 20px">
      ${interactions.map(
        (i) => html`<a href=${href.interaction(i.id)} style="display:flex;gap:12px;align-items:flex-start">
          <span style="width:11px;height:11px;border:2px solid var(--accent);border-radius:50%;margin-top:3px;flex:none"></span>
          <span>
            <div class="mono muted" style="font-size:9.5px">${formatMonthDayYear(i.date).toUpperCase()} · ${i.type.toUpperCase()}</div>
            <div style="font-weight:600;font-size:13px">${i.summary}</div>
          </span>
        </a>`,
      )}
    </div>`;
}

export function personView(store: Store, id: string, sheet: "log" | null): View {
  const snapshot = snapshotOf(store);
  const person = snapshot.people.find((p) => p.id === id);
  if (!person) return store.isArriving(id) ? arriving : notFound("person");
  const household = person.household_id ? (snapshot.households.find((h) => h.id === person.household_id) ?? null) : null;
  const occupation = [person.occupation, person.employer].filter(Boolean).join(" - ");
  const how = person.how_i_know_them?.trim();

  return {
    title: null,
    back: true,
    actions: [
      { icon: icons.pencil, label: "Edit", href: href.editPerson(person.id) },
      {
        icon: person.favorite ? icons.starFill : icons.star,
        label: person.favorite ? "Remove from favorites" : "Add to favorites",
        className: person.favorite ? "accent" : "muted",
        onClick: () => void store.toggleFavorite(person),
      },
    ],
    body: html`<div class="page">
      <div style="display:grid;justify-items:center;gap:6px;padding:8px 20px 18px;text-align:center">
        ${photoTap(store, { kind: "person", id: person.id, name: person.name, photoUrl: person.photo_url })}
        <div class="h-serif" style="font-size:21px">${person.name}</div>
        ${occupation ? html`<div class="muted" style="font-size:12.5px">${occupation}</div>` : nothing}
        ${how ? html`<div class="muted" style="font-size:12.5px">${how}</div>` : nothing}
        ${person.birthday
          ? html`<div class="muted" style="font-size:12.5px">${birthLine(person.birthday, person.birth_year_unknown, person.age)}</div>`
          : nothing}
        ${person.close_friend
          ? html`<div class="mono accent" style="font-size:10px;padding:4px 12px;border:1px dashed var(--thread);border-radius:999px;margin-top:4px">
              ◆ Close Friend rotation
            </div>`
          : nothing}
      </div>
      ${person.google_sync_error
        ? html`<a class="notice google-error" href=${href.settings()} style="display:block">Google sync: ${googleErrorText(person.google_sync_error)}</a>`
        : nothing}
      ${actionRow(person, household)}
      ${person.relationship_summary
        ? html`<div class="label" style="padding:0 20px 8px">Relationship summary</div>
            <div class="card" style="border-left:3px solid var(--accent);padding:14px;font-size:12.5px;white-space:pre-wrap">${person.relationship_summary}</div>`
        : nothing}
      ${reminderSection(store, snapshot.reminders.filter((r) => r.person_id === person.id && r.state !== "done"), "padding:0 20px 8px", "padding:0")}
      ${connectionsCard(person, snapshot)} ${socials(person)} ${timeline(interactionsFor(snapshot.interactions, person.id))}
    </div>`,
    overlay: sheet === "log" ? logSheet(store, person, null) : undefined,
  };
}
