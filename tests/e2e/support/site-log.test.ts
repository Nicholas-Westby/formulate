import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOADED_FORMULATE_LOGGER, SEED_LOGGER, loadedFormulate, parseSiteLog, seedLines } from './site-log.ts';

/** A log line as Umbraco writes it. */
function line(properties: Record<string, unknown>) {
	return JSON.stringify({ '@t': '2026-11-22T09:30:05.1234567Z', '@mt': 'A message.', ...properties });
}

test('reads one event per line, and leaves out a line that is not whole yet', () => {
	const text = [line({ SourceContext: 'A' }), '', line({ SourceContext: 'B' }), '{"@t":"2026-11-22T09:3'].join('\n');

	const events = parseSiteLog(text);

	assert.deepEqual(
		events.map((event) => event.SourceContext),
		['A', 'B'],
	);
});

test('reads lines that end with a carriage return', () => {
	const events = parseSiteLog(`${line({ SourceContext: 'A' })}\r\n${line({ SourceContext: 'B' })}\r\n`);

	assert.equal(events.length, 2);
});

test("picks out the dev site's lines about the Formulate it loaded", () => {
	const events = parseSiteLog(
		[
			line({ SourceContext: 'Umbraco.Cms.Core.Something', FormulateAssembly: 'Not.Ours' }),
			line({
				SourceContext: LOADED_FORMULATE_LOGGER,
				FormulateAssembly: 'Formulate.Core',
				FormulateVersion: '5.0.0-local.g7dd0d289+7dd0d289abc',
				FormulateAssemblyLocation: '/site/bin/Formulate.Core.dll',
			}),
			line({
				SourceContext: LOADED_FORMULATE_LOGGER,
				FormulateBackOfficeScript: '/packages/formulate.js',
			}),
		].join('\n'),
	);

	assert.deepEqual(loadedFormulate(events), {
		assemblies: [
			{
				name: 'Formulate.Core',
				version: '5.0.0-local.g7dd0d289+7dd0d289abc',
				location: '/site/bin/Formulate.Core.dll',
			},
		],
		backOfficeScript: '/packages/formulate.js',
	});
});

test('finds nothing in a log without those lines', () => {
	assert.deepEqual(loadedFormulate(parseSiteLog(line({ SourceContext: 'A' }))), { assemblies: [] });
});

test("picks out the seed's lines, with their values filled in as the console shows them", () => {
	const events = parseSiteLog(
		[
			line({ SourceContext: SEED_LOGGER, '@mt': 'Seeding the Formulate test content (attempt {Attempt}).', Attempt: 2 }),
			line({ SourceContext: 'Umbraco.Cms.Core.Something', '@mt': 'Not the seed.' }),
			line({ SourceContext: SEED_LOGGER, '@mt': 'The Formulate test page could not be published: {Status}.', Status: 'InTrash' }),
			line({ SourceContext: SEED_LOGGER, '@mt': 'A {Missing} value stays as it is.' }),
		].join('\n'),
	);

	assert.deepEqual(seedLines(events), [
		'Seeding the Formulate test content (attempt 2).',
		'The Formulate test page could not be published: InTrash.',
		'A {Missing} value stays as it is.',
	]);
});
