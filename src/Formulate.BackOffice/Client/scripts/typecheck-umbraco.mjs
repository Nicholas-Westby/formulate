// Type-checks the client against another version of Umbraco's back office (@umbraco-cms/backoffice), such as
// 18.3.2 or 19.0.0-rc1, while the client itself builds against the version in package.json. "npm run
// typecheck:18" and "npm run typecheck:19" run it.
//
// Usage: node scripts/typecheck-umbraco.mjs <version of @umbraco-cms/backoffice>
//
// The version is installed in a folder of its own, .typecheck/<version> (not committed), with its
// dependencies as they were when it was published, next to links to src and public. TypeScript checks src
// through those links and keeps the links' paths (preserveSymlinks), so each import of @umbraco-cms/backoffice
// is found in that folder's node_modules, and everything else (such as vitest) in the client's own
// node_modules, which this never changes. A later run reuses the folder while its installed.json says the
// install finished, for that version and that publish time.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const client = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
	console.error('Usage: node scripts/typecheck-umbraco.mjs <version of @umbraco-cms/backoffice, such as 18.3.2>');
	process.exit(2);
}

const folder = join(client, '.typecheck', version);
mkdirSync(folder, { recursive: true });

writeIfChanged(
	join(folder, 'package.json'),
	{
		name: `formulate-typecheck-${version}`,
		private: true,
		description: `@umbraco-cms/backoffice ${version}, for scripts/typecheck-umbraco.mjs. Not committed.`,
		dependencies: { '@umbraco-cms/backoffice': version },
	},
);

// The back office asks for ranges of its own dependencies (such as ^3.3.1 of lit), so a newer release of one of
// them could change the result from one day to the next. They are installed as they were when that version came
// out, so every run (CI's too) checks against the same types.
const released = publishTime(version);
const record = join(folder, 'installed.json');

if (!isInstalled(record, version, released)) {
	console.log(`Installing @umbraco-cms/backoffice ${version} as of ${released}, in ${relative(client, folder)}.`);
	// "update" also re-resolves a tree that an earlier install left with other versions (from before the pin,
	// with another time, or cut short), where "install" would keep what its lock file says. Only type
	// declarations are needed, so no package runs an install script. The prefix keeps npm in the folder,
	// whatever "npm run" passed on about the client's own folder.
	const flags = ['--no-audit', '--no-fund', '--ignore-scripts', `--before=${released}`];
	npm(['update', '--prefix', folder, ...flags], folder);

	if (installedVersion(folder) !== version) {
		throw new Error(`npm did not install @umbraco-cms/backoffice ${version} in ${folder}.`);
	}

	// Written last, so an install that was cut short is done again on the next run.
	writeFileSync(record, `${JSON.stringify({ version, before: released }, null, 2)}\n`);
}

link(join(client, 'src'), join(folder, 'src'));
link(join(client, 'public'), join(folder, 'public'));

writeIfChanged(join(folder, 'tsconfig.json'), {
	extends: '../../tsconfig.json',
	compilerOptions: { preserveSymlinks: true },
	// The Vite and Vitest configs do not use Umbraco, and "npm run typecheck" checks them already.
	include: ['src'],
});

// The client's own TypeScript.
const typescript = createRequire(join(client, 'package.json')).resolve('typescript/package.json');
const tsc = join(dirname(typescript), JSON.parse(readFileSync(typescript, 'utf8')).bin.tsc);
console.log(`Type-checking src against @umbraco-cms/backoffice ${version}.`);
const check = spawnSync(process.execPath, [tsc, '-p', join(folder, 'tsconfig.json')], { stdio: 'inherit' });

if (check.status === 0) {
	console.log(`No type errors against @umbraco-cms/backoffice ${version}.`);
}

process.exit(check.status ?? 1);

/** Writes an object as JSON, unless the file already holds the same. */
function writeIfChanged(path, value) {
	const text = `${JSON.stringify(value, null, 2)}\n`;

	if (!existsSync(path) || readFileSync(path, 'utf8') !== text) {
		writeFileSync(path, text);
	}
}

/** Links a folder to the client's, or checks that an earlier run's link points at it. */
function link(target, path) {
	let entry;

	try {
		entry = lstatSync(path);
	} catch {
		// Relative on macOS and Linux, so it still works when the repository moves. A Windows directory
		// junction needs no special rights, but needs an absolute path.
		symlinkSync(process.platform === 'win32' ? target : relative(dirname(path), target), path, 'junction');

		return;
	}

	if (!entry.isSymbolicLink() || realpathSync(path) !== realpathSync(target)) {
		throw new Error(`${path} is in the way: it is not a link to ${target}.`);
	}
}

/** The version of @umbraco-cms/backoffice installed in a folder, if any. */
function installedVersion(folder) {
	const manifest = join(folder, 'node_modules', '@umbraco-cms', 'backoffice', 'package.json');

	try {
		return JSON.parse(readFileSync(manifest, 'utf8')).version;
	} catch {
		return undefined;
	}
}

/** Whether the folder holds that version, installed in full with its dependencies as of that time. */
function isInstalled(record, version, released) {
	try {
		const done = JSON.parse(readFileSync(record, 'utf8'));

		return done.version === version && done.before === released && installedVersion(dirname(record)) === version;
	} catch {
		return false;
	}
}

/**
 * When a version of @umbraco-cms/backoffice was published, as the npm registry has it (an ISO 8601 time).
 * npm's cache answers if it can, so a folder installed earlier can be checked offline. If the cache has not
 * seen that version, npm asks the registry.
 */
function publishTime(version) {
	for (const cache of ['--prefer-offline', '--prefer-online']) {
		const args = ['view', `@umbraco-cms/backoffice@${version}`, 'time', '--json', cache];
		const view = npm(args, client, 'pipe', false);

		try {
			const time = JSON.parse(view.stdout)[version];

			if (typeof time === 'string') {
				return time;
			}
		} catch {
			// No answer from this one: try the next.
		}
	}

	throw new Error(`The npm registry has no publish time for @umbraco-cms/backoffice ${version}.`);
}

/**
 * Runs npm: the one running this script ("npm run"), or the one on the PATH.
 * @param stdout 'inherit' to show npm's output, or 'pipe' to return it as the result's stdout.
 * @param check Whether to throw when npm fails.
 */
function npm(args, cwd, stdout = 'inherit', check = true) {
	const options = { cwd, stdio: ['inherit', stdout, 'inherit'], encoding: 'utf8' };
	const result = process.env.npm_execpath
		? spawnSync(process.execPath, [process.env.npm_execpath, ...args], options)
		: spawnSync('npm', args, { ...options, shell: process.platform === 'win32' });

	if (check && result.status !== 0) {
		throw new Error(`npm ${args.join(' ')} failed in ${cwd}.`);
	}

	return result;
}
