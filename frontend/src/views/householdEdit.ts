// Create and edit a household. The name, address, notes and photo are a form saved with Save.
// Members are not: adding or removing one is an immediate update of that person's household_id,
// so Python's generated name and status (shown at the top) follow from the snapshot as you go.
// Hearth never dissolves a household on its own; only the user's confirmed delete does.
import { html, nothing, type TemplateResult } from "lit";
import { confirmDialog } from "../forms/confirm";
import { bindDraft, multilineField, placeField, textField, type Binding } from "../forms/fields";
import { personPicker } from "../forms/personPicker";
import { photoPicker } from "../forms/photoPicker";
import { sortHousehold } from "../logic/householdOrder";
import { memberRoster } from "../logic/memberRoster";
import { householdChoiceLabel, householdIsNamed, householdTitle } from "../logic/names";
import { goBack, href, navigate } from "../router";
import type { Store } from "../store";
import type { Household, Person } from "../types";
import { arriving, notFound, snapshotOf, type View } from "./view";

const OVERRIDE_LABEL = "Name (leave blank to use the generated name)";

/** The form's input as typed: "" for none. */
interface HouseholdForm {
  name_override: string;
  address: string;
  notes: string;
}

const formKey = (id: string) => `edit:household:${id}`;
const NEW_KEY = "edit:household:new";
const deleteKey = (id: string) => `confirm-delete:household:${id}`;
const dissolveKey = (id: string) => `confirm-dissolve:household:${id}`;
const moveKey = (id: string) => `confirm-move:household:${id}`;

const section = (title: string, body: TemplateResult) =>
  html`<div class="label form-section">${title}</div>
    ${body}`;

const fieldsOf = (form: HouseholdForm) => ({ name_override: form.name_override, address: form.address, notes: form.notes });

function formFields(b: Binding, highlightName: boolean): TemplateResult {
  const name = textField(b, "name_override", OVERRIDE_LABEL, { maxlength: 200 });
  return html`${highlightName ? html`<div class="highlight">${name}</div>` : name} ${placeField(b, "address", "Address")}
  ${multilineField(b, "notes", "Notes", 20_000)}`;
}

/** /household/new: creates the household, then opens its edit screen to add members. */
export function householdNewView(store: Store): View {
  const path = href.newHousehold();
  store.drafts.open<HouseholdForm>(NEW_KEY, path, () => ({ name_override: "", address: "", notes: "" }));
  const create = async () => {
    const form = store.drafts.get<HouseholdForm>(NEW_KEY);
    if (!form) return;
    const created = await store.save("household", null, fieldsOf(form));
    if (!created) return;
    store.drafts.drop(NEW_KEY);
    navigate(href.editHousehold(created.id), true);
  };
  return {
    title: "New household",
    back: true,
    actions: [],
    body: html`<div class="page form">
      ${formFields(bindDraft(store, NEW_KEY), false)}
      <button class="btn" ?disabled=${store.busy} @click=${create}>Create household</button>
    </div>`,
  };
}

/** Python's name and what its status means, at the top of the edit screen. */
function statusHeader(store: Store, household: Household): TemplateResult {
  const path = href.editHousehold(household.id);
  let note: TemplateResult | typeof nothing = nothing;
  switch (household.name_status) {
    case "generated":
      note = html`<div class="muted" style="font-size:12.5px">Named from its members.</div>`;
      break;
    case "override":
      note = html`<div class="muted" style="font-size:12.5px">The name you gave it.</div>`;
      break;
    case "needs_name":
      note = html`<div class="warning household-status" style="font-size:12.5px">This household needs a name</div>`;
      break;
    case "not_a_household":
      note = html`<div class="warning household-status" style="font-size:12.5px">
          This isn't a household any more (one adult, no children)
        </div>
        <button
          class="btn secondary"
          style="justify-self:start"
          ?disabled=${store.busy}
          @click=${() => store.drafts.put(dissolveKey(household.id), path, {})}
        >
          Dissolve household
        </button>`;
      break;
  }
  return html`<div style="display:grid;gap:6px">
    <div class="h-serif members-title ${householdIsNamed(household) ? "" : "muted"}" style="font-size:21px">${householdTitle(household)}</div>
    ${note}
  </div>`;
}

const setHousehold = (store: Store, personId: string, householdId: string | null) =>
  store.save("person", personId, { household_id: householdId });

function members(store: Store, household: Household): TemplateResult {
  const { people, relationships } = snapshotOf(store);
  const roster = sortHousehold(memberRoster(household.member_ids, people), household.member_ids, relationships, (p) => p);
  const path = href.editHousehold(household.id);
  const pick = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    // Someone in another household is moved only once the user says so.
    if (person?.household_id && person.household_id !== household.id) {
      store.drafts.put(moveKey(household.id), path, { personId });
      return;
    }
    void setHousehold(store, personId, household.id);
  };
  return personPicker(store, {
    id: "household-members",
    label: "Add a member",
    path,
    selected: roster.map((p) => p.id),
    onPick: pick,
    onRemove: (personId) => void setHousehold(store, personId, null),
    disabled: store.busy,
  });
}

function confirmMove(store: Store, household: Household, person: Person): TemplateResult {
  const key = moveKey(household.id);
  const snapshot = snapshotOf(store);
  const other = snapshot.households.find((h) => h.id === person.household_id);
  const from = other ? householdChoiceLabel(other, snapshot.people) : "their household";
  return confirmDialog({
    title: `Move ${person.name} from ${from} to this household?`,
    lines: ["A person can only be in one household."],
    confirmLabel: "Move",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (!(await setHousehold(store, person.id, household.id))) return;
      store.drafts.drop(key);
    },
  });
}

const stayLine = (count: number) =>
  `${count} ${count === 1 ? "person stays" : "people stay"}; they just won't have a household.`;

function afterDelete(store: Store, id: string): void {
  for (const key of [formKey(id), deleteKey(id), dissolveKey(id), moveKey(id)]) store.drafts.drop(key);
  store.setSearch({ chip: "households" });
  navigate(href.search(), true);
}

function confirmDelete(store: Store, household: Household): TemplateResult {
  const key = deleteKey(household.id);
  return confirmDialog({
    title: `Delete ${householdTitle(household)}?`,
    lines: [stayLine(household.member_ids.length), "This can't be undone."],
    confirmLabel: "Delete household",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (await store.remove("household", household.id)) afterDelete(store, household.id);
    },
  });
}

function confirmDissolve(store: Store, household: Household): TemplateResult {
  const key = dissolveKey(household.id);
  return confirmDialog({
    title: "Dissolve this household?",
    lines: ["Members stay; they just won't have a household."],
    confirmLabel: "Dissolve household",
    busy: store.busy,
    onCancel: () => store.drafts.drop(key),
    onConfirm: async () => {
      if (await store.remove("household", household.id)) afterDelete(store, household.id);
    },
  });
}

function overlay(store: Store, household: Household): TemplateResult | undefined {
  const id = household.id;
  if (store.drafts.get(deleteKey(id))) return confirmDelete(store, household);
  if (store.drafts.get(dissolveKey(id))) return confirmDissolve(store, household);
  const move = store.drafts.get<{ personId: string }>(moveKey(id));
  const person = move && snapshotOf(store).people.find((p) => p.id === move.personId);
  return person ? confirmMove(store, household, person) : undefined;
}

export function householdEditView(store: Store, id: string): View {
  const household = snapshotOf(store).households.find((h) => h.id === id);
  if (!household) return store.isArriving(id) ? arriving : notFound("household");

  const key = formKey(id);
  const path = href.editHousehold(id);
  store.drafts.open<HouseholdForm>(key, path, () => ({
    name_override: household.name_override ?? "",
    address: household.address?.formatted ?? "",
    notes: household.notes ?? "",
  }));
  const save = async () => {
    const form = store.drafts.get<HouseholdForm>(key);
    const base = store.drafts.base<HouseholdForm>(key);
    if (!form || !base) return;
    // A blank override is sent as null, so Python's generated name comes back. Only what changed
    // since the form opened is sent.
    if (!(await store.save("household", id, fieldsOf(form), fieldsOf(base)))) return;
    store.drafts.drop(key);
    goBack(href.household(id));
  };

  return {
    title: "Edit household",
    back: true,
    actions: [],
    body: html`<div class="page form">
      ${statusHeader(store, household)}
      ${section("Photo", photoPicker(store, { kind: "household", id, name: householdTitle(household), photoUrl: household.photo_url }))}
      ${section("Details", formFields(bindDraft(store, key), household.name_status === "needs_name"))}
      <button class="btn" ?disabled=${store.busy} @click=${save}>Save</button>
      ${section("Members", members(store, household))}
      <button class="btn danger" style="margin-top:24px" ?disabled=${store.busy} @click=${() => store.drafts.put(deleteKey(id), path, {})}>
        Delete household
      </button>
    </div>`,
    overlay: overlay(store, household),
  };
}
