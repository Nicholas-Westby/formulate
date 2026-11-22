import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    // The build test writes the modules into .build, so watching it would rerun the tests forever.
    server: { watch: { ignored: ["**/.build/**"] } },
    test: {
      environment: "jsdom",
      include: ["test/**/*.test.ts"],
      restoreMocks: true,
      unstubGlobals: true,
    },
  }),
);
