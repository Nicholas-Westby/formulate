import { test as base, expect } from '@playwright/test';
import { SITE_ASSEMBLY_VARIABLE } from '../support/global-setup.ts';
import { SITE_START_TIMEOUT_MS, type WorkerSite, siteOfWorker, startSite } from '../support/sites.ts';

export { expect };
export type { WorkerSite };

/**
 * Tests on a site of the worker's own. Each worker starts the dev site that the global setup built, on its own
 * ports and a new database in its own folder of the run's folder, and stops it when the worker finishes, so the
 * workers run their tests at once without sharing anything. Pages and requests go to the worker's site (baseURL).
 *
 * The site's lines go to the run's output, each starting with its address, as "[site https://localhost:44331]".
 */
export const test = base.extend<object, { workerSite: WorkerSite }>({
	workerSite: [
		async ({}, use, workerInfo) => {
			const assembly = process.env[SITE_ASSEMBLY_VARIABLE];

			if (!assembly) {
				throw new Error(`${SITE_ASSEMBLY_VARIABLE} is not set: the global setup (support/global-setup.ts) builds the site and sets it.`);
			}

			const site = siteOfWorker({
				e2ePort: process.env.FORMULATE_E2E_PORT,
				parallelIndex: workerInfo.parallelIndex,
				workerIndex: workerInfo.workerIndex,
				runFolder: process.env.FORMULATE_E2E_RUN_FOLDER!,
			});
			const started = await startSite({
				dotnet: process.env.DOTNET_EXE || 'dotnet',
				assembly,
				site,
				output: (line) => process.stderr.write(`[site ${site.origin}] ${line}\n`),
			});

			await use(site);
			await started.stop();
		},
		// Every worker starts its site, even for a test that only reads the site's files. The timeout is long enough for
		// the site to start and seed, and to stop.
		{ scope: 'worker', auto: true, timeout: SITE_START_TIMEOUT_MS + 60_000 },
	],

	baseURL: async ({ workerSite }, use) => {
		await use(workerSite.origin);
	},
});
