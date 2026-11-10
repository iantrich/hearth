// Choosing a photo. The panel shrinks it before uploading, to at most 1024 px on its long side
// as JPEG quality 0.85, so it fits well under the server's cap. Anything the browser can decode
// is accepted (iPhone Safari hands over HEIC as JPEG); the server still checks and re-encodes.
import { html, nothing, type TemplateResult } from "lit";
import { avatar } from "../components";
import type { Store } from "../store";
import type { PhotoKind } from "../types";

export const PHOTO_UNUSABLE = "That file isn't a photo Hearth can use.";
/** The server refuses photo data longer than this many base64 characters. */
const MAX_DATA_CHARS = 4_000_000;

/** The file couldn't be turned into a photo: not an image, or one the browser can't decode. */
export class PhotoUnusable extends Error {
  constructor(message = PHOTO_UNUSABLE) {
    super(message);
    this.name = "PhotoUnusable";
  }
}

/** A decoded image: an ImageBitmap in the browser. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  close?(): void;
}

/** Decoding and JPEG encoding, injectable because tests have no real canvas. */
export interface ImageCodec {
  decode(file: Blob): Promise<DecodedImage>;
  encode(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob>;
}

export const browserCodec: ImageCodec = {
  decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
  async encode(image, width, height, quality) {
    const source = image as ImageBitmap;
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(width, height);
      draw(canvas.getContext("2d"), source, width, height);
      return canvas.convertToBlob({ type: "image/jpeg", quality });
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext("2d"), source, width, height);
    return new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encoding failed"))), "image/jpeg", quality),
    );
  },
};

function draw(
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null,
  source: ImageBitmap,
  width: number,
  height: number,
): void {
  if (!ctx) throw new Error("no 2d canvas");
  // JPEG has no transparency: a transparent PNG gets a white background rather than black.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

/**
 * The image as base64 JPEG (no data: prefix), scaled down so its long side is at most `maxSide`
 * (never enlarged). Throws PhotoUnusable when the file can't be decoded or encoded.
 */
export async function shrinkImage(file: Blob, maxSide = 1024, quality = 0.85, codec: ImageCodec = browserCodec): Promise<string> {
  let image: DecodedImage;
  try {
    image = await codec.decode(file);
  } catch {
    throw new PhotoUnusable();
  }
  try {
    const { width, height } = image;
    if (!(width > 0 && height > 0)) throw new PhotoUnusable();
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    let blob: Blob;
    try {
      blob = await codec.encode(image, w, h, quality);
    } catch {
      throw new PhotoUnusable();
    }
    let data: string;
    try {
      data = toBase64(new Uint8Array(await blob.arrayBuffer()));
    } catch {
      throw new PhotoUnusable();
    }
    if (data.length > MAX_DATA_CHARS) throw new PhotoUnusable();
    return data;
  } finally {
    image.close?.();
  }
}

/**
 * Shrinks the chosen file and uploads it as the record's photo. A file that isn't a usable photo
 * (or any other failure while shrinking) shows PHOTO_UNUSABLE and sends nothing. While it shrinks,
 * `store.shrinkingPhoto` is true and the pickers are disabled; a second pick then is ignored.
 */
export async function pickPhoto(store: Store, kind: PhotoKind, id: string, file: Blob, codec: ImageCodec = browserCodec): Promise<boolean> {
  if (store.shrinkingPhoto) return false;
  let data: string;
  store.setShrinkingPhoto(true);
  try {
    data = await shrinkImage(file, 1024, 0.85, codec);
  } catch {
    store.showToast(PHOTO_UNUSABLE);
    return false;
  } finally {
    store.setShrinkingPhoto(false);
  }
  return store.setPhoto(kind, id, data);
}

export interface PhotoPickerOptions {
  kind: PhotoKind;
  id: string;
  /** For the initials when there's no photo. */
  name: string;
  photoUrl: string | null;
}

/** The hidden file input inside a picker's label: choosing a file uploads it at once. */
function fileInput(store: Store, kind: PhotoKind, id: string, disabled: boolean): TemplateResult {
  const chosen = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    input.value = "";
    if (file) void pickPhoto(store, kind, id, file);
  };
  return html`<input class="file-input" type="file" accept="image/*" ?disabled=${disabled} @change=${chosen} />`;
}

const pickerDisabled = (store: Store) => store.busy || store.shrinkingPhoto;

/** The record's photo with Change and Remove. Each is saved at once, not with the form. */
export function photoPicker(store: Store, options: PhotoPickerOptions): TemplateResult {
  const { kind, id, name, photoUrl } = options;
  const disabled = pickerDisabled(store);
  return html`<div class="photo-picker">
    ${avatar(name, photoUrl, 76)}
    <div class="actions">
      <label class="btn secondary file-btn" aria-disabled=${disabled ? "true" : "false"}>
        ${store.shrinkingPhoto ? "Preparing photo…" : photoUrl ? "Change photo" : "Add photo"} ${fileInput(store, kind, id, disabled)}
      </label>
      ${photoUrl
        ? html`<button class="btn secondary" ?disabled=${disabled} @click=${() => void store.clearPhoto(kind, id)}>Remove photo</button>`
        : nothing}
    </div>
  </div>`;
}

/** The photo itself as the button: tapping it picks a new one, saved at once. */
export function photoTap(store: Store, options: PhotoPickerOptions, size = 76): TemplateResult {
  const { kind, id, name, photoUrl } = options;
  const disabled = pickerDisabled(store);
  const label = photoUrl ? "Change photo" : "Add photo";
  return html`<label class="file-btn photo-tap" aria-label=${label} title=${label} aria-disabled=${disabled ? "true" : "false"}>
    ${avatar(name, photoUrl, size)} ${fileInput(store, kind, id, disabled)}
  </label>`;
}
