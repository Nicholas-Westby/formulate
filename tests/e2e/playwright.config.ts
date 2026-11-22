import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_USER } from './fixtures/user.ts';
import { RUN_FOLDER_PREFIX, removeOldRunFolders } from './support/run-folders.ts';

/**
 * Starts the dev website (src/Website) on a new, empty database and drives its back office.
 *
 * Environment variables:
 *   UMBRACO_SITE_VERSION  The Umbraco version to run the site on, such as 18.3.2 (default: the version in
 *                         src/Directory.Packages.props).
 *   FORMULATE_E2E_PORT    The port the site listens on (default: 44331).
 *   DOTNET_EXE            The dotnet executable (default: dotnet). Umbraco 19 needs the .NET 11 SDK.
 */

// Two runs at once (such as in two worktrees) need two ports.
const ORIGIN = `https://localhost:${process.env.FORMULATE_E2E_PORT || 44331}`;

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
const dotnet = process.env.DOTNET_EXE || 'dotnet';
const msbuildArgs = siteVersion ? ` -p:UmbracoSiteVersion=${siteVersion}` : '';

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
		env: {
			ASPNETCORE_ENVIRONMENT: 'Development',
			ASPNETCORE_URLS: ORIGIN,
			Serilog__MinimumLevel__Default: 'Warning',
			ConnectionStrings__umbracoDbDSN: `Data Source=${join(runFolder, 'Umbraco.sqlite.db')};Cache=Shared;Foreign Keys=True;Pooling=True`,
			ConnectionStrings__umbracoDbDSN_ProviderName: 'Microsoft.Data.Sqlite',
			Umbraco__CMS__Global__InstallMissingDatabase: 'true',
			Umbraco__CMS__Unattended__InstallUnattended: 'true',
			Umbraco__CMS__Unattended__UnattendedUserName: E2E_USER.name,
			Umbraco__CMS__Unattended__UnattendedUserEmail: E2E_USER.email,
			Umbraco__CMS__Unattended__UnattendedUserPassword: E2E_USER.password,
			Formulate__Website__Persistence__DataFolderPath: join(runFolder, 'Formulate'),
			// Leave no MSBuild or compiler server running after the build that "dotnet run" does.
			MSBUILDDISABLENODEREUSE: '1',
			UseSharedCompilation: 'false',
			// Send no .NET telemetry from the build and the site.
			DOTNET_CLI_TELEMETRY_OPTOUT: '1',
		},
	},
});
