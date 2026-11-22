// Packs every Formulate package with a version of its own, then runs the browser tests on the dev site built
// from those packages instead of the source projects ("npm run test:packages"). Arguments go to
// "playwright test", and the other settings (such as UMBRACO_SITE_VERSION) are as in playwright.config.ts.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { packLocal } from '../support/local-packages.ts';

const version = packLocal();
const playwright = createRequire(import.meta.url).resolve('@playwright/test/cli');

console.log(`Running the browser tests on Formulate ${version}.`);

const run = spawnSync(process.execPath, [playwright, 'test', ...process.argv.slice(2)], {
	stdio: 'inherit',
	env: { ...process.env, FORMULATE_PACKAGE_VERSION: version },
});

process.exit(run.status ?? 1);
