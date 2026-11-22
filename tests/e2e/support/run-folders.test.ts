import assert from 'node:assert/strict';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { RUN_FOLDER_PREFIX, removeOldRunFolders } from './run-folders.ts';

const DAY = 24 * 60 * 60 * 1000;

// Each test works in a folder of its own, standing in for the system's temp folder.
let temp = '';

beforeEach(() => {
	temp = mkdtempSync(join(tmpdir(), 'formulate-run-folders-test-'));
});

afterEach(() => {
	rmSync(temp, { recursive: true, force: true });
});

/** Creates a run folder like the harness does: a database file and Formulate's JSON folder. */
function runFolder(name: string) {
	const path = join(temp, `${RUN_FOLDER_PREFIX}${name}`);
	mkdirSync(join(path, 'Formulate'), { recursive: true });
	writeFileSync(join(path, 'Umbraco.sqlite.db'), '');
	return path;
}

test('removes run folders that have not changed for a day', () => {
	const first = runFolder('1');
	const second = runFolder('2');

	removeOldRunFolders(temp, { now: Date.now() + DAY + 60_000, keep: join(temp, `${RUN_FOLDER_PREFIX}3`) });

	assert.equal(existsSync(first), false);
	assert.equal(existsSync(second), false);
});

test('keeps run folders that changed within the last day', () => {
	const recent = runFolder('1');

	removeOldRunFolders(temp, { now: Date.now() + DAY - 60_000, keep: join(temp, `${RUN_FOLDER_PREFIX}2`) });

	assert.equal(existsSync(recent), true);
});

test('keeps the current run folder, other folders, files and symbolic links', () => {
	const current = runFolder('current');
	const other = join(temp, 'other');
	mkdirSync(other);
	writeFileSync(join(other, 'keep.txt'), 'keep');
	const file = join(temp, `${RUN_FOLDER_PREFIX}file`);
	writeFileSync(file, 'keep');
	const link = join(temp, `${RUN_FOLDER_PREFIX}link`);
	symlinkSync(other, link, 'junction');

	removeOldRunFolders(temp, { now: Date.now() + 2 * DAY, keep: current });

	assert.equal(existsSync(current), true);
	assert.equal(existsSync(file), true);
	assert.equal(lstatSync(link).isSymbolicLink(), true);
	assert.equal(existsSync(join(other, 'keep.txt')), true);
});

test(
	'leaves a folder it cannot remove for a later run',
	{
		skip:
			process.platform === 'win32'
				? 'file permissions cannot lock a folder on Windows'
				: process.getuid?.() === 0
					? 'root can remove any folder'
					: false,
	},
	() => {
		const locked = runFolder('locked');
		const old = runFolder('old');
		chmodSync(locked, 0o500);

		try {
			removeOldRunFolders(temp, { now: Date.now() + 2 * DAY, keep: join(temp, `${RUN_FOLDER_PREFIX}current`) });

			assert.equal(existsSync(join(locked, 'Umbraco.sqlite.db')), true);
			assert.equal(existsSync(old), false);
		} finally {
			chmodSync(locked, 0o700);
		}
	},
);
