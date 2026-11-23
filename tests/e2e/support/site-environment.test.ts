import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from './repo.ts';
import { SEED_FINISHED, SHELL_NAME, siteAddresses, siteEnvironment, siteFolderPaths } from './site-environment.ts';
import { LOADED_FORMULATE_LOGGER, SEED_LOGGER } from './site-log.ts';

/** The logger of the dev site's line that says where its email goes (src/Website/Composers/DevEmailComposer.cs). */
const DEV_EMAIL_LOGGER = 'Website.Composers.DevEmailStarting';

const ADDRESSES = siteAddresses('44331');
const SITE_FOLDER = join('/tmp/formulate-e2e-1', 'worker-0');
const ENVIRONMENT = siteEnvironment({ ...ADDRESSES, siteFolder: SITE_FOLDER });

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

test("each worker's site listens on a port of its own from the E2E port up, and over plain http on that plus 1000", () => {
	assert.deepEqual(siteAddresses(undefined), { origin: 'https://localhost:44331', plainOrigin: 'http://localhost:45331' });
	assert.deepEqual(siteAddresses('44332'), { origin: 'https://localhost:44332', plainOrigin: 'http://localhost:45332' });
	assert.deepEqual(siteAddresses(undefined, 2), { origin: 'https://localhost:44333', plainOrigin: 'http://localhost:45333' });
	assert.deepEqual(siteAddresses('44341', 1), { origin: 'https://localhost:44342', plainOrigin: 'http://localhost:45342' });
	assert.equal(ENVIRONMENT.ASPNETCORE_URLS, 'https://localhost:44331;http://localhost:45331');
});

test('an E2E port that is not a port, or whose plain http port would not be one, is refused with the reason', () => {
	assert.throws(() => siteAddresses('localhost'), /FORMULATE_E2E_PORT/);
	assert.throws(() => siteAddresses('0'), /FORMULATE_E2E_PORT/);
	assert.throws(() => siteAddresses('65000'), /65535/);
	// The first worker's plain http port is 65535; the second's would be 65536.
	assert.doesNotThrow(() => siteAddresses('64535', 0));
	assert.throws(() => siteAddresses('64535', 1), /worker 2 is 65536/);
});

test("each site's folder is its content root, where Umbraco keeps its own files, so no two sites share them", () => {
	// In src/Website, every site would share Umbraco's files in umbraco/Data/TEMP: the search indexes, which two sites
	// writing at once corrupt, the models, and the lock on the application.
	assert.equal(ENVIRONMENT.ASPNETCORE_CONTENTROOT, SITE_FOLDER);
});

test('the site stops when its standard input ends, as it does when the worker that started it is killed', () => {
	assert.equal(ENVIRONMENT.DevSite__StopWhenInputEnds, 'true');
	const composer = readFileSync(join(REPO_ROOT, 'src', 'Website', 'Composers', 'DevStopWhenInputEndsComposer.cs'), 'utf8');
	assert.match(composer, /"DevSite:StopWhenInputEnds"/);
});

test("the site opens the run's database as the dev site opens its own, without a shared cache", () => {
	// A shared cache locks tables between its connections: one run on 17.6.2 stuck on such a lock (SQLite
	// Error 6, "database table is locked"), query after query. Microsoft.Data.Sqlite advises against it.
	const own = developmentSettings().ConnectionStrings;

	assert.equal(
		ENVIRONMENT.ConnectionStrings__umbracoDbDSN,
		own.umbracoDbDSN.replace('|DataDirectory|/Umbraco.sqlite.db', join(SITE_FOLDER, 'Umbraco.sqlite.db')),
	);
	assert.doesNotMatch(ENVIRONMENT.ConnectionStrings__umbracoDbDSN, /cache\s*=/i);
	assert.equal(ENVIRONMENT.ConnectionStrings__umbracoDbDSN_ProviderName, own.umbracoDbDSN_ProviderName);
});

test("a worker's tests start when its site's seed has finished, and nothing asks the site for a page while it seeds", () => {
	// Asking for /umbraco until it answered had Umbraco write its back office OpenIddict clients while the seed
	// saved its page. On Umbraco 17 and 18, a write by another connection at that moment stalls the page's save
	// for 9 min 40 s. The worker's site is ready on the seed's last line alone (startSite in support/sites.ts), and
	// the config starts no web server of its own, which Playwright would ask for a page to see whether it is up.
	const sites = readFileSync(join(REPO_ROOT, 'tests', 'e2e', 'support', 'sites.ts'), 'utf8');
	const config = readFileSync(join(REPO_ROOT, 'tests', 'e2e', 'playwright.config.ts'), 'utf8');

	assert.match(sites, /^\t\tready: SEED_FINISHED,$/m);
	assert.doesNotMatch(config, /webServer/);
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
		`[14:12:30 INF] ${message.replace('{Level}', 'Install').replace('{Attempt}', '1').replace('{Status}', 'Unknown')}`;

	for (const message of last) {
		assert.match(printed(message), SEED_FINISHED);
	}

	for (const message of before) {
		assert.doesNotMatch(printed(message), SEED_FINISHED);
	}
});

test("the site writes its log, its Formulate files, its email, the echo's records and the files visitors upload in its own folder", () => {
	assert.deepEqual(siteFolderPaths(SITE_FOLDER), {
		email: join(SITE_FOLDER, 'Email'),
		echo: join(SITE_FOLDER, 'Echo'),
		uploads: join(SITE_FOLDER, 'Uploads'),
	});
	assert.equal(ENVIRONMENT.Umbraco__CMS__Logging__Directory, join(SITE_FOLDER, 'Logs'));
	assert.equal(ENVIRONMENT.Formulate__Website__Persistence__DataFolderPath, join(SITE_FOLDER, 'Formulate'));
	assert.equal(ENVIRONMENT.Umbraco__CMS__Global__Smtp__PickupDirectoryLocation, join(SITE_FOLDER, 'Email'));
	assert.equal(ENVIRONMENT.DevEcho__Folder, join(SITE_FOLDER, 'Echo'));
	// Store Data's setting (StoreDataSettings.UploadsFolderPath), which is otherwise App_Data/Formulate/Uploads in the
	// dev site's own folder.
	assert.equal(ENVIRONMENT.Formulate__StoreData__UploadsFolderPath, join(SITE_FOLDER, 'Uploads'));
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

test("the site knows its own address, so Umbraco has no application URL warning and can build links", () => {
	// Without one, Umbraco 17 warns at start that "Application URL auto-detection is disabled and no explicit URL is
	// configured", and its notifications log "no site URL is set". The run's site is at its HTTPS address.
	assert.equal(ENVIRONMENT.Umbraco__CMS__WebRouting__UmbracoApplicationUrl, ADDRESSES.origin);
});

test("the dev site detects its address from the first request when it is not given one", () => {
	assert.equal(developmentSettings().Umbraco.CMS.WebRouting.ApplicationUrlDetection, 'FirstRequest');
});
