// Add, change or remove one relationship, as a sheet over a person's screen. It reads from that
// person's side: "[other person] is [Viewer]'s [type]". Saving always writes the viewer as A and
// the other person as B with the chosen type, so editing a link from its B side needs no inverse
// table here: the swap and the type are sent together. The form is a draft for the sheet's path.
import { html, nothing, type TemplateResult } from "lit";
import { confirmDialog } from "../forms/confirm";
import { bindDraft, multilineField, selectField, type SelectOption } from "../forms/fields";
import { personPicker } from "../forms/personPicker";
import { nameOnly } from "../logic/newPerson";
import { connectionTo } from "../logic/personConnections";
import { firstName } from "../logic/names";
import { goBack, href } from "../router";
import type { Store } from "../store";
import type { Person, Relationship } from "../types";
import { personView } from "./person";
import { snapshotOf, type View } from "./view";

interface RelationshipForm {
  /** The other person's id, "" until chosen. */
  other: string;
  type: string;
  notes: string;
}

const formKey = (personId: string, relId: string | null) => `edit:relationship:${personId}:${relId ?? "new"}`;
const confirmKey = (relId: string) => `confirm-delete:relationship:${relId}`;

/** The sheet over `personId`'s screen; `relId` is null when adding. */
export function relationshipView(store: Store, personId: string, relId: string | null): View {
  const base = personView(store, personId, null);
  const snapshot = snapshotOf(store);
  const viewer = snapshot.people.find((p) => p.id === personId);
  // The person is gone (or still arriving): their screen says so, with no sheet over it.
  if (!viewer) return base;
  let existing: Relationship | undefined;
  let end: { otherId: string; type: string } | null = null;
  if (relId !== null) {
    existing = snapshot.relationships.find((r) => r.id === relId);
    end = existing ? connectionTo(existing, personId) : null;
    // Deleted elsewhere (Claude, another tab, an import): the person's screen, with no sheet.
    if (!existing || !end) return base;
  }
  return { ...base, overlay: sheet(store, viewer, existing ?? null, end) };
}

function sheet(store: Store, viewer: Person, existing: Relationship | null, end: { otherId: string; type: string } | null): TemplateResult {
  const snapshot = snapshotOf(store);
  const relId = existing?.id ?? null;
  const key = formKey(viewer.id, relId);
  const path = existing ? href.relationship(viewer.id, existing.id) : href.newRelationship(viewer.id);
  const form = store.drafts.open<RelationshipForm>(key, path, () => ({
    other: end?.otherId ?? "",
    type: end?.type ?? "",
    notes: existing?.notes ?? "",
  }));
  const other = snapshot.people.find((p) => p.id === form.other);

  // Someone already linked to the viewer can't be picked again, apart from the person this link is with.
  const linked = snapshot.relationships.flatMap((r) => {
    const e = connectionTo(r, viewer.id);
    return e && e.otherId !== end?.otherId ? [e.otherId] : [];
  });
  const typeOptions: SelectOption[] = [{ value: "", label: "Choose…" }, ...snapshot.connection_types.map((t) => ({ value: t, label: t }))];
  // A type the list no longer offers still shows, so opening a link doesn't blank it.
  if (form.type && !snapshot.connection_types.includes(form.type)) typeOptions.push({ value: form.type, label: form.type });

  const done = () => {
    store.drafts.drop(key);
    goBack(href.person(viewer.id));
  };
  const valid = !!other && form.type !== "";
  const save = async () => {
    const current = store.drafts.get<RelationshipForm>(key);
    const base = store.drafts.base<RelationshipForm>(key);
    if (!current || !base || !current.other || !current.type) return;
    // Only what changed since the sheet opened is sent. The link (who and which type) goes as one:
    // when either changed, both ends and the type are sent, so its meaning is the one chosen here.
    const linkChanged = current.other !== base.other || current.type !== base.type;
    const link = { person_a_id: viewer.id, person_b_id: current.other, type: current.type };
    const saved = await store.save(
      "relationship",
      relId,
      { ...link, notes: current.notes },
      linkChanged ? { notes: base.notes } : { ...link, notes: base.notes },
    );
    // A relationship deleted meanwhile has had the deleted toast; the sheet closes to the person.
    if (saved || (relId && !snapshotOf(store).relationships.some((r) => r.id === relId))) done();
  };

  const b = bindDraft(store, key);
  const name = firstName(viewer.name);
  return html`<div class="sheet-backdrop" @click=${(e: Event) => e.target === e.currentTarget && done()}>
    <div class="sheet" role="dialog" aria-label=${existing ? "Edit relationship" : "Add relationship"}>
      <div class="topbar">
        <button class="icon-btn" style="padding:0 12px" @click=${done}>Cancel</button>
        <span class="title" style="text-align:center">${existing ? "Relationship" : "Add relationship"}</span>
        <button class="icon-btn accent" style="padding:0 12px;font-weight:600" ?disabled=${!valid || store.busy} @click=${save}>
          Save
        </button>
      </div>
      <div class="sheet-body">
        <div class="form">
          ${personPicker(store, {
            id: "relationship-person",
            label: "Person",
            path,
            exclude: [viewer.id, ...linked],
            selected: other ? [other.id] : [],
            onPick: (id) => store.drafts.patch<RelationshipForm>(key, { other: id }),
            onRemove: () => store.drafts.patch<RelationshipForm>(key, { other: "" }),
            // Just a name: the rest can be filled in from their own screen later.
            onCreate: async (newName) => {
              const id = await store.addPerson(nameOnly(newName));
              if (id) store.drafts.patch<RelationshipForm>(key, { other: id });
            },
            disabled: store.busy,
          })}
          <div class="muted" style="font-size:12.5px">${other ? other.name : "Someone"} is ${name}'s</div>
          ${selectField(b, "type", "Type", typeOptions)} ${multilineField(b, "notes", "Notes", 20_000)}
          ${existing
            ? html`<button
                class="btn danger"
                style="margin-top:12px"
                ?disabled=${store.busy}
                @click=${() => store.drafts.put(confirmKey(existing.id), path, {})}
              >
                Remove relationship
              </button>`
            : nothing}
        </div>
      </div>
    </div>
  </div>
  ${existing && store.drafts.get(confirmKey(existing.id)) ? confirmRemove(store, viewer, snapshot.people.find((p) => p.id === end?.otherId), existing, done) : nothing}`;
}

function confirmRemove(store: Store, viewer: Person, other: Person | undefined, existing: Relationship, done: () => void): TemplateResult {
  const key = confirmKey(existing.id);
  const otherName = other?.name ?? "them";
  return confirmDialog({
    title: `Remove the link between ${viewer.name} and ${otherName}?`,
    lines: ["Both people stay in Hearth. Only this relationship is removed. This can't be undone."],
    confirmLabel: "Remove",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (!(await store.remove("relationship", existing.id))) return;
      store.drafts.drop(key);
      done();
    },
  });
}
