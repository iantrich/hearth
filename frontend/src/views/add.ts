import { html, nothing } from "lit";
import { live } from "lit/directives/live.js";
import { href, navigate } from "../router";
import type { Store } from "../store";
import type { View } from "./view";

/** The add person form's input. */
interface AddForm {
  name: string;
  phone: string;
  email: string;
  how_i_know_them: string;
  has_birthday: boolean;
  birthday: string;
  birth_year_unknown: boolean;
}

const emptyAddForm = (): AddForm => ({
  name: "",
  phone: "",
  email: "",
  how_i_know_them: "",
  has_birthday: false,
  birthday: "",
  birth_year_unknown: false,
});

/** The server's limits for these fields (service.py MAX_TEXT_LENGTHS). */
const MAX_LENGTHS = { name: 200, phone: 50, email: 500, how_i_know_them: 2000 } as const;

const orNull = (text: string) => text.trim() || null;
const KEY = "add-person";

export function addView(store: Store): View {
  // A draft for /add: leaving the tab (or saving, which opens the new person) clears it.
  const form = store.drafts.open<AddForm>(KEY, href.add(), emptyAddForm);
  const set = (patch: Partial<AddForm>) => store.drafts.patch<AddForm>(KEY, patch);
  const valid = form.name.trim() !== "" && (!form.has_birthday || form.birthday !== "");
  const text = (key: "name" | "phone" | "email" | "how_i_know_them", label: string, type = "text", autocomplete = "off") =>
    html`<label class="field">
      <span>${label}</span>
      <input
        id=${`add-${key.replace(/_/g, "-")}`}
        class="input"
        type=${type}
        autocomplete=${autocomplete}
        maxlength=${MAX_LENGTHS[key]}
        .value=${live(form[key])}
        @input=${(e: InputEvent) => set({ [key]: (e.target as HTMLInputElement).value })}
      />
    </label>`;

  // The store leaves blank fields out.
  const save = async () => {
    if (!valid) return;
    const id = await store.addPerson({
      name: form.name,
      phone: orNull(form.phone),
      email: orNull(form.email),
      how_i_know_them: orNull(form.how_i_know_them),
      birthday: form.has_birthday ? form.birthday : null,
      birth_year_unknown: form.has_birthday && form.birth_year_unknown,
    });
    if (id) navigate(href.person(id));
  };

  return {
    title: "Add person",
    back: false,
    actions: [],
    body: html`<div class="page form">
      ${text("name", "Name")} ${text("phone", "Phone", "tel", "tel")} ${text("email", "Email", "email", "email")}
      ${text("how_i_know_them", "How I know them")}
      <label class="check">
        <input type="checkbox" .checked=${live(form.has_birthday)} @change=${(e: Event) => set({ has_birthday: (e.target as HTMLInputElement).checked })} />
        Has a known birthday
      </label>
      ${form.has_birthday
        ? html`<label class="field">
              <span>Birthday</span>
              <input id="add-birthday" class="input" type="date" .value=${live(form.birthday)}
                @input=${(e: InputEvent) => set({ birthday: (e.target as HTMLInputElement).value })} />
            </label>
            <label class="check">
              <input
                type="checkbox"
                .checked=${live(form.birth_year_unknown)}
                @change=${(e: Event) => set({ birth_year_unknown: (e.target as HTMLInputElement).checked })}
              />
              Year unknown
            </label>`
        : nothing}
      <button class="btn" ?disabled=${!valid || store.busy} @click=${save}>Save</button>
    </div>`,
  };
}
