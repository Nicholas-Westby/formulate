import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { missingPackages, packageVersionProblem } from './support/local-packages.ts';
import { RUN_FOLDER_PREFIX, removeOldRunFolders } from './support/run-folders.ts';
import { siteAddresses, siteEnvironment } from './support/site-environment.ts';

/**
 * Starts the dev website (src/Website) on a new, empty database and drives its back office.
 *
 * Environment variables:
 *   UMBRACO_SITE_VERSION       The Umbraco version to run the site on, such as 18.3.2 (default: the version in
 *                              src/Directory.Build.props).
 *   FORMULATE_PACKAGE_VERSION  Runs the site on the Formulate packages in artifacts/packages with this version
 *                              (-p:FormulateFromPackages=true), instead of the source projects. It needs a
 *                              prerelease label, such as 5.0.0-local.g1a2b3c4, and CI (where CI is set) must
 *                              set it. "npm run test:packages" packs a new version and sets it.
 *   FORMULATE_E2E_PORT         The port the site listens on over HTTPS (default: 44331). The site also listens over
 *                              plain http on this port plus 1000 (45331 by default), where the Send Data specs reach
 *                              the dev site's echo (see support/site-environment.ts), so two runs need two ports.
 *   DOTNET_EXE                 The dotnet executable (default: dotnet). Umbraco 19 needs the .NET 11 SDK.
 */

// Two runs at once (such as in two worktrees) need two ports.
const ADDRESSES = siteAddresses(process.env.FORMULATE_E2E_PORT);
const ORIGIN = ADDRESSES.origin;

// Every run starts from nothing: a new folder holds the site's SQLite database and Formulate's JSON files.
// (An in-memory database does not work: its tables are gone before Umbraco's install has finished.)
// Playwright loads this file in its main process first, then in each test worker, which inherits the
// folder. Only the main process picks the folder, and removes the folders of runs a day old or more.
if (!process.env.FORMULATE_E2E_RUN_FOLDER) {
	const newRunFolder = join(tmpdir(), `${RUN_FOLDER_PREFIX}${Date.now()}`);
	removeOldRunFolders(tmpdir(), { now: Date.now(), keep: newRunFolder });
	process.env.FORMULATE_E2E_RUN_FOLDER = newRunFolder;
}

const runFolder = process.env.FORMULATE_E2E_RUN_FOLDER;
mkdirSync(runFolder, { recursive: true });

const siteVersion = process.env.UMBRACO_SITE_VERSION;
const packageVersion = process.env.FORMULATE_PACKAGE_VERSION;
const dotnet = process.env.DOTNET_EXE || 'dotnet';

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

const msbuildArgs = [
	siteVersion ? ` -p:UmbracoSiteVersion=${siteVersion}` : '',
	packageVersion ? ` -p:FormulateFromPackages=true -p:FormulatePackageVersion=${packageVersion}` : '',
].join('');

export default defineConfig({
	testDir: './specs',
	outputDir: './test-results',
	// The tests share one site, so run them one at a time.
	workers: 1,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
	timeout: 60_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: ORIGIN,
		ignoreHTTPSErrors: true,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
	webServer: {
		command: `"${dotnet}" run --project ../../src/Website --no-launch-profile${msbuildArgs}`,
		url: `${ORIGIN}/umbraco`,
		ignoreHTTPSErrors: true,
		timeout: 240_000,
		reuseExistingServer: false,
		// Show the site's warnings and errors (Umbraco's information messages are left out below).
		stdout: 'pipe',
		stderr: 'pipe',
		// Ask the site to stop, so it can shut down cleanly; Playwright kills it if it is still running after 10 seconds.
		gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
		// Every name in it is a shell name: on Linux, the /bin/sh that starts the site drops any other.
		env: siteEnvironment({ ...ADDRESSES, runFolder }),
	},
});
