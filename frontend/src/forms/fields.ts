// Form fields that read and write one draft. Each has a label, a `name` (the record's field
// name, which is also what the server's `invalid` errors name) and an error slot under it.
import { html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { HearthError } from "../api";
import type { Store } from "../store";

/** How a field reads its value, writes it back, and finds its error. */
export interface Binding {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  error(name: string): string | null;
}

/** Binds fields to the draft under `key`, with errors from the store's last write. */
export function bindDraft(store: Store, key: string): Binding {
  return {
    get: (name) => (store.drafts.get<Record<string, unknown>>(key) ?? {})[name],
    set: (name, value) => store.drafts.patch<Record<string, unknown>>(key, { [name]: value }),
    error: (name) => fieldError(store.writeError, name),
  };
}

/**
 * The server's message for `name` when the error is about it (or a part of it, like
 * "address.lat"), without the "<field>: " lead-in; otherwise null.
 */
export function fieldError(error: HearthError | null, name: string): string | null {
  const field = error?.field;
  if (!error || !field || (field !== name && !field.startsWith(`${name}.`))) return null;
  const prefix = `${field}: `;
  return error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message;
}

const idFor = (name: string) => `field-${name.replace(/_/g, "-")}`;
const text = (b: Binding, name: string) => {
  const value = b.get(name);
  return typeof value === "string" ? value : "";
};
const inputValue = (e: Event) => (e.target as HTMLInputElement).value;

function errorSlot(b: Binding, name: string): TemplateResult | typeof nothing {
  const message = b.error(name);
  return message
    ? html`<div class="field-error" role="alert" data-error-for=${name}>${message}</div>`
    : nothing;
}

export interface TextOptions {
  type?: "text" | "tel" | "email";
  autocomplete?: string;
  maxlength?: number;
  required?: boolean;
  placeholder?: string;
}

export function textField(b: Binding, name: string, label: string, options: TextOptions = {}): TemplateResult {
  return html`<label class="field">
    <span>${label}</span>
    <input
      id=${idFor(name)}
      name=${name}
      class="input"
      type=${options.type ?? "text"}
      autocomplete=${options.autocomplete ?? "off"}
      maxlength=${options.maxlength ?? 200}
      placeholder=${options.placeholder ?? ""}
      ?required=${options.required ?? false}
      aria-invalid=${b.error(name) ? "true" : "false"}
      .value=${live(text(b, name))}
      @input=${(e: Event) => b.set(name, inputValue(e))}
    />
    ${errorSlot(b, name)}
  </label>`;
}

/** `maxlength` is the server's limit for the field (service.py MAX_TEXT_LENGTHS). */
export function multilineField(b: Binding, name: string, label: string, maxlength: number): TemplateResult {
  return html`<label class="field">
    <span>${label}</span>
    <textarea
      id=${idFor(name)}
      name=${name}
      class="input"
      maxlength=${maxlength}
      aria-invalid=${b.error(name) ? "true" : "false"}
      .value=${live(text(b, name))}
      @input=${(e: Event) => b.set(name, (e.target as HTMLTextAreaElement).value)}
    ></textarea>
    ${errorSlot(b, name)}
  </label>`;
}

/** A web address. Only http and https become links on the person's screen. */
export function urlField(b: Binding, name: string, label: string): TemplateResult {
  return html`<label class="field">
    <span>${label}</span>
    <input
      id=${idFor(name)}
      name=${name}
      class="input"
      type="url"
      inputmode="url"
      autocapitalize="off"
      autocomplete="off"
      maxlength="500"
      placeholder="https://"
      aria-invalid=${b.error(name) ? "true" : "false"}
      .value=${live(text(b, name))}
      @input=${(e: Event) => b.set(name, inputValue(e))}
    />
    ${errorSlot(b, name)}
  </label>`;
}

/** An address or school as free text (`Place.formatted`); the store works out what to send. */
export function placeField(b: Binding, name: string, label: string): TemplateResult {
  return textField(b, name, label, { maxlength: 1000 });
}

/**
 * A date; blank means none. With `yearUnknownName`, a "Year unknown" box shows once a date is
 * set (a birthday whose year isn't known).
 */
export function dateField(b: Binding, name: string, label: string, yearUnknownName?: string): TemplateResult {
  const value = text(b, name);
  return html`<label class="field">
      <span>${label}</span>
      <input
        id=${idFor(name)}
        name=${name}
        class="input"
        type="date"
        aria-invalid=${b.error(name) ? "true" : "false"}
        .value=${live(value)}
        @input=${(e: Event) => {
          const next = inputValue(e);
          b.set(name, next);
          // "Year unknown" hides with the date, so it mustn't stay set behind it.
          if (yearUnknownName && !next) b.set(yearUnknownName, false);
        }}
      />
      ${errorSlot(b, name)}
    </label>
    ${yearUnknownName && value ? toggleField(b, yearUnknownName, "Year unknown") : nothing}`;
}

export function toggleField(b: Binding, name: string, label: string): TemplateResult {
  return html`<label class="check">
      <input
        id=${idFor(name)}
        name=${name}
        type="checkbox"
        .checked=${live(b.get(name) === true)}
        @change=${(e: Event) => b.set(name, (e.target as HTMLInputElement).checked)}
      />
      ${label}
    </label>
    ${errorSlot(b, name)}`;
}

export interface SelectOption {
  value: string;
  label: string;
}

export function selectField(b: Binding, name: string, label: string, options: SelectOption[]): TemplateResult {
  const value = text(b, name);
  return html`<label class="field">
    <span>${label}</span>
    <select
      id=${idFor(name)}
      name=${name}
      class="input"
      aria-invalid=${b.error(name) ? "true" : "false"}
      .value=${live(value)}
      @change=${(e: Event) => b.set(name, (e.target as HTMLSelectElement).value)}
    >
      ${options.map((o) => html`<option value=${o.value} ?selected=${o.value === value}>${o.label}</option>`)}
    </select>
    ${errorSlot(b, name)}
  </label>`;
}
