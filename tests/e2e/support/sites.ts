import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { connect } from 'node:net';
import { availableParallelism, totalmem } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { REPO_ROOT } from './repo.ts';
import { SEED_FINISHED, type SiteAddresses, siteAddresses, siteEnvironment } from './site-environment.ts';

/** The dev website's project folder. */
export const WEBSITE_FOLDER = join(REPO_ROOT, 'src', 'Website');

/** The dev site's settings files, which a site's folder gets copies of: appsettings.json and appsettings.<name>.json. */
const SETTINGS_FILE = /^appsettings(\.[^.]+)?\.json$/i;

/** How long a site may take to start and seed its test content. */
export const SITE_START_TIMEOUT_MS = 240_000;

/** How long a site has to stop once asked, before it is killed. */
const SITE_STOP_TIMEOUT_MS = 10_000;

/**
 * How long a worker waits for its ports to be free. When Playwright replaces a worker after a failed test, the new
 * worker starts its site on the same ports, which the old worker's site may still be giving up.
 */
const FREE_PORT_TIMEOUT_MS = 30_000;

/** How many of a site's last lines a failure to start shows. */
const LAST_LINES = 40;

/** The most workers a run has by default. More gain little on a machine of four or eight processors. */
const MOST_WORKERS = 4;

/** About how much memory a worker takes, with its site and its browser. */
const MEMORY_PER_WORKER = 2.5 * 1024 ** 3;

/**
 * How many workers a run has, unless --workers says otherwise: one for each of the machine's processors but one,
 * which the sites and the test runner share, up to MOST_WORKERS, and no more than its memory holds. At least one.
 * @param processors How many processors the machine has.
 * @param memory How much memory the machine has, in bytes.
 */
export function defaultWorkers(processors = availableParallelism(), memory = totalmem()): number {
	return Math.max(1, Math.min(MOST_WORKERS, processors - 1, Math.floor(memory / MEMORY_PER_WORKER)));
}

/** A worker's site: where it listens, and the folder of the run's folder it keeps its database and files in. */
export interface WorkerSite extends SiteAddresses {
	folder: string;
}

/**
 * The site a worker runs its tests on: its own ports (see siteAddresses) and its own folder, so no two workers
 * share a database, a Formulate folder, an email folder or a port.
 * @param options.e2ePort FORMULATE_E2E_PORT, or undefined for the default.
 * @param options.parallelIndex The worker's slot, from 0, which a worker that replaces it after a failure keeps:
 * it picks the ports.
 * @param options.workerIndex The worker's own number, from 0, which a replacement does not keep: it picks the
 * folder, so a replacement starts on a new database.
 * @param options.runFolder The run's folder (see playwright.config.ts).
 */
export function siteOfWorker(options: {
	e2ePort: string | undefined;
	parallelIndex: number;
	workerIndex: number;
	runFolder: string;
}): WorkerSite {
	return {
		...siteAddresses(options.e2ePort, options.parallelIndex),
		folder: join(options.runFolder, `worker-${options.workerIndex}`),
	};
}

/**
 * The MSBuild properties the dev site is built with: the Umbraco version it runs, and the Formulate packages it
 * runs on instead of the source projects, when they are set.
 * @param options.siteVersion UMBRACO_SITE_VERSION, or undefined for the version in src/Directory.Build.props.
 * @param options.packageVersion FORMULATE_PACKAGE_VERSION, or undefined to build from source.
 */
export function siteBuildProperties(options: { siteVersion?: string; packageVersion?: string }): Array<string> {
	return [
		...(options.siteVersion ? [`-p:UmbracoSiteVersion=${options.siteVersion}`] : []),
		...(options.packageVersion
			? ['-p:FormulateFromPackages=true', `-p:FormulatePackageVersion=${options.packageVersion}`]
			: []),
	];
}

/**
 * The environment the build runs in: it leaves no MSBuild or compiler server running after it, and sends no .NET
 * telemetry.
 */
export function buildEnvironment(): Record<string, string> {
	return { MSBUILDDISABLENODEREUSE: '1', UseSharedCompilation: 'false', DOTNET_CLI_TELEMETRY_OPTOUT: '1' };
}

/**
 * Builds the dev site, once for the whole run, before any worker starts a site from it.
 * @param options.dotnet The dotnet executable.
 * @param options.properties The MSBuild properties (see siteBuildProperties).
 * @returns The site's built assembly, such as src/Website/bin/Debug/net10.0/Website.dll.
 */
export function buildSite(options: { dotnet: string; properties: Array<string> }): string {
	const env = { ...process.env, ...buildEnvironment() };
	const build = spawnSync(options.dotnet, ['build', WEBSITE_FOLDER, ...options.properties], {
		env,
		encoding: 'utf8',
		maxBuffer: 256 * 1024 * 1024,
	});

	if (build.error) {
		throw new Error(`"${options.dotnet} build" could not run: ${build.error.message}`);
	}

	if (build.status !== 0) {
		throw new Error(
			`The dev site did not build (exit code ${build.status}). The build's last lines:\n${lastLines(`${build.stdout}\n${build.stderr}`, 60)}`,
		);
	}

	const query = spawnSync(options.dotnet, ['msbuild', WEBSITE_FOLDER, '-getProperty:TargetPath', ...options.properties], {
		env,
		encoding: 'utf8',
	});
	const assembly = query.stdout?.trim();

	if (query.status !== 0 || !assembly) {
		throw new Error(`The dev site's built assembly could not be found: ${lastLines(`${query.stdout}\n${query.stderr}`, 20)}`);
	}

	return assembly;
}

/** A process started by runUntilReady, such as a worker's site. */
export interface StartedProcess {
	/** Asks the process to stop, and kills it if it is still running after 10 seconds. */
	stop(): Promise<void>;
}

/**
 * Makes a site's folder its content root, as src/Website is the dev site's. It gets copies of the dev site's
 * settings files (appsettings.json, appsettings.Development.json, and a developer's appsettings.Local.json if there is
 * one), and a wwwroot for the media the site keeps. The site then writes Umbraco's own files (umbraco/Data, with its
 * search indexes, its models and its lock on the application) and its views there, so no two sites share any of
 * them. The dev site's own static files, such as wwwroot/scripts/phone-field.js, are still served from src/Website:
 * in Development, ASP.NET Core serves them from where the build's list of static web assets says they are.
 * @param folder The site's folder.
 * @param websiteFolder The dev site's project folder (default: src/Website).
 */
export function prepareSiteFolder(folder: string, websiteFolder = WEBSITE_FOLDER) {
	mkdirSync(join(folder, 'wwwroot'), { recursive: true });

	for (const name of readdirSync(websiteFolder)) {
		if (SETTINGS_FILE.test(name)) {
			copyFileSync(join(websiteFolder, name), join(folder, name));
		}
	}
}

/**
 * Starts a worker's site from the built assembly, in the site's folder (see prepareSiteFolder), on a new database
 * there, and waits until its seed has logged its last line (SEED_FINISHED), which can say that the seed failed.
 *
 * Nothing may ask the site for a page while the seed runs. The first back office request has Umbraco write its
 * OpenIddict clients to the database. On Umbraco 17 and 18, a write by another connection just as the seed saves its
 * page makes that save fail after 9 min 40 s: Umbraco stores the page's relations after the save, in a transaction
 * that reads before it writes, and once another connection has written in between, SQLite refuses that
 * transaction's write ("database is locked") however often Umbraco retries it.
 *
 * Its input is a pipe that is never written to, so the site stops by itself if the worker is killed (see
 * src/Website/Composers/DevStopWhenInputEndsComposer.cs).
 * @param options.dotnet The dotnet executable.
 * @param options.assembly The site's built assembly (see buildSite).
 * @param options.site The worker's site (see siteOfWorker).
 * @param options.output Gets each line the site writes, for the run's output.
 */
export async function startSite(options: {
	dotnet: string;
	assembly: string;
	site: WorkerSite;
	output: (line: string) => void;
}): Promise<StartedProcess> {
	const { site } = options;

	for (const origin of [site.origin, site.plainOrigin]) {
		const port = Number(new URL(origin).port);

		if (!(await waitForFreePort(port, FREE_PORT_TIMEOUT_MS))) {
			throw new Error(
				`Port ${port} is in use, so the site for ${site.origin} cannot start. Another run of the tests or the dev site may be using it: stop it, or set FORMULATE_E2E_PORT to a port with as many free ports after it as the run has workers.`,
			);
		}
	}

	prepareSiteFolder(site.folder);

	return runUntilReady({
		file: options.dotnet,
		args: ['exec', options.assembly],
		cwd: site.folder,
		env: { ...process.env, ...siteEnvironment({ ...site, siteFolder: site.folder }) },
		ready: SEED_FINISHED,
		timeoutMs: SITE_START_TIMEOUT_MS,
		name: `The site for ${site.origin}`,
		output: options.output,
	});
}

/**
 * Starts a program, with its input a pipe that is never written to, and waits until it writes a line that matches.
 * Fails if it stops first or does not write the line in time, stopping it, with its last lines in the error.
 * @param options.name What the program is, for the error, such as "The site for https://localhost:44331".
 * @param options.output Gets each line the program writes, on its output or its error output.
 */
export async function runUntilReady(options: {
	file: string;
	args: Array<string>;
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	ready: RegExp;
	timeoutMs: number;
	name: string;
	output?: (line: string) => void;
}): Promise<StartedProcess> {
	const child = spawn(options.file, options.args, { cwd: options.cwd, env: options.env, stdio: ['pipe', 'pipe', 'pipe'] });
	const lines: Array<string> = [];
	let resolveReady: () => void = () => undefined;
	const ready = new Promise<'ready'>((resolve) => {
		resolveReady = () => resolve('ready');
	});

	for (const stream of [child.stdout, child.stderr]) {
		createInterface({ input: stream }).on('line', (line) => {
			lines.push(line);

			if (lines.length > LAST_LINES) {
				lines.shift();
			}

			options.output?.(line);

			if (options.ready.test(line)) {
				resolveReady();
			}
		});
	}

	const exited = exitOf(child);
	const stop = () => stopProcess(child, exited);
	let timer: NodeJS.Timeout | undefined;
	const timedOut = new Promise<'timed out'>((resolve) => {
		timer = setTimeout(() => resolve('timed out'), options.timeoutMs);
	});
	const outcome = await Promise.race([ready, exited, timedOut]);
	clearTimeout(timer);

	if (outcome !== 'ready') {
		await stop();
		const reason =
			outcome === 'timed out'
				? `was not ready within ${options.timeoutMs / 1000} s`
				: outcome.error
					? `could not start: ${outcome.error.message}`
					: `stopped before it was ready (${outcome.signal ? `signal ${outcome.signal}` : `exit code ${outcome.code}`})`;
		throw new Error(`${options.name} ${reason}. Its last lines:\n${lines.join('\n')}`);
	}

	return { stop };
}

/** How a process ended: its exit code or the signal that ended it, or why it could not start. */
interface ProcessEnd {
	code: number | null;
	signal: NodeJS.Signals | null;
	error?: Error;
}

/** Resolves when the process has exited, or could not start. */
function exitOf(child: ChildProcess): Promise<ProcessEnd> {
	return new Promise((resolve) => {
		if (child.exitCode !== null || child.signalCode !== null) {
			resolve({ code: child.exitCode, signal: child.signalCode });
			return;
		}

		child.once('exit', (code, signal) => resolve({ code, signal }));
		// A process that could not start at all (such as a missing dotnet) never exits.
		child.once('error', (error) => resolve({ code: null, signal: null, error }));
	});
}

/** Asks a process to stop, and kills it if it has not after SITE_STOP_TIMEOUT_MS. */
async function stopProcess(child: ChildProcess, exited: Promise<unknown>) {
	if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
		return;
	}

	child.kill('SIGTERM');

	if (!(await finishesWithin(exited, SITE_STOP_TIMEOUT_MS))) {
		child.kill('SIGKILL');
		await finishesWithin(exited, SITE_STOP_TIMEOUT_MS);
	}
}

/** Whether the promise settles within the time. */
async function finishesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
	let timer: NodeJS.Timeout | undefined;
	const late = new Promise<false>((resolve) => {
		timer = setTimeout(() => resolve(false), ms);
	});
	const settled = await Promise.race([promise.then(() => true), late]);
	clearTimeout(timer);

	return settled;
}

/**
 * Waits until nothing listens on the port, on either loopback address.
 * @returns Whether the port was free within the time.
 */
export async function waitForFreePort(port: number, timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	for (;;) {
		const listening = await Promise.all(['127.0.0.1', '::1'].map((host) => isListening(host, port)));

		if (!listening.includes(true)) {
			return true;
		}

		if (Date.now() >= deadline) {
			return false;
		}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}
}

/** Whether something accepts connections on the address and port. */
function isListening(host: string, port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = connect({ host, port });
		socket.once('connect', () => {
			socket.destroy();
			resolve(true);
		});
		socket.once('error', () => resolve(false));
	});
}

/** The last lines of a text. */
export function lastLines(text: string, count: number): string {
	return text.trimEnd().split(/\r?\n/).slice(-count).join('\n');
}
