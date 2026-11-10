import { defineConfig } from "vitest/config";

export default defineConfig({
  // css: process the panel's stylesheet, so `?inline` and `?raw` imports carry its real text.
  test: { environment: "happy-dom", include: ["test/**/*.test.ts"], setupFiles: ["test/setup.ts"], css: true },
  // The limits test reads the integration's service.py, outside frontend/.
  server: { fs: { allow: [".", "../custom_components/hearth_crm"] } },
});
