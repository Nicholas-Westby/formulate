import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from './repo.ts';
import { SEED_FINISHED, SHELL_NAME, runFolderPaths, siteAddresses, siteEnvironment, siteReadiness } from './site-environment.ts';
import { LOADED_FORMULATE_LOGGER } from './site-log.ts';

/** The logger of the dev site's line that says where its email goes (src/Website/Composers/DevEmailComposer.cs). */
const DEV_EMAIL_LOGGER = 'Website.Composers.DevEmailStarting';

/** The logger of the dev site's seed, which makes the test page (src/Website/Seed/FormulateTestContentComposer.cs). */
const SEED_LOGGER = 'Website.Seed.FormulateTestContentSeeder';

const ADDRESSES = siteAddresses('44331');
const ENVIRONMENT = siteEnvironment({ ...ADDRESSES, runFolder: '/tmp/formulate-e2e-1' });

/** The dev site's Development settings. */
function developmentSettings() {
	return JSON.parse(readFileSync(join(REPO_ROOT, 'src', 'Website', 'appsettings.Development.json'), 'utf8'));
}

test('every name in the environment the site starts with is one that a shell passes on', () => {
	assert.deepEqual(
		Object.keys(ENVIRONMENT).filter((name) => !SHELL_NAME.test(name)),
		[],
	);
});

test('a name with a dot is not a shell name', () => {
	// The name that dash, the /bin/sh of CI's Ubuntu runners, once dropped from the site's environment.
	assert.equal(SHELL_NAME.test('Serilog__MinimumLevel__Override__Website.Composers.LoadedFormulateLogger'), false);
	assert.equal(SHELL_NAME.test('1_NAME'), false);
	assert.equal(SHELL_NAME.test('Serilog__MinimumLevel__Default'), true);
});

test("the dev site's Development settings keep the lines about the loaded Formulate, where email goes and the seed at Information", () => {
	// The environment turns the rest of the log down to Warning; specs/loaded-formulate.spec.ts needs the first
	// lines, the next says in each run's log where the site's email goes, and the seed's say whether it made and
	// published the test page (and the specs wait for its last line, see siteReadiness).
	const settings = developmentSettings();

	assert.equal(ENVIRONMENT.Serilog__MinimumLevel__Default, 'Warning');
	assert.equal(settings.Serilog.MinimumLevel.Override[LOADED_FORMULATE_LOGGER], 'Information');
	assert.equal(settings.Serilog.MinimumLevel.Override[DEV_EMAIL_LOGGER], 'Information');
	assert.equal(settings.Serilog.MinimumLevel.Override[SEED_LOGGER], 'Information');
});

test('the site also listens on a plain http port, the E2E port plus 1000, so two runs on two ports never share one', () => {
	assert.deepEqual(siteAddresses(undefined), { origin: 'https://localhost:44331', plainOrigin: 'http://localhost:45331' });
	assert.deepEqual(siteAddresses('44332'), { origin: 'https://localhost:44332', plainOrigin: 'http://localhost:45332' });
	assert.equal(ENVIRONMENT.ASPNETCORE_URLS, 'https://localhost:44331;http://localhost:45331');
});

test('an E2E port that is not a port, or whose plain http port would not be one, is refused with the reason', () => {
	assert.throws(() => siteAddresses('localhost'), /FORMULATE_E2E_PORT/);
	assert.throws(() => siteAddresses('0'), /FORMULATE_E2E_PORT/);
	assert.throws(() => siteAddresses('65000'), /65535/);
});

test("the site opens the run's database as the dev site opens its own, without a shared cache", () => {
	// A shared cache locks tables between its connections: one run on 17.6.2 stuck on such a lock (SQLite
	// Error 6, "database table is locked"), query after query. Microsoft.Data.Sqlite advises against it.
	const own = developmentSettings().ConnectionStrings;

	assert.equal(
		ENVIRONMENT.ConnectionStrings__umbracoDbDSN,
		own.umbracoDbDSN.replace('|DataDirectory|/Umbraco.sqlite.db', join('/tmp/formulate-e2e-1', 'Umbraco.sqlite.db')),
	);
	assert.doesNotMatch(ENVIRONMENT.ConnectionStrings__umbracoDbDSN, /cache\s*=/i);
	assert.equal(ENVIRONMENT.ConnectionStrings__umbracoDbDSN_ProviderName, own.umbracoDbDSN_ProviderName);
});

test('the specs start when the seed has finished, and nothing asks the site for a page while it seeds', () => {
	// Asking for /umbraco until it answered had Umbraco write its back office OpenIddict clients while the seed
	// saved its page. On Umbraco 17 and 18, a write by another connection at that moment stalls the page's save
	// for 9 min 40 s. A url or a port here would let Playwright ask, or start the specs, before the seed is done.
	assert.deepEqual(siteReadiness(), { wait: { stdout: SEED_FINISHED } });

	// Playwright counts the site as ready on whichever comes first, so the config must not add one of its own.
	const config = readFileSync(join(REPO_ROOT, 'tests', 'e2e', 'playwright.config.ts'), 'utf8');
	const webServer = config.slice(config.indexOf('webServer: {'));

	assert.match(webServer, /^\t\t\.\.\.siteReadiness\(\),$/m);
	assert.doesNotMatch(webServer, /^\s*(url|port|wait)\s*:/m);
});

test("the seed's last line is one of the three it ends with, and none of the lines before it", () => {
	const seeder = readFileSync(join(REPO_ROOT, 'src', 'Website', 'Seed', 'FormulateTestContentComposer.cs'), 'utf8');
	// As the console prints them, with a value for the runtime level.
	const last = [
		'Seeded the Formulate test content.',
		'The Formulate test content could not be made.',
		'The Formulate test content was not seeded: the runtime level is {Level}, not Run.',
	];
	const before = [
		'Seeding the Formulate test content (attempt {Attempt}).',
		'The Formulate test content could not be made (attempt {Attempt}), trying again.',
		'Updated the Formulate test template.',
		'Publishing the Formulate test page.',
		'Published the Formulate test page.',
		'The Formulate test page could not be published: {Status}.',
		'The Formulate test page is in the recycle bin, so it is left unpublished.',
	];

	for (const message of [...last, ...before]) {
		assert.ok(seeder.includes(`"${message}"`), `the seed logs "${message}"`);
	}

	const printed = (message: string) =>
		`[WebServer] [14:12:30 INF] ${message.replace('{Level}', 'Install').replace('{Attempt}', '1').replace('{Status}', 'Unknown')}\n`;

	for (const message of last) {
		assert.match(printed(message), SEED_FINISHED);
	}

	for (const message of before) {
		assert.doesNotMatch(printed(message), SEED_FINISHED);
	}
});

test("the site writes its email, the echo's records and the files visitors upload in the run's folder", () => {
	assert.deepEqual(runFolderPaths('/tmp/formulate-e2e-1'), {
		email: join('/tmp/formulate-e2e-1', 'Email'),
		echo: join('/tmp/formulate-e2e-1', 'Echo'),
		uploads: join('/tmp/formulate-e2e-1', 'Uploads'),
	});
	assert.equal(ENVIRONMENT.Umbraco__CMS__Global__Smtp__PickupDirectoryLocation, join('/tmp/formulate-e2e-1', 'Email'));
	assert.equal(ENVIRONMENT.DevEcho__Folder, join('/tmp/formulate-e2e-1', 'Echo'));
	// Store Data's setting (StoreDataSettings.UploadsFolderPath), which is otherwise App_Data/Formulate/Uploads in the
	// dev site's own folder.
	assert.equal(ENVIRONMENT.Formulate__StoreData__UploadsFolderPath, join('/tmp/formulate-e2e-1', 'Uploads'));
});

test("the dev site's Development settings give an address to send from, and leave where email goes to the site", () => {
	// With no Host and no folder, DevEmailComposer has the site write its email to a folder of its own; so a
	// Host that a developer sets, such as in appsettings.Local.json, is used. The environment sets the run's
	// folder, which Umbraco writes to only when a From is set.
	const smtp = developmentSettings().Umbraco.CMS.Global.Smtp;

	assert.deepEqual(Object.keys(smtp), ['From']);
	assert.match(smtp.From, /^[^@\s]+@[^@\s]+$/);
});

test("the site gets no reCAPTCHA keys, whatever appsettings.Local.json sets", () => {
	// A developer's file with real keys must not change what the specs see (the reCAPTCHA dialog says the keys are not
	// set), and an environment variable, even an empty one, is read after that file.
	assert.equal(ENVIRONMENT.Formulate__Recaptcha__SiteKey, '');
	assert.equal(ENVIRONMENT.Formulate__Recaptcha__SecretKey, '');
});
