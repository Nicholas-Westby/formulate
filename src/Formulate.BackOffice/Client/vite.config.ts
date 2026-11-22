import { defineConfig, type Plugin } from 'vite';
import umbracoPackage from './public/umbraco-package.json' with { type: 'json' };

// Node's types are not installed in this client; this is the one part of Node the config uses.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

// The version the back office shows, in Umbraco's list of installed packages and on the welcome dashboard: the
// package's own, such as 5.0.0-rc.1, which "dotnet build" and "dotnet pack" pass in as FORMULATE_VERSION
// (FormulateClientUsesVersion in src/Directory.Build.targets), or else the one in public/umbraco-package.json.
const version = process.env.FORMULATE_VERSION || umbracoPackage.version;

/** Writes the version into the umbraco-package.json that the build copies from public/, over that copy. */
function stampVersion(): Plugin {
	return {
		name: 'formulate-stamp-version',
		apply: 'build',
		generateBundle() {
			this.emitFile({
				type: 'asset',
				fileName: 'umbraco-package.json',
				source: `${JSON.stringify({ ...umbracoPackage, version }, null, 2)}\n`,
			});
		},
	};
}

// Builds the back office extension as an ES module library. Umbraco loads formulate.js through the
// bundle extension in public/umbraco-package.json (copied next to it), and serves every
// @umbraco-cms/backoffice import itself through the back office import map.
export default defineConfig({
	define: {
		// The welcome dashboard's version (src/section/welcome-dashboard.element.ts).
		__FORMULATE_VERSION__: JSON.stringify(version),
	},
	plugins: [stampVersion()],
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
