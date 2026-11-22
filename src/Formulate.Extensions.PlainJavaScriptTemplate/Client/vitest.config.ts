import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    server: {
      // The build test writes the modules into .build, so watching it would rerun the tests forever.
      watch: { ignored: ["**/.build/**"] },
      // The API test reads the list of exports in docs/extending.md. Vite serves no file outside these folders.
      fs: { allow: [".", "../../../docs"] },
    },
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.ts"],
      restoreMocks: true,
      unstubGlobals: true,
    },
  }),
);
