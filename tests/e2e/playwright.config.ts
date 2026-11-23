import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { missingPackages, packageVersionProblem } from './support/local-packages.ts';
import { RUN_FOLDER_PREFIX, removeOldRunFolders } from './support/run-folders.ts';
import { defaultWorkers } from './support/sites.ts';

/**
 * Builds the dev website (src/Website) once, starts a site of it for each worker on a new, empty database, and
 * drives the sites' back offices, several workers at once (see fixtures/site.ts).
 *
 * Environment variables:
 *   UMBRACO_SITE_VERSION       The Umbraco version to run the site on, such as 18.3.2 (default: the version in
 *                              src/Directory.Build.props).
 *   FORMULATE_PACKAGE_VERSION  Runs the site on the Formulate packages in artifacts/packages with this version
 *                              (-p:FormulateFromPackages=true), instead of the source projects. It needs a
 *                              prerelease label, such as 5.0.0-local.g1a2b3c4, and CI (where CI is set) must
 *                              set it. "npm run test:packages" packs a new version and sets it.
 *   FORMULATE_E2E_PORT         The port the first worker's site listens on over HTTPS (default: 44331). Each other
 *                              worker's site listens on the next port up, and each site also listens over plain http
 *                              on its port plus 1000 (45331 by default), where the Send Data specs reach the dev
 *                              site's echo (see support/site-environment.ts). So two runs at once need ports at
 *                              least as far apart as the first run has workers.
 *   DOTNET_EXE                 The dotnet executable (default: dotnet). Umbraco 19 needs the .NET 11 SDK.
 *
 * The run has as many workers as the machine has processors, less one, up to four, and no more than one for each
 * 2.5 GB of memory (see defaultWorkers in support/sites.ts). Pass --workers to choose.
 */

// Every run starts from nothing: a new folder holds a folder for each worker's site, with its SQLite database and
// Formulate's JSON files. (An in-memory database does not work: its tables are gone before Umbraco's install has
// finished.) Playwright loads this file in its main process first, then in each test worker, which inherits the
// folder. Only the main process picks the folder, and removes the folders of runs a day old or more.
if (!process.env.FORMULATE_E2E_RUN_FOLDER) {
	const newRunFolder = join(tmpdir(), `${RUN_FOLDER_PREFIX}${Date.now()}`);
	removeOldRunFolders(tmpdir(), { now: Date.now(), keep: newRunFolder });
	process.env.FORMULATE_E2E_RUN_FOLDER = newRunFolder;
}

mkdirSync(process.env.FORMULATE_E2E_RUN_FOLDER, { recursive: true });

const packageVersion = process.env.FORMULATE_PACKAGE_VERSION;

// CI tests only what is shipped, and a version needs a prerelease label of its own (see packageVersionProblem).
const versionProblem = packageVersionProblem(packageVersion, { ci: !!process.env.CI });

if (versionProblem) {
	throw new Error(versionProblem);
}

const missing = packageVersion ? missingPackages(packageVersion) : [];

if (missing.length > 0) {
	throw new Error(
		`artifacts/packages has no ${packageVersion} package of ${missing.join(', ')}. Pack them with "npm run pack:local", or put CI's "packages" artifact there.`,
	);
}

export default defineConfig({
	testDir: './specs',
	outputDir: './test-results',
	// Builds the site once, before the workers start their sites from the build.
	globalSetup: './support/global-setup.ts',
	// Each worker has a site of its own, so any test can run in any worker, at the same time as the others.
	workers: defaultWorkers(),
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
	timeout: 60_000,
	// A site that stops answering fails every test after it, each one slowly, so the run stops after three
	// failures. Pass --max-failures=0 to run every test anyway.
	maxFailures: 3,
	expect: { timeout: 15_000 },
	// The baseURL is the worker's site's (fixtures/site.ts).
	use: {
		ignoreHTTPSErrors: true,
		// A failed test keeps a trace, with a snapshot of the page at each step. Recording a filmstrip of screenshots as
		// well made the whole run about 15% slower, so the trace has none; the test's last screenshot is kept on its own.
		trace: { mode: 'retain-on-failure', screenshots: false },
		screenshot: 'only-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
