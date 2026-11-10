import { html, nothing, type TemplateResult } from "lit";
import type { Store } from "../store";

// Screens for before there is data to show: loading, no CRM yet, not loaded, failure.

export function loadingScreen(): TemplateResult {
  return html`<div class="center"><div class="spinner" role="progressbar" aria-label="Loading"></div></div>`;
}

export function createScreen(store: Store): TemplateResult {
  return html`<div class="center">
    <div style="max-width:420px">
      <div class="h-serif" style="font-size:21px;margin-bottom:12px">Start your Hearth</div>
      <p class="muted">Your Hearth is private to you: other people on this Home Assistant get their own.</p>
      <button class="btn" ?disabled=${store.creating} aria-busy=${store.creating ? "true" : "false"} @click=${() => void store.createCrm()}>
        ${store.creating ? "Creating…" : "Create my Hearth"}
      </button>
      ${store.createError ? html`<p class="danger" role="alert">${store.createError}</p>` : nothing}
    </div>
  </div>`;
}

// Hearth keeps retrying behind this screen; the button tries again now.
export function notLoadedScreen(store: Store): TemplateResult {
  return html`<div class="center">
    <div style="max-width:420px">
      <p>Your Hearth didn't load. Check Settings → Devices &amp; services → Hearth.</p>
      ${retryButton(store)}
    </div>
  </div>`;
}

function retryButton(store: Store): TemplateResult {
  return html`<button class="btn" ?disabled=${store.retrying} aria-busy=${store.retrying ? "true" : "false"} @click=${() => void store.retry()}>
    ${store.retrying ? "Retrying…" : "Retry"}
  </button>`;
}

export function errorScreen(store: Store, message: string): TemplateResult {
  return html`<div class="center">
    <div style="max-width:420px">
      <p>${message}</p>
      ${retryButton(store)}
    </div>
  </div>`;
}

// A screen that throws while drawing shows the error rather than leaving the previous screen
// up with no explanation.
export function crashScreen(error: unknown): TemplateResult {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return html`<div class="center">
    <div style="max-width:460px">
      <div class="h-serif" style="font-size:19px;margin-bottom:12px">Hearth hit a problem</div>
      <pre class="mono danger" style="white-space:pre-wrap;font-size:11px;text-align:left">${message}</pre>
      <button class="btn" @click=${() => location.reload()}>Reload</button>
    </div>
  </div>`;
}
