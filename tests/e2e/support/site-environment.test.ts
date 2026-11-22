import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { REPO_ROOT } from './repo.ts';
import { SHELL_NAME, siteEnvironment } from './site-environment.ts';
import { LOADED_FORMULATE_LOGGER } from './site-log.ts';

const ENVIRONMENT = siteEnvironment({ origin: 'https://localhost:44331', runFolder: '/tmp/formulate-e2e-1' });

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

test("the dev site's Development settings keep the lines about the loaded Formulate at Information", () => {
	// The environment turns the rest of the log down to Warning; specs/loaded-formulate.spec.ts needs these lines.
	const settings = JSON.parse(readFileSync(join(REPO_ROOT, 'src', 'Website', 'appsettings.Development.json'), 'utf8'));

	assert.equal(ENVIRONMENT.Serilog__MinimumLevel__Default, 'Warning');
	assert.equal(settings.Serilog.MinimumLevel.Override[LOADED_FORMULATE_LOGGER], 'Information');
});
