import { join } from 'node:path';
import { E2E_USER } from '../fixtures/user.ts';

/**
 * A name that a shell passes on to the programs it starts: letters, digits and underscores, not starting with a
 * digit. Playwright starts the site through /bin/sh, and on Linux (dash, on Ubuntu and CI's runners) that drops
 * any other name, such as one with a dot, without a word.
 */
export const SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The port the site listens on when FORMULATE_E2E_PORT is not set. */
const DEFAULT_PORT = 44331;

/** How far the plain http port is from the E2E port: 45331 for the default 44331. */
export const PLAIN_HTTP_PORT_OFFSET = 1000;

/** Where a run's site can be reached. */
export interface SiteAddresses {
	/** The site's address, over HTTPS on the E2E port, such as https://localhost:44331. */
	origin: string;
	/**
	 * The site's address over plain http, such as http://localhost:45331: the specs point Send Data handlers at the
	 * dev site's echo (/dev/echo) there. On Linux, where CI runs, the .NET development certificate is not trusted, so
	 * the handler could not call the HTTPS address; a real handler's HTTPS is left as it is.
	 */
	plainOrigin: string;
}

/**
 * The addresses of a run's site: HTTPS on the E2E port, and plain http on the E2E port plus 1000, so two runs on two
 * E2E ports (such as in two worktrees) never share a port.
 * @param e2ePort FORMULATE_E2E_PORT, or undefined for the default, 44331.
 */
export function siteAddresses(e2ePort: string | undefined): SiteAddresses {
	const port = e2ePort ? Number(e2ePort) : DEFAULT_PORT;

	if (!Number.isInteger(port) || port < 1) {
		throw new Error(`FORMULATE_E2E_PORT is "${e2ePort}", which is not a port number.`);
	}

	const plainPort = port + PLAIN_HTTP_PORT_OFFSET;

	if (plainPort > 65535) {
		throw new Error(
			`FORMULATE_E2E_PORT is ${port}, but the site's plain http port is that plus ${PLAIN_HTTP_PORT_OFFSET}, which must be 65535 or less.`,
		);
	}

	return { origin: `https://localhost:${port}`, plainOrigin: `http://localhost:${plainPort}` };
}

/**
 * The line the dev site's seed (src/Website/Seed/FormulateTestContentComposer.cs) logs when it has finished: it
 * made the test content, it gave up, or it did not run.
 */
export const SEED_FINISHED =
	/Seeded the Formulate test content\.|The Formulate test content could not be made\.|The Formulate test content was not seeded/;

/**
 * When Playwright counts the site as ready for the specs (the webServer's readiness options): once the seed has
 * logged its last line. Nothing asks the site for a page before then.
 *
 * The seed makes its page once Umbraco has started, when the site already answers requests. The first back office
 * request, such as Playwright asking for /umbraco to see whether the site is up, has Umbraco write its OpenIddict
 * clients to the database. On Umbraco 17 and 18, a write by another connection just as the seed saves its page
 * makes that save fail after 9 min 40 s: Umbraco stores the page's relations after the save, in a transaction that
 * reads before it writes, and once another connection has written in between, SQLite refuses that transaction's
 * write ("database is locked") however often Umbraco retries it.
 * @returns The options to spread into the webServer config. A url or a port there would have Playwright ask for a
 * page, or start the specs, while the seed runs.
 */
export function siteReadiness(): { wait: { stdout: RegExp } } {
	return { wait: { stdout: SEED_FINISHED } };
}

/**
 * The folders in a run's folder that the site writes to: the emails it sends (as .eml files, through Umbraco's
 * pickup folder) and what the dev site's echo receives (src/Website/Composers/DevEchoComposer.cs), for the specs to
 * read, and the files visitors upload with the forms that store their submissions.
 * @param runFolder The run's folder (see playwright.config.ts).
 */
export function runFolderPaths(runFolder: string) {
	return { email: join(runFolder, 'Email'), echo: join(runFolder, 'Echo'), uploads: join(runFolder, 'Uploads') };
}

/**
 * The environment the dev site starts with for a run: Development, on a new database and Formulate folder in
 * the run's folder, with the run's own log, installing itself with the E2E user. It listens on both of the run's
 * addresses, and writes its email, its echo's records and the files visitors upload in the run's folder. Every name
 * matches SHELL_NAME.
 * @param options.origin The site's address, such as https://localhost:44331.
 * @param options.plainOrigin The site's plain http address, such as http://localhost:45331.
 * @param options.runFolder The run's folder (see playwright.config.ts).
 */
export function siteEnvironment(options: SiteAddresses & { runFolder: string }): Record<string, string> {
	const { origin, plainOrigin, runFolder } = options;
	const folders = runFolderPaths(runFolder);

	return {
		ASPNETCORE_ENVIRONMENT: 'Development',
		ASPNETCORE_URLS: `${origin};${plainOrigin}`,
		// Only warnings and errors, apart from the lines about the Formulate the site loaded, which
		// specs/loaded-formulate.spec.ts reads, where email goes and what the seed did
		// (appsettings.Development.json keeps those at Information).
		Serilog__MinimumLevel__Default: 'Warning',
		// Each run's log is its own, in the run folder.
		Umbraco__CMS__Logging__Directory: join(runFolder, 'Logs'),
		// The dev site's own connection string (appsettings.Development.json), with the run's database.
		ConnectionStrings__umbracoDbDSN: `Data Source=${join(runFolder, 'Umbraco.sqlite.db')};Foreign Keys=True;Pooling=True`,
		ConnectionStrings__umbracoDbDSN_ProviderName: 'Microsoft.Data.Sqlite',
		Umbraco__CMS__Global__InstallMissingDatabase: 'true',
		Umbraco__CMS__Unattended__InstallUnattended: 'true',
		Umbraco__CMS__Unattended__UnattendedUserName: E2E_USER.name,
		Umbraco__CMS__Unattended__UnattendedUserEmail: E2E_USER.email,
		Umbraco__CMS__Unattended__UnattendedUserPassword: E2E_USER.password,
		Formulate__Website__Persistence__DataFolderPath: join(runFolder, 'Formulate'),
		// The site's email goes to the run's own folder: Umbraco writes to a pickup folder before it tries a mail
		// server, even one that appsettings.Local.json sets (see src/Website/Composers/DevEmailComposer.cs).
		Umbraco__CMS__Global__Smtp__PickupDirectoryLocation: folders.email,
		// What the dev site's echo receives, for the Send Data specs to read.
		DevEcho__Folder: folders.echo,
		// Store Data keeps uploaded files in the run's folder too, not in the dev site's App_Data.
		Formulate__StoreData__UploadsFolderPath: folders.uploads,
		// The site has no reCAPTCHA keys, as appsettings.json says, whatever a developer's appsettings.Local.json sets
		// (specs/field-editors.spec.ts reads what the dialog says without keys). An environment variable, even an
		// empty one, is read after that file.
		Formulate__Recaptcha__SiteKey: '',
		Formulate__Recaptcha__SecretKey: '',
		// Leave no MSBuild or compiler server running after the build that "dotnet run" does.
		MSBUILDDISABLENODEREUSE: '1',
		UseSharedCompilation: 'false',
		// Send no .NET telemetry from the build and the site.
		DOTNET_CLI_TELEMETRY_OPTOUT: '1',
	};
}
