import { html, nothing } from "lit";
import { personRow } from "../components";
import { plural } from "../format";
import { sortHousehold } from "../logic/householdOrder";
import { memberRoster } from "../logic/memberRoster";
import { icons } from "../icons";
import { householdIsNamed, householdTitle } from "../logic/names";
import { href } from "../router";
import type { Store } from "../store";
import { notFound, snapshotOf, type View } from "./view";

interface Heading {
  title: string;
  muted: boolean;
  subtitle: string | null;
  /** A nudge to fix the name or dissolve the household, linking to its edit screen. */
  prompt: { text: string; href: string } | null;
  editHref: string;
}

function memberList(store: Store, heading: Heading, memberIds: string[], ordered: boolean): View {
  const { people, relationships } = snapshotOf(store);
  const roster = memberRoster(memberIds, people);
  // Households read as a family: parents first, oldest to youngest. Groups have no such
  // structure, so they stay alphabetical.
  const members = ordered ? sortHousehold(roster, memberIds, relationships, (p) => p) : roster;
  return {
    title: null,
    back: true,
    actions: [{ icon: icons.pencil, label: "Edit", href: heading.editHref }],
    body: html`<div class="page">
      <div style="padding:16px">
        <div class="h-serif members-title ${heading.muted ? "muted" : ""}" style="font-size:21px">${heading.title}</div>
        ${heading.subtitle ? html`<div class="muted" style="font-size:12.5px;margin-top:4px">${heading.subtitle}</div>` : nothing}
        ${heading.prompt
          ? html`<a class="warning name-prompt" style="display:block;font-size:12.5px;margin-top:4px" href=${heading.prompt.href}>${heading.prompt.text}</a>`
          : nothing}
        <!-- The members actually shown, not the raw id count. -->
        <div class="label" style="margin-top:6px">${plural(members.length, "member").toUpperCase()}</div>
      </div>
      <div class="list">${members.map((p) => personRow(p))}</div>
    </div>`,
  };
}

export function householdView(store: Store, id: string): View {
  const household = snapshotOf(store).households.find((h) => h.id === id);
  if (!household) return notFound("household");
  const editHref = href.editHousehold(id);
  const prompt =
    household.name_status === "needs_name"
      ? { text: "This household needs a name. Name it", href: editHref }
      : household.name_status === "not_a_household"
        ? { text: "This isn't a household any more. Review it", href: editHref }
        : null;
  const heading = { title: householdTitle(household), muted: !householdIsNamed(household), subtitle: null, prompt, editHref };
  return memberList(store, heading, household.member_ids, true);
}

export function groupView(store: Store, id: string): View {
  const group = snapshotOf(store).groups.find((g) => g.id === id);
  if (!group) return notFound("group");
  return memberList(store, { title: group.name, muted: false, subtitle: group.description, prompt: null, editHref: href.editGroup(id) }, group.member_ids, false);
}
