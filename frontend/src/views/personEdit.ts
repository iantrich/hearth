// Edit a person: every field the server lets the panel change, their household and groups, the
// photo, and deleting them. The form is a draft for /person/<id>/edit, so it survives re-renders
// and snapshot updates, and is dropped on leaving. Save sends only what the user changed since the
// form opened (its base), so a change made elsewhere meanwhile is kept unless the user changed
// that same field (then the last write wins).
import { html, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import { confirmDialog } from "../forms/confirm";
import {
  bindDraft,
  dateField,
  multilineField,
  placeField,
  selectField,
  textField,
  toggleField,
  urlField,
  type Binding,
  type SelectOption,
} from "../forms/fields";
import { photoPicker } from "../forms/photoPicker";
import { compareNames, householdChoiceLabel } from "../logic/names";
import { goBack, href, navigate } from "../router";
import type { Store } from "../store";
import type { Fields } from "../storeWrites";
import type { Person, Snapshot } from "../types";
import { arriving, notFound, snapshotOf, type View } from "./view";

/** The household select's value for "New household…". Record ids are never this. */
const NEW_HOUSEHOLD = "new";

const TEXT_FIELDS = [
  "name", "how_i_know_them", "occupation", "employer", "phone", "phone2", "email", "email2",
  "website", "linkedin", "facebook", "instagram", "notes", "relationship_summary",
] as const;
const FLAGS = ["favorite", "close_friend"] as const;

/** The form's input: text as typed ("" for none), places as their text, and the chosen groups. */
type PersonForm = Record<(typeof TEXT_FIELDS)[number], string> &
  Record<(typeof FLAGS)[number], boolean> & {
    birthday: string;
    birth_year_unknown: boolean;
    address: string;
    school: string;
    /** A household id, "" for none, or NEW_HOUSEHOLD. */
    household_id: string;
    group_ids: string[];
    /** True while Save runs its writes, so a second tap can't start them again. */
    saving: boolean;
  };

const formKey = (id: string) => `edit:person:${id}`;
const confirmKey = (id: string) => `confirm-delete:person:${id}`;

function groupsOf(snapshot: Snapshot, personId: string): string[] {
  return snapshot.groups.filter((g) => g.member_ids.includes(personId)).map((g) => g.id);
}

function initialForm(person: Person, snapshot: Snapshot): PersonForm {
  const text = Object.fromEntries(TEXT_FIELDS.map((name) => [name, person[name] ?? ""])) as Record<(typeof TEXT_FIELDS)[number], string>;
  return {
    ...text,
    favorite: person.favorite,
    close_friend: person.close_friend,
    birthday: person.birthday ?? "",
    birth_year_unknown: person.birth_year_unknown,
    address: person.address?.formatted ?? "",
    school: person.school?.formatted ?? "",
    household_id: person.household_id ?? "",
    group_ids: groupsOf(snapshot, person.id),
    saving: false,
  };
}

/** The person fields Save hands the store, which sends only those that changed. */
function personFields(form: PersonForm, householdId: string | null): Fields {
  const fields: Fields = {};
  for (const name of TEXT_FIELDS) fields[name] = form[name];
  for (const name of FLAGS) fields[name] = form[name];
  fields.birthday = form.birthday;
  // "Year unknown" only means something with a date.
  fields.birth_year_unknown = form.birthday !== "" && form.birth_year_unknown;
  fields.address = form.address;
  fields.school = form.school;
  fields.household_id = householdId;
  return fields;
}

// What the server does when a person is deleted, counted from the snapshot.
function deleteSentence(snapshot: Snapshot, personId: string): string {
  const relationships = snapshot.relationships.filter((r) => r.person_a_id === personId || r.person_b_id === personId).length;
  const memberships = snapshot.groups.filter((g) => g.member_ids.includes(personId)).length;
  const theirs = snapshot.interactions.filter((i) => i.person_ids.includes(personId));
  const solo = theirs.filter((i) => i.person_ids.every((p) => p === personId)).length;
  const shared = theirs.length - solo;
  const reminders = snapshot.reminders.filter((r) => r.person_id === personId).length;
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  return (
    `Also removes ${n(relationships, "relationship", "relationships")} and ${n(memberships, "group membership", "group memberships")}. ` +
    `${n(solo, "interaction with only them is", "interactions with only them are")} deleted; ` +
    `${n(shared, "shared interaction keeps", "shared interactions keep")} the other people.` +
    (reminders ? ` ${n(reminders, "reminder about them is", "reminders about them are")} deleted.` : "")
  );
}

/** "They leave <household>." when the person is in one, which loses a member. */
function householdLine(snapshot: Snapshot, person: Person): string[] {
  const household = person.household_id ? snapshot.households.find((h) => h.id === person.household_id) : undefined;
  return household ? [`They leave ${householdChoiceLabel(household, snapshot.people)}.`] : [];
}

function confirmDelete(store: Store, person: Person): TemplateResult {
  const key = confirmKey(person.id);
  const snapshot = snapshotOf(store);
  return confirmDialog({
    title: `Delete ${person.name}?`,
    lines: [deleteSentence(snapshot, person.id), ...householdLine(snapshot, person), "This can't be undone."],
    confirmLabel: "Delete",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (!(await store.remove("person", person.id))) return;
      store.drafts.drop(key);
      store.drafts.drop(formKey(person.id));
      navigate(href.home(), true);
    },
  });
}

/**
 * Save: a new household first when one was asked for, then the changed person fields in one
 * update, then one set_members per group ticked or unticked since the form opened, each with
 * that group's full new list as the store has it now.
 * Any failure stops there and keeps the form open; a person deleted meanwhile redraws this
 * screen as "no longer exists" (store.save waits for the refetch).
 */
async function saveForm(store: Store, person: Person): Promise<void> {
  const key = formKey(person.id);
  const form = store.drafts.get<PersonForm>(key);
  const base = store.drafts.base<PersonForm>(key);
  if (!form || !base || form.saving || !form.name.trim()) return;
  store.drafts.patch<PersonForm>(key, { saving: true });
  try {
    let householdId: string | null = form.household_id || null;
    if (householdId === NEW_HOUSEHOLD) {
      const created = await store.save("household", null, {});
      if (!created) return;
      householdId = created.id;
      // A failure after this point retries with the household just made, not another one.
      store.drafts.patch<PersonForm>(key, { household_id: householdId });
    }
    const opened = personFields(base, base.household_id || null);
    if (!(await store.save("person", person.id, personFields(form, householdId), opened))) return;

    for (const group of snapshotOf(store).groups) {
      const wants = form.group_ids.includes(group.id);
      // Untouched here: a membership changed elsewhere since the form opened stays as it is.
      if (base.group_ids.includes(group.id) === wants) continue;
      const current = store.groupMembers(group.id);
      if (current.includes(person.id) === wants) continue;
      const members = wants ? [...current, person.id] : current.filter((m) => m !== person.id);
      if (!(await store.setGroupMembers(group.id, members))) return;
    }
    store.drafts.drop(key);
    goBack(href.person(person.id));
  } finally {
    store.drafts.patch<PersonForm>(key, { saving: false });
  }
}

const section = (title: string, body: TemplateResult) =>
  html`<div class="label form-section">${title}</div>
    ${body}`;

function householdOptions(snapshot: Snapshot, current: string): SelectOption[] {
  const households = snapshot.households
    .map((h) => ({ value: h.id, label: householdChoiceLabel(h, snapshot.people) }))
    .sort((a, b) => compareNames(a.label, b.label));
  // One just made by a save that then failed, before the snapshot has it.
  if (current && current !== NEW_HOUSEHOLD && !households.some((h) => h.value === current))
    households.push({ value: current, label: "New household" });
  return [{ value: "", label: "None" }, ...households, { value: NEW_HOUSEHOLD, label: "New household…" }];
}

function groupChoices(store: Store, key: string, snapshot: Snapshot, chosen: string[]): TemplateResult {
  if (!snapshot.groups.length) return html`<div class="muted" style="font-size:12.5px">No groups yet.</div>`;
  const groups = [...snapshot.groups].sort((a, b) => compareNames(a.name, b.name));
  const toggle = (groupId: string, on: boolean) => {
    const current = store.drafts.get<PersonForm>(key)?.group_ids ?? [];
    const next = on ? [...current.filter((g) => g !== groupId), groupId] : current.filter((g) => g !== groupId);
    store.drafts.patch<PersonForm>(key, { group_ids: next });
  };
  return html`<div role="group" aria-label="Groups">
    ${groups.map(
      (g) => html`<label class="check">
        <input
          type="checkbox"
          data-group=${g.id}
          .checked=${live(chosen.includes(g.id))}
          @change=${(e: Event) => toggle(g.id, (e.target as HTMLInputElement).checked)}
        />
        ${g.name}
      </label>`,
    )}
  </div>`;
}

export function personEditView(store: Store, id: string): View {
  const snapshot = snapshotOf(store);
  const person = snapshot.people.find((p) => p.id === id);
  if (!person) return store.isArriving(id) ? arriving : notFound("person");

  const key = formKey(id);
  const path = href.editPerson(id);
  const form = store.drafts.open<PersonForm>(key, path, () => initialForm(person, snapshot));
  const nameMissing = !form.name.trim();
  const draft = bindDraft(store, key);
  // The name's own check comes before the server's errors.
  const b: Binding = { ...draft, error: (name) => (name === "name" && nameMissing ? "Enter a name." : draft.error(name)) };
  const disabled = nameMissing || form.saving || store.busy;

  return {
    title: "Edit person",
    back: true,
    actions: [],
    body: html`<div class="page form">
      ${section("Photo", photoPicker(store, { kind: "person", id, name: person.name, photoUrl: person.photo_url }))}
      ${section(
        "Basics",
        html`${textField(b, "name", "Name", { required: true, maxlength: 200 })}
        ${textField(b, "how_i_know_them", "How I know them", { maxlength: 2000 })}
        ${textField(b, "occupation", "Occupation", { maxlength: 300 })} ${textField(b, "employer", "Employer", { maxlength: 300 })}`,
      )}
      ${section(
        "Contact",
        html`${textField(b, "phone", "Phone", { type: "tel", autocomplete: "tel", maxlength: 50 })}
        ${textField(b, "phone2", "Phone 2", { type: "tel", maxlength: 50 })}
        ${textField(b, "email", "Email", { type: "email", autocomplete: "email", maxlength: 500 })}
        ${textField(b, "email2", "Email 2", { type: "email", maxlength: 500 })}`,
      )}
      ${section("Dates", dateField(b, "birthday", "Birthday", "birth_year_unknown"))}
      ${section(
        "Flags",
        html`${toggleField(b, "favorite", "Favorite")} ${toggleField(b, "close_friend", "Close friend")}`,
      )}
      ${section("Places", html`${placeField(b, "address", "Address")} ${placeField(b, "school", "School")}`)}
      ${section(
        "Links",
        html`${urlField(b, "website", "Website")} ${urlField(b, "linkedin", "LinkedIn")} ${urlField(b, "facebook", "Facebook")}
        ${urlField(b, "instagram", "Instagram")}`,
      )}
      ${section(
        "Notes and summary",
        html`${multilineField(b, "notes", "Notes", 20_000)} ${multilineField(b, "relationship_summary", "Relationship summary", 20_000)}`,
      )}
      ${section("Household", selectField(b, "household_id", "Household", householdOptions(snapshot, form.household_id)))}
      ${section("Groups", groupChoices(store, key, snapshot, form.group_ids))}
      <button class="btn" ?disabled=${disabled} @click=${() => void saveForm(store, person)}>Save</button>
      <button
        class="btn danger"
        style="margin-top:24px"
        ?disabled=${store.busy}
        @click=${() => store.drafts.put(confirmKey(id), path, {})}
      >
        Delete person
      </button>
    </div>`,
    overlay: store.drafts.get(confirmKey(id)) ? confirmDelete(store, person) : undefined,
  };
}
