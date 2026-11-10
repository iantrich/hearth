/** The integration version, from the `?v=` HA puts on the module URL to bust caches. */
export const PANEL_VERSION: string | null = new URL(import.meta.url).searchParams.get("v");
