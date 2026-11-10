import { html, nothing, type TemplateResult } from "lit";
import { avatar, avatarStack } from "../components";
import { formatMonthDay, untilLabel } from "../format";
import { icons } from "../icons";
import { upcomingBirthdays } from "../logic/birthdays";
import { addDays } from "../logic/calendarDay";
import { favorites } from "../logic/favorites";
import { interactionPeople, interactionPeopleSummary, visibleInteractions } from "../logic/interactionFeed";
import { firstName } from "../logic/names";
import { href } from "../router";
import type { Store } from "../store";
import type { Interaction, Person } from "../types";
import { snapshotOf, type View } from "./view";

// A one-person row splits in two: the person goes to their page, the rest to the interaction.
// With several people there's no single person to mean, so the whole row goes to the
// interaction, whose screen lists them.
export function interactionRow(interaction: Interaction, people: Person[]): TemplateResult {
  const sole = people.length === 1 ? people[0] : undefined;
  const header = html`${avatarStack(people)}<span class="name" style="flex:1;min-width:0"
      >${interactionPeopleSummary(people)}</span
    >`;
  return html`<div class="row" style="flex-direction:column;align-items:stretch;gap:2px">
    <a
      href=${sole ? href.person(sole.id) : href.interaction(interaction.id)}
      style="display:flex;align-items:center;gap:12px"
      >${header}</a
    >
    <a href=${href.interaction(interaction.id)} style="display:flex;gap:12px">
      <span class="sub" style="flex:1">${interaction.summary}</span>
      <span class="meta">${formatMonthDay(interaction.date)}</span>
    </a>
  </div>`;
}

// Day counts are the snapshot's `days_until_birthday`; upcomingBirthdays only keeps people who have one.
function birthdayRow(person: Person): TemplateResult {
  return html`<a class="row" href=${href.person(person.id)}>
    ${avatar(person.name, person.photo_url)}
    <span class="main">
      <div class="name">${person.name}</div>
      <div class="sub">${untilLabel(person.days_until_birthday ?? 0)}</div>
    </span>
  </a>`;
}

export function homeView(store: Store): View {
  const { people, interactions, today } = snapshotOf(store);
  const favs = favorites(people);
  const birthdays = upcomingBirthdays(people, 30).slice(0, 3);
  const recent = visibleInteractions(interactions, people, { since: addDays(today, -30), limit: 10 });

  return {
    title: "Hearth",
    back: false,
    actions: [{ icon: icons.gear, label: "Settings", href: href.settings() }],
    body: html`<div class="page">
      ${favs.length
        ? html`<div class="list favorites" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px 12px;padding:16px">
            ${favs.map(
              (p) => html`<a href=${href.person(p.id)} style="display:grid;justify-items:center;gap:6px;min-width:0">
                ${avatar(p.name, p.photo_url, 56)}
                <span class="fav-name" style="font-weight:600;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                  >${firstName(p.name)}</span
                >
              </a>`,
            )}
          </div>`
        : nothing}

      <div class="section">
        <div class="section-head"><h2>Upcoming</h2><a href=${href.birthdays()}>See all</a></div>
        <div class="list">
          ${birthdays.length ? birthdays.map(birthdayRow) : html`<div class="empty">No birthdays in the next 30 days.</div>`}
        </div>
      </div>

      <div class="section">
        <!-- "See more", not "See all": that list caps at 25. -->
        <div class="section-head"><h2>Recent</h2><a href=${href.interactions()}>See more</a></div>
        <div class="list">
          ${recent.length
            ? recent.map((i) => interactionRow(i, interactionPeople(i, people)))
            : html`<div class="empty">Nothing logged in the last 30 days.</div>`}
        </div>
      </div>
    </div>`,
  };
}

export function birthdaysView(store: Store): View {
  const all = upcomingBirthdays(snapshotOf(store).people);
  return {
    title: "Birthdays",
    back: true,
    actions: [],
    body: html`<div class="page list">
      ${all.length
        ? all.map((person) => {
            const days = person.days_until_birthday ?? 0;
            return html`<a class="row" href=${href.person(person.id)}>
              ${avatar(person.name, person.photo_url)}
              <span class="main"><div class="name">${person.name}</div></span>
              <span class="meta">${days === 0 ? "Today" : `${days}d`}</span>
            </a>`;
          })
        : html`<div class="empty">No birthdays yet.</div>`}
    </div>`,
  };
}

// No date window and the 25 most recent, so a quiet month still fills it.
export function interactionsView(store: Store): View {
  const { people, interactions } = snapshotOf(store);
  const list = visibleInteractions(interactions, people, { limit: 25 });
  return {
    title: "Recent",
    back: true,
    actions: [],
    body: html`<div class="page list">
      ${list.length
        ? list.map((i) => interactionRow(i, interactionPeople(i, people)))
        : html`<div class="empty">No interactions yet.</div>`}
    </div>`,
  };
}
