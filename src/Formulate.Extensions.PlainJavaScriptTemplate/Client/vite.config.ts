import { defineConfig } from "vite";
import packageJson from "./package.json" with { type: "json" };

// Builds the visitor-side renderer as one classic script (an IIFE with no
// exports) that the Razor view loads with <script defer>.
export default defineConfig({
  define: {
    __FORMULATE_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    outDir: "../wwwroot/App_Plugins/Formulate/PlainJavaScript",
    // The theme build (build:theme) writes into the same folder, so never wipe it.
    emptyOutDir: false,
    lib: {
      entry: "src/index.ts",
      formats: ["iife"],
      name: "FormulatePlainJs",
      fileName: () => "formulate.js",
    },
  },
});
