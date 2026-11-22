import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { readEchoRecords } from './echo.ts';

// Records as src/Website/Composers/DevEchoComposer.cs writes them, and a file that is not one.
const FOLDER = join(import.meta.dirname, 'test-data', 'echo');

test("reads the echo's records under a path, in the order they arrived", () => {
	const records = readEchoRecords(FOLDER, '/dev/echo/run-1/');

	assert.deepEqual(
		records.map(({ method, path, query, body }) => ({ method, path, query, body })),
		[
			{ method: 'GET', path: '/dev/echo/run-1/query-string', query: '?a=1', body: '' },
			{ method: 'POST', path: '/dev/echo/run-1/json', query: '', body: '{"a":"1"}' },
		],
	);
	assert.equal(records[1]!.headers['content-type'], 'application/json; charset=utf-8');
	assert.equal(records[1]!.file, join(FOLDER, '20261122080000002-b.json'));
});

test('has no records for a path nothing was sent to, or a folder that is not there', () => {
	assert.deepEqual(readEchoRecords(FOLDER, '/dev/echo/run-3/'), []);
	assert.deepEqual(readEchoRecords(join(FOLDER, 'missing'), '/dev/echo/'), []);
});
