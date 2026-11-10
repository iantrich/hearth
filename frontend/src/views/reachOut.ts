import { html, nothing } from "lit";
import { avatar } from "../components";
import { formatMonthDay, plural } from "../format";
import { href } from "../router";
import type { Store } from "../store";
import type { Person } from "../types";
import { snapshotOf, type View } from "./view";

// Each person's urgency, last contact and day count are the snapshot's contact_status
// (computed in Python); this screen only filters and sorts.
function row(person: Person, overdue: boolean) {
  const status = person.contact_status;
  const color = overdue ? "var(--danger)" : "var(--warning)";
  return html`<a class="row" href=${href.person(person.id)}>
    <span style="width:3px;height:36px;border-radius:2px;background:${color};flex:none"></span>
    ${avatar(person.name, person.photo_url)}
    <span class="main">
      <div class="name">${person.name}</div>
      <div class="sub">${status.last_contacted ? `Last: ${formatMonthDay(status.last_contacted)}` : "No interactions yet"}</div>
    </span>
    <span class="meta" style="color:${color}">${status.days_since_contact === null ? "—" : `${status.days_since_contact}d`}</span>
  </a>`;
}

// Least overdue first, matching the iOS ordering; never contacted at all sinks to the end.
const byDays = (a: Person, b: Person) =>
  (a.contact_status.days_since_contact ?? Infinity) - (b.contact_status.days_since_contact ?? Infinity);

export function reachOutView(store: Store): View {
  // A day-to-day view, so hidden people stay out, as on Home.
  const friends = snapshotOf(store).people.filter((p) => p.close_friend && !p.hide_from_list);
  const overdue = friends.filter((p) => p.contact_status.urgency === "overdue").sort(byDays);
  const dueSoon = friends.filter((p) => p.contact_status.urgency === "due_soon").sort(byDays);

  return {
    title: "Reach out",
    back: false,
    actions: [],
    body: html`<div class="page">
      <div class="reach-card">
        <div class="mono accent" style="font-size:10px">CLOSE FRIEND ROTATION · ~6WK CADENCE</div>
        <div class="h-serif" style="font-size:17px;margin-top:6px">${plural(overdue.length, "person", "people")} overdue</div>
      </div>
      ${overdue.length
        ? html`<div class="label list-label">Overdue</div>
            <div class="list">${overdue.map((p) => row(p, true))}</div>`
        : nothing}
      ${dueSoon.length
        ? html`<div class="label list-label">Due soon</div>
            <div class="list">${dueSoon.map((p) => row(p, false))}</div>`
        : nothing}
      ${!overdue.length && !dueSoon.length ? html`<div class="empty">Everyone's been in touch recently.</div>` : nothing}
    </div>`,
  };
}
