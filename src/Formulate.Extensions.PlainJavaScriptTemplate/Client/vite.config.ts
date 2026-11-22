import { defineConfig } from "vite";
import packageJson from "./package.json" with { type: "json" };

// The settings Vitest uses for the sources (vitest.config.ts). The renderer is not built with Vite: each module
// becomes a file of its own (scripts/build-modules.mjs), which puts the version in the same way.
export default defineConfig({
  define: {
    __FORMULATE_VERSION__: JSON.stringify(packageJson.version),
  },
});
