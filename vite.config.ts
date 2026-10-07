/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    // Vuetify's components import their own .css - inline it so tests can
    // mount real components.
    server: { deps: { inline: ["vuetify"] } },
  },
  build: {
    // vue-tsc writes the .d.ts files into dist/ before this runs (see the
    // build script) - the default emptyOutDir would wipe them out again.
    emptyOutDir: false,
    lib: {
      entry: "src/index.ts",
      name: "HomelabUiKit",
      fileName: "ui-kit",
      formats: ["es"],
    },
    rollupOptions: {
      // Consumers bring their own Vue + Vuetify instance (see
      // peerDependencies) - bundling either in here would risk two copies
      // running at once in the consuming app. A plain string only matches
      // that exact specifier, so this also has to cover subpath imports
      // (vuetify/components, vuetify/directives, vuetify/iconsets/mdi) -
      // registering Vuetify's components/directives here needs those.
      external: (id) =>
        id === "vue" || id === "vue-router" || id === "vuetify" || id.startsWith("vuetify/"),
    },
  },
});
