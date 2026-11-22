import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: 'jsdom',
			include: ['src/**/*.test.ts'],
			setupFiles: ['src/test/setup.ts'],
			restoreMocks: true,
			// The file cache of compiled modules does not notice tsconfig.json changes (such as the
			// decorator settings), so it could keep testing stale output. The suite is small, so skip it.
			fsModuleCache: false,
		},
	}),
);
