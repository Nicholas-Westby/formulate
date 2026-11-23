import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	buildEnvironment,
	defaultWorkers,
	lastLines,
	prepareSiteFolder,
	runUntilReady,
	siteBuildProperties,
	siteOfWorker,
	waitForFreePort,
} from './sites.ts';

const GB = 1024 ** 3;

/** Runs a short Node program as the process, as a worker runs its site. */
function node(program: string, options: { timeoutMs?: number } = {}) {
	return runUntilReady({
		file: process.execPath,
		args: ['-e', program],
		ready: /^ready$/,
		timeoutMs: options.timeoutMs ?? 10_000,
		name: 'The program',
	});
}

test("a worker's site has its ports by the worker's slot and its folder by the worker's own number", () => {
	const first = siteOfWorker({ e2ePort: undefined, parallelIndex: 0, workerIndex: 0, runFolder: '/tmp/run' });
	// The worker that replaces the second one after a failure: the same ports, a new folder (and so a new database).
	const replacement = siteOfWorker({ e2ePort: undefined, parallelIndex: 1, workerIndex: 3, runFolder: '/tmp/run' });

	assert.deepEqual(first, { origin: 'https://localhost:44331', plainOrigin: 'http://localhost:45331', folder: join('/tmp/run', 'worker-0') });
	assert.deepEqual(replacement, {
		origin: 'https://localhost:44332',
		plainOrigin: 'http://localhost:45332',
		folder: join('/tmp/run', 'worker-3'),
	});
});

test("a site's folder gets copies of the dev site's settings files and a wwwroot, and nothing else of the dev site's", () => {
	const temp = mkdtempSync(join(tmpdir(), 'formulate-sites-test-'));

	try {
		const website = join(temp, 'Website');
		const folder = join(temp, 'run', 'worker-0');
		mkdirSync(website);
		const settings = ['appsettings.json', 'appsettings.Development.json', 'appsettings.Local.json'];

		for (const name of [...settings, 'appsettings-schema.json', 'appsettings-schema.Umbraco.Cms.json', 'Program.cs']) {
			writeFileSync(join(website, name), `{ "file": "${name}" }`);
		}

		prepareSiteFolder(folder, website);

		assert.deepEqual(readdirSync(folder).sort(), [...settings, 'wwwroot'].sort());
		assert.equal(readFileSync(join(folder, 'appsettings.Local.json'), 'utf8'), '{ "file": "appsettings.Local.json" }');
		assert.equal(statSync(join(folder, 'wwwroot')).isDirectory(), true);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test('the site is built on the Umbraco version and the Formulate packages the run asks for', () => {
	assert.deepEqual(siteBuildProperties({}), []);
	assert.deepEqual(siteBuildProperties({ siteVersion: '18.0.0' }), ['-p:UmbracoSiteVersion=18.0.0']);
	assert.deepEqual(siteBuildProperties({ siteVersion: '19.0.0-rc1', packageVersion: '5.0.0-local.g1a2b3c4' }), [
		'-p:UmbracoSiteVersion=19.0.0-rc1',
		'-p:FormulateFromPackages=true',
		'-p:FormulatePackageVersion=5.0.0-local.g1a2b3c4',
	]);
});

test('the build leaves no MSBuild or compiler server running, and sends no telemetry', () => {
	assert.deepEqual(buildEnvironment(), { MSBUILDDISABLENODEREUSE: '1', UseSharedCompilation: 'false', DOTNET_CLI_TELEMETRY_OPTOUT: '1' });
});

test('a run has a worker for each processor but one, up to four, as many as the memory holds, and at least one', () => {
	assert.equal(defaultWorkers(4, 10 * GB), 3);
	assert.equal(defaultWorkers(16, 64 * GB), 4);
	assert.equal(defaultWorkers(8, 6 * GB), 2);
	assert.equal(defaultWorkers(2, 16 * GB), 1);
	assert.equal(defaultWorkers(1, 1 * GB), 1);
});

test('a program is ready once it writes the ready line, on either output, and stops when asked', async () => {
	const started = await node("console.error('starting'); setTimeout(() => console.log('ready'), 50); setInterval(() => {}, 1000);");

	await started.stop();
	// Stopping it again does nothing.
	await started.stop();
});

test('a program that stops before it is ready fails with its exit code and its last lines', async () => {
	await assert.rejects(node("console.log('one'); console.error('two'); process.exit(3);"), (error: Error) => {
		assert.match(error.message, /^The program stopped before it was ready \(exit code 3\)\. Its last lines:\n/);
		assert.match(error.message, /one/);
		assert.match(error.message, /two/);
		return true;
	});
});

test('a program that is not ready in time is stopped, and fails saying so', async () => {
	await assert.rejects(node("console.log('waiting'); setInterval(() => {}, 1000);", { timeoutMs: 300 }), /^Error: The program was not ready within 0.3 s\. Its last lines:\nwaiting$/);
});

test('a program that cannot start fails saying why', async () => {
	await assert.rejects(
		runUntilReady({ file: join('/nowhere', 'dotnet'), args: [], ready: /ready/, timeoutMs: 5_000, name: 'The site' }),
		/^Error: The site could not start: spawn .*ENOENT/,
	);
});

test('a port something listens on is not free, and is once it stops listening', async () => {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as { port: number };

	assert.equal(await waitForFreePort(port, 300), false);
	await new Promise((resolve) => server.close(resolve));
	assert.equal(await waitForFreePort(port, 300), true);
});

test("a failure shows a program's last lines", () => {
	assert.equal(lastLines('a\nb\r\nc\n\n', 2), 'b\nc');
	assert.equal(lastLines('a', 5), 'a');
});
