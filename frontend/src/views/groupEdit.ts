// Create and edit a group. The name, description and photo are a form saved with Save. Members
// change at once, each through group/set_members with the group's full new list.
import { html, type TemplateResult } from "lit";
import { confirmDialog } from "../forms/confirm";
import { bindDraft, multilineField, textField, type Binding } from "../forms/fields";
import { personPicker } from "../forms/personPicker";
import { photoPicker } from "../forms/photoPicker";
import { memberRoster } from "../logic/memberRoster";
import { goBack, href, navigate } from "../router";
import type { Store } from "../store";
import type { ContactGroup } from "../types";
import { arriving, notFound, snapshotOf, type View } from "./view";

interface GroupForm {
  name: string;
  description: string;
}

const formKey = (id: string) => `edit:group:${id}`;
const NEW_KEY = "edit:group:new";
const deleteKey = (id: string) => `confirm-delete:group:${id}`;

const section = (title: string, body: TemplateResult) =>
  html`<div class="label form-section">${title}</div>
    ${body}`;

/** The name and description, with the name's own check before the server's errors. */
function formFields(store: Store, key: string, nameMissing: boolean): TemplateResult {
  const draft = bindDraft(store, key);
  const b: Binding = { ...draft, error: (name) => (name === "name" && nameMissing ? "Enter a name." : draft.error(name)) };
  return html`${textField(b, "name", "Name", { required: true, maxlength: 200 })}
  ${multilineField(b, "description", "Description", 20_000)}`;
}

/** /group/new: creates the group, then opens its edit screen to add members. */
export function groupNewView(store: Store): View {
  const form = store.drafts.open<GroupForm>(NEW_KEY, href.newGroup(), () => ({ name: "", description: "" }));
  const nameMissing = !form.name.trim();
  const create = async () => {
    const current = store.drafts.get<GroupForm>(NEW_KEY);
    if (!current || !current.name.trim()) return;
    const created = await store.save("contact_group", null, { ...current });
    if (!created) return;
    store.drafts.drop(NEW_KEY);
    navigate(href.editGroup(created.id), true);
  };
  return {
    title: "New group",
    back: true,
    actions: [],
    body: html`<div class="page form">
      ${formFields(store, NEW_KEY, nameMissing)}
      <button class="btn" ?disabled=${nameMissing || store.busy} @click=${create}>Create group</button>
    </div>`,
  };
}

function members(store: Store, group: ContactGroup): TemplateResult {
  const roster = memberRoster(group.member_ids, snapshotOf(store).people);
  return personPicker(store, {
    id: "group-members",
    label: "Add a member",
    path: href.editGroup(group.id),
    selected: roster.map((p) => p.id),
    // Built from store.groupMembers, so a change made before the last one reaches the snapshot isn't undone.
    onPick: (personId) => void store.setGroupMembers(group.id, [...store.groupMembers(group.id).filter((m) => m !== personId), personId]),
    onRemove: (personId) => void store.setGroupMembers(group.id, store.groupMembers(group.id).filter((m) => m !== personId)),
    disabled: store.busy,
  });
}

function confirmDelete(store: Store, group: ContactGroup): TemplateResult {
  const key = deleteKey(group.id);
  const count = group.member_ids.length;
  return confirmDialog({
    title: `Delete ${group.name}?`,
    lines: [`${count} ${count === 1 ? "person stays" : "people stay"}; they just leave this group.`, "This can't be undone."],
    confirmLabel: "Delete group",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (!(await store.remove("contact_group", group.id))) return;
      store.drafts.drop(key);
      store.drafts.drop(formKey(group.id));
      store.setSearch({ chip: "groups" });
      navigate(href.search(), true);
    },
  });
}

export function groupEditView(store: Store, id: string): View {
  const group = snapshotOf(store).groups.find((g) => g.id === id);
  if (!group) return store.isArriving(id) ? arriving : notFound("group");

  const key = formKey(id);
  const path = href.editGroup(id);
  const form = store.drafts.open<GroupForm>(key, path, () => ({ name: group.name, description: group.description ?? "" }));
  const nameMissing = !form.name.trim();
  const save = async () => {
    const current = store.drafts.get<GroupForm>(key);
    const base = store.drafts.base<GroupForm>(key);
    if (!current || !base || !current.name.trim()) return;
    // Only what changed since the form opened is sent.
    if (!(await store.save("contact_group", id, { ...current }, { ...base }))) return;
    store.drafts.drop(key);
    goBack(href.group(id));
  };

  return {
    title: "Edit group",
    back: true,
    actions: [],
    body: html`<div class="page form">
      ${section("Photo", photoPicker(store, { kind: "contact_group", id, name: group.name, photoUrl: group.photo_url }))}
      ${section("Details", formFields(store, key, nameMissing))}
      <button class="btn" ?disabled=${nameMissing || store.busy} @click=${save}>Save</button>
      ${section("Members", members(store, group))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${store.busy} @click=${() => store.drafts.put(deleteKey(id), path, {})}>
        Delete group
      </button>
    </div>`,
    overlay: store.drafts.get(deleteKey(id)) ? confirmDelete(store, group) : undefined,
  };
}
