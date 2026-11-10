// Unsaved form input and open dialogs, keyed by form. Each draft belongs to the path of the
// screen it was opened on: it is kept while the route is on that path (or under it), and dropped
// as soon as the route leaves, so coming back starts fresh from the snapshot.
//
// A draft also keeps its base: the values it opened with. Saving sends only what differs from the
// base, so a change made elsewhere while the form was open (by Claude, another tab or an import)
// isn't reverted by a field the user never touched.

interface Entry {
  path: string;
  value: object;
  base: object;
}

const trimSlash = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** True when `path` is `formPath` or a path under it. */
function isOn(path: string, formPath: string): boolean {
  const here = trimSlash(path);
  const form = trimSlash(formPath);
  return here === form || here.startsWith(`${form}/`);
}

export class Drafts {
  private entries = new Map<string, Entry>();

  /** `onChange` is called after every change made by a user action (put, patch, drop). */
  constructor(private onChange: () => void = () => {}) {}

  /**
   * The draft under `key`, started from `init()` when there is none. Screens call this while
   * drawing, so it doesn't call onChange. `path` is the form's path (an `href.*` value).
   */
  open<T extends object>(key: string, path: string, init: () => T): T {
    const existing = this.entries.get(key);
    if (existing) return existing.value as T;
    const value = init();
    this.entries.set(key, { path, value, base: { ...value } });
    return value;
  }

  /** The values the draft under `key` opened with (or was last put with). */
  base<T extends object>(key: string): T | undefined {
    return this.entries.get(key)?.base as T | undefined;
  }

  get<T extends object>(key: string): T | undefined {
    return this.entries.get(key)?.value as T | undefined;
  }

  /** Starts or replaces a draft from a user action, such as opening a confirmation. */
  put<T extends object>(key: string, path: string, value: T): void {
    this.entries.set(key, { path, value, base: { ...value } });
    this.onChange();
  }

  /** Merges into the stored draft, not a render's copy: several inputs can land before a re-render. */
  patch<T extends object>(key: string, patch: Partial<T>): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.set(key, { ...entry, value: { ...entry.value, ...patch } });
    this.onChange();
  }

  drop(key: string): void {
    if (this.entries.delete(key)) this.onChange();
  }

  /** The route is now `path`: every draft whose form path it isn't on is dropped. Called before drawing. */
  leaveTo(path: string): void {
    for (const [key, entry] of this.entries) if (!isOn(path, entry.path)) this.entries.delete(key);
  }
}
