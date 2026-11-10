import { html, nothing, type TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { keyed } from "lit/directives/keyed.js";
import { initials } from "./format";
import { icons } from "./icons";
import { href } from "./router";
import type { Person } from "./types";

// A photo when the person has one, initials otherwise. Initials sit underneath, so a photo
// that fails to load (an expired signed URL, say) is hidden to show them. The <img> is keyed by
// its URL, so a renewed URL gets a fresh element without the hiding class.
export function avatar(name: string, photoUrl: string | null, size = 42): TemplateResult {
  const font = Math.round((size * 15) / 42);
  return html`<span class="avatar" style="width:${size}px;height:${size}px;font-size:${font}px">
    ${initials(name)}
    ${photoUrl
      ? keyed(
          photoUrl,
          html`<img src=${photoUrl} alt="" loading="lazy" @error=${(e: Event) => (e.target as HTMLElement).classList.add("broken")} />`,
        )
      : nothing}
  </span>`;
}

// The people on one interaction as overlapping discs, leftmost on top, with anyone past the
// third collapsed into "+N".
export function avatarStack(people: Person[], size = 42, maxVisible = 3): TemplateResult {
  const shown = people.slice(0, maxVisible);
  const overflow = people.length - shown.length;
  const overlap = Math.round(size / 3);
  return html`<span class="stack" aria-hidden="true">
    ${shown.map(
      (p, i) =>
        html`<span style="margin-left:${i === 0 ? 0 : -overlap}px;z-index:${shown.length - i};display:inline-flex"
          >${avatar(p.name, p.photo_url, size)}</span
        >`,
    )}
    ${overflow > 0
      ? html`<span style="margin-left:${-overlap}px;z-index:${shown.length + 1};display:inline-flex"
          ><span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round((size * 15) / 42)}px;box-shadow:0 0 0 2px var(--surface)"
            >+${overflow}</span
          ></span
        >`
      : nothing}
  </span>`;
}

// Every list of people renders through this row: Search, households, groups. The contact
// status is the snapshot's.
export function personRow(person: Person, subtitle?: string): TemplateResult {
  const status = person.contact_status;
  const sub = subtitle ?? person.how_i_know_them?.trim() ?? "";
  const meta = status.days_since_contact === null ? "—" : `${status.days_since_contact}d ago`;
  return html`<a class="row" href=${href.person(person.id)}>
    ${avatar(person.name, person.photo_url)}
    <span class="main">
      <div class="name">${person.name}${person.favorite ? html`<span class="star">${icons.starFill}</span>` : nothing}</div>
      ${sub ? html`<div class="sub">${sub}</div>` : nothing}
    </span>
    <span class="meta ${status.urgency === "overdue" ? "danger" : ""}">${meta}</span>
  </a>`;
}

export interface TopBarAction {
  icon: TemplateResult;
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function topBarAction(action: TopBarAction): TemplateResult {
  if (action.href) {
    return html`<a
      class="icon-btn ${action.className ?? ""}"
      href=${action.href}
      target=${ifDefined(action.external ? "_blank" : undefined)}
      rel=${ifDefined(action.external ? "noopener noreferrer" : undefined)}
      aria-label=${action.label}
      title=${action.label}
      >${action.icon}</a
    >`;
  }
  return html`<button
    class="icon-btn ${action.className ?? ""}"
    @click=${action.onClick}
    ?disabled=${action.disabled ?? false}
    aria-label=${action.label}
    title=${action.label}
  >
    ${action.icon}
  </button>`;
}

export const label = (text: string) => html`<div class="label list-label">${text}</div>`;
