import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/hearth-panel.ts",
      formats: ["es"],
      fileName: () => "hearth-panel.js",
    },
    outDir: "../custom_components/hearth_crm/www",
    emptyOutDir: false,
    target: "es2022",
    cssCodeSplit: false,
    rollupOptions: { external: [] },
  },
});
