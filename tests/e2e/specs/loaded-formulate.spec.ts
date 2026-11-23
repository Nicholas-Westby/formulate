import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
// The same tests as the other specs', though this one does not sign in, so it runs in the same workers as theirs:
// a test of another kind would need a worker, and so a site, of its own.
import { expect, test } from '../fixtures/login.ts';
import { REPO_ROOT, readBuildProperty } from '../support/repo.ts';
import { type LoadedFormulate, loadedFormulate, readSiteLog } from '../support/site-log.ts';

/** The packed version the site runs (see playwright.config.ts), or none when it runs from source. */
const PACKAGE_VERSION = process.env.FORMULATE_PACKAGE_VERSION;

/** The assemblies the Formulate package installs, one per project. */
const ASSEMBLIES = [
	'Formulate.BackOffice',
	'Formulate.Core',
	'Formulate.Extensions.PlainJavaScriptTemplate',
	'Formulate.Extensions.SendData',
	'Formulate.Extensions.SendEmail',
	'Formulate.Extensions.StoreData',
	'Formulate.Web',
];

/** Whether a file is somewhere inside a folder, following links (such as /tmp to /private/tmp). */
function isInside(folder: string, file: string) {
	if (!existsSync(folder) || !existsSync(file)) {
		return false;
	}

	const path = relative(realpathSync(folder), realpathSync(file));

	return path !== '' && !path.startsWith('..') && !isAbsolute(path);
}

test(`the site runs Formulate ${PACKAGE_VERSION ? `from the ${PACKAGE_VERSION} packages` : 'from source'}`, async ({ workerSite }) => {
	// The site writes these lines to its log as it starts (src/Website/Composers/LoadedFormulateComposer.cs).
	const logFolder = join(workerSite.folder, 'Logs');
	let loaded: LoadedFormulate = { assemblies: [] };
	await expect
		.poll(
			() => {
				loaded = loadedFormulate(readSiteLog(logFolder));

				return loaded.backOfficeScript !== undefined;
			},
			{ message: `the site logs which Formulate it loaded, in ${logFolder}` },
		)
		.toBe(true);

	const expectedVersion = PACKAGE_VERSION ?? readBuildProperty('VersionPrefix');
	const scriptFolder = PACKAGE_VERSION
		? // NuGet extracts each package into <id>/<version>, both in lower case.
			join(REPO_ROOT, 'src', 'Website', 'obj', 'FormulatePackages', 'umbraco.community.formulate.backoffice', PACKAGE_VERSION.toLowerCase())
		: join(REPO_ROOT, 'src', 'Formulate.BackOffice', 'wwwroot');
	console.log(`The site runs Formulate ${loaded.assemblies.find((x) => x.name === 'Formulate.Core')?.version}.`);
	console.log(`Its back office script is ${loaded.backOfficeScript}.`);

	expect(new Set(loaded.assemblies.map((x) => x.name)), 'every Formulate assembly is loaded').toEqual(new Set(ASSEMBLIES));

	for (const assembly of loaded.assemblies) {
		// An informational version ends with "+" and the commit, which the comparison leaves out.
		expect(assembly.version.split('+')[0], `the version of ${assembly.name}`).toBe(expectedVersion);
		expect(isInside(join(REPO_ROOT, 'src', 'Website', 'bin'), assembly.location), `${assembly.location} is in the site's bin folder`).toBe(true);
	}

	expect(isInside(scriptFolder, loaded.backOfficeScript!), `${loaded.backOfficeScript} is in ${scriptFolder}`).toBe(true);
});
