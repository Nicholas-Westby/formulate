import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
	viteConfig,
	defineConfig({
		server: {
			// The tests read some of the server's C# constants as text (src/test/server-constants.ts), so the back
			// office spells them as the server does. Vite serves no file outside these folders.
			fs: {
				allow: ['.', '../../Formulate.Core/FormFields', '../../Formulate.Extensions.SendData', '../../Formulate.Extensions.SendEmail'],
			},
		},
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
