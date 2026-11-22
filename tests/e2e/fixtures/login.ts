import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';
import { callManagementApi } from './management-api.ts';
import { E2E_USER } from './user.ts';

export { expect };

/** Signs in on Umbraco's login screen (the same on Umbraco 17, 18 and 19) and waits for the back office. */
export async function logIn(page: Page) {
	await page.goto('/umbraco');
	await page.locator('[name="username"]').fill(E2E_USER.email);
	await page.locator('[name="password"]').fill(E2E_USER.password);
	await page.locator('#umb-login-button').click();
	await expect(page.locator('umb-backoffice-header')).toBeVisible({ timeout: 60_000 });
}

/**
 * Tests that start signed in to the back office. Each worker signs in once and saves the browser's
 * cookies and storage, which every test in that worker then starts from.
 */
export const test = base.extend<object, { signedInState: string }>({
	storageState: ({ signedInState }, use) => use(signedInState),

	signedInState: [
		async ({ browser }, use, workerInfo) => {
			const file = join(workerInfo.project.outputDir, '.auth', `${workerInfo.parallelIndex}.json`);
			const { baseURL, ignoreHTTPSErrors } = workerInfo.project.use;

			// Sign in from a clean browser context, not one that already has a stored state.
			const page = await browser.newPage({ baseURL, ignoreHTTPSErrors, storageState: undefined });
			await logIn(page);

			// Say which Umbraco version the site runs, so every run's output shows what it tested.
			const server = await callManagementApi<{ version: string }>(page, 'GET', '/server/information');
			console.log(`The site reports Umbraco ${server.version}.`);

			mkdirSync(dirname(file), { recursive: true });
			await page.context().storageState({ path: file });
			await page.close();

			await use(file);
		},
		{ scope: 'worker' },
	],
});
