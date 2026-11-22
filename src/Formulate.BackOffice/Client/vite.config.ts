import { defineConfig } from 'vite';

// Builds the back office extension as an ES module library. Umbraco loads formulate.js through the
// bundle extension in public/umbraco-package.json (copied next to it), and serves every
// @umbraco-cms/backoffice import itself through the back office import map.
export default defineConfig({
	build: {
		lib: {
			entry: 'src/bundle.manifests.ts',
			formats: ['es'],
			fileName: 'formulate',
		},
		outDir: '../wwwroot/App_Plugins/Formulate',
		emptyOutDir: true,
		sourcemap: true,
		rolldownOptions: {
			external: [/^@umbraco/],
		},
	},
});
