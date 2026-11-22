import { join } from 'node:path';
import { E2E_USER } from '../fixtures/user.ts';

/**
 * A name that a shell passes on to the programs it starts: letters, digits and underscores, not starting with a
 * digit. Playwright starts the site through /bin/sh, and on Linux (dash, on Ubuntu and CI's runners) that drops
 * any other name, such as one with a dot, without a word.
 */
export const SHELL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The environment the dev site starts with for a run: Development, on a new database and Formulate folder in
 * the run's folder, with the run's own log, installing itself with the E2E user. Every name matches SHELL_NAME.
 * @param options.origin The site's address, such as https://localhost:44331.
 * @param options.runFolder The run's folder (see playwright.config.ts).
 */
export function siteEnvironment(options: { origin: string; runFolder: string }): Record<string, string> {
	const { origin, runFolder } = options;

	return {
		ASPNETCORE_ENVIRONMENT: 'Development',
		ASPNETCORE_URLS: origin,
		// Only warnings and errors, apart from the lines about the Formulate the site loaded, which
		// specs/loaded-formulate.spec.ts reads (appsettings.Development.json keeps them at Information).
		Serilog__MinimumLevel__Default: 'Warning',
		// Each run's log is its own, in the run folder.
		Umbraco__CMS__Logging__Directory: join(runFolder, 'Logs'),
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
	};
}
