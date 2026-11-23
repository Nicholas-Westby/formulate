import { join } from 'node:path';
import { E2E_USER } from '../fixtures/user.ts';

/**
 * A name that a shell passes on to the programs it starts: letters, digits and underscores, not starting with a
 * digit. On Linux, /bin/sh (dash, on Ubuntu and CI's runners) drops any other name, such as one with a dot, without
 * a word, so the site's environment keeps to these names in case a shell ever starts it.
 */
export const SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The port the site listens on when FORMULATE_E2E_PORT is not set. */
const DEFAULT_PORT = 44331;

/** How far the plain http port is from the E2E port: 45331 for the default 44331. */
export const PLAIN_HTTP_PORT_OFFSET = 1000;

/** Where a site can be reached. */
export interface SiteAddresses {
	/** The site's address, over HTTPS on its port, such as https://localhost:44331. */
	origin: string;
	/**
	 * The site's address over plain http, such as http://localhost:45331: the specs point Send Data handlers at the
	 * dev site's echo (/dev/echo) there. On Linux, where CI runs, the .NET development certificate is not trusted, so
	 * the handler could not call the HTTPS address; a real handler's HTTPS is left as it is.
	 */
	plainOrigin: string;
}

/**
 * The addresses of a worker's site. Each worker has a site of its own: the first listens over HTTPS on the E2E port,
 * the next on the port after it, and so on, and each listens over plain http on its HTTPS port plus 1000. So a run
 * with three workers on the default port uses 44331 to 44333 and 45331 to 45333, and two runs at once (such as in two
 * worktrees) need E2E ports at least as far apart as the first one has workers.
 * @param e2ePort FORMULATE_E2E_PORT, or undefined for the default, 44331.
 * @param index Which worker's site, from 0 (Playwright's parallelIndex).
 */
export function siteAddresses(e2ePort: string | undefined, index = 0): SiteAddresses {
	const firstPort = e2ePort ? Number(e2ePort) : DEFAULT_PORT;

	if (!Number.isInteger(firstPort) || firstPort < 1) {
		throw new Error(`FORMULATE_E2E_PORT is "${e2ePort}", which is not a port number.`);
	}

	const port = firstPort + index;
	const plainPort = port + PLAIN_HTTP_PORT_OFFSET;

	if (plainPort > 65535) {
		throw new Error(
			`FORMULATE_E2E_PORT is ${firstPort}, but a site's plain http port is its port plus ${PLAIN_HTTP_PORT_OFFSET}, which for worker ${index + 1} is ${plainPort}: it must be 65535 or less.`,
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
 * The folders in a site's folder that the site writes to: the emails it sends (as .eml files, through Umbraco's
 * pickup folder) and what the dev site's echo receives (src/Website/Composers/DevEchoComposer.cs), for the specs to
 * read, and the files visitors upload with the forms that store their submissions.
 * @param siteFolder The site's folder, in the run's folder (see support/sites.ts).
 */
export function siteFolderPaths(siteFolder: string) {
	return { email: join(siteFolder, 'Email'), echo: join(siteFolder, 'Echo'), uploads: join(siteFolder, 'Uploads') };
}


/**
 * The environment a worker's dev site starts with: Development, in its own folder (see prepareSiteFolder in
 * support/sites.ts), on a new database and Formulate folder there, with its own log, installing itself with the E2E
 * user. It listens on both of its addresses, and writes its email, its echo's records and the files visitors upload
 * in its folder. Every name matches SHELL_NAME.
 * @param options.origin The site's address, such as https://localhost:44331.
 * @param options.plainOrigin The site's plain http address, such as http://localhost:45331.
 * @param options.siteFolder The site's folder, in the run's folder (see support/sites.ts).
 */
export function siteEnvironment(options: SiteAddresses & { siteFolder: string }): Record<string, string> {
	const { origin, plainOrigin, siteFolder } = options;
	const folders = siteFolderPaths(siteFolder);

	return {
		ASPNETCORE_ENVIRONMENT: 'Development',
		// The site's folder is its content root, where src/Website is the dev site's: Umbraco keeps its own files there
		// (umbraco/Data, with its search indexes, its models and its lock on the application), and the site its views
		// and media, so several sites that run at once share none of them.
		ASPNETCORE_CONTENTROOT: siteFolder,
		ASPNETCORE_URLS: `${origin};${plainOrigin}`,
		// Only warnings and errors, apart from the lines about the Formulate the site loaded, which
		// specs/loaded-formulate.spec.ts reads, where email goes and what the seed did
		// (appsettings.Development.json keeps those at Information).
		Serilog__MinimumLevel__Default: 'Warning',
		// The site's own address, which Umbraco otherwise warns it does not know (and then logs "no site URL is set"
		// for each notification it cannot send). It is the one the run's site listens on over HTTPS.
		Umbraco__CMS__WebRouting__UmbracoApplicationUrl: origin,
		// Each site's log is its own, in its folder.
		Umbraco__CMS__Logging__Directory: join(siteFolder, 'Logs'),
		// The dev site's own connection string (appsettings.Development.json), with the site's database.
		ConnectionStrings__umbracoDbDSN: `Data Source=${join(siteFolder, 'Umbraco.sqlite.db')};Foreign Keys=True;Pooling=True`,
		ConnectionStrings__umbracoDbDSN_ProviderName: 'Microsoft.Data.Sqlite',
		Umbraco__CMS__Global__InstallMissingDatabase: 'true',
		Umbraco__CMS__Unattended__InstallUnattended: 'true',
		Umbraco__CMS__Unattended__UnattendedUserName: E2E_USER.name,
		Umbraco__CMS__Unattended__UnattendedUserEmail: E2E_USER.email,
		Umbraco__CMS__Unattended__UnattendedUserPassword: E2E_USER.password,
		Formulate__Website__Persistence__DataFolderPath: join(siteFolder, 'Formulate'),
		// The site's email goes to its own folder: Umbraco writes to a pickup folder before it tries a mail server,
		// even one that appsettings.Local.json sets (see src/Website/Composers/DevEmailComposer.cs).
		Umbraco__CMS__Global__Smtp__PickupDirectoryLocation: folders.email,
		// What the dev site's echo receives, for the Send Data specs to read.
		DevEcho__Folder: folders.echo,
		// Store Data keeps uploaded files in the site's folder too, not in the dev site's App_Data.
		Formulate__StoreData__UploadsFolderPath: folders.uploads,
		// The site has no reCAPTCHA keys, as appsettings.json says, whatever a developer's appsettings.Local.json sets
		// (specs/field-editors.spec.ts reads what the dialog says without keys). An environment variable, even an
		// empty one, is read after that file.
		Formulate__Recaptcha__SiteKey: '',
		Formulate__Recaptcha__SecretKey: '',
		// The site stops when its standard input ends, as it does when the worker that started it is killed
		// (src/Website/Composers/DevStopWhenInputEndsComposer.cs).
		DevSite__StopWhenInputEnds: 'true',
		// Send no .NET telemetry.
		DOTNET_CLI_TELEMETRY_OPTOUT: '1',
	};
}
