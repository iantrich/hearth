import { html, type TemplateResult } from "lit";

export interface ConfirmOptions {
  title: string;
  /** What happens, one paragraph each. Deletes say exactly what goes with the record. */
  lines: string[];
  /** The destructive button, for example "Delete group". */
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** True while a write is in flight: the destructive button is disabled. */
  busy?: boolean;
}

/** A centred confirmation over the screen. Whether it's open is the caller's draft. */
export function confirmDialog(options: ConfirmOptions): TemplateResult {
  return html`<div class="sheet-backdrop" style="align-items:center">
    <div class="dialog" role="alertdialog" aria-label=${options.title}>
      <div class="h-serif" style="font-size:17px">${options.title}</div>
      ${options.lines.map((line) => html`<div class="muted" style="font-size:12.5px">${line}</div>`)}
      <div class="actions">
        <button class="btn secondary" @click=${options.onCancel}>Cancel</button>
        <button class="btn danger" ?disabled=${options.busy ?? false} @click=${options.onConfirm}>${options.confirmLabel}</button>
      </div>
    </div>
  </div>`;
}
