import { join } from 'node:path';
import {
	SEEDED_PAGE_FIXTURE_TIMEOUT_MS,
	SEEDED_PAGE_REQUEST_TIMEOUT_MS,
	SEEDED_PAGE_WAIT_MS,
	waitForSeededPage,
} from '../support/seeded-page-wait.ts';
import { expect, test as loggedIn } from './login.ts';

/** The key of the dev site's seeded "Contact Us" page (src/Website/Seed), which is served at "/". */
export const SEEDED_PAGE_ID = '5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a03';

/**
 * The dev site seeds its test page when the application has started, and the specs start once the seed has
 * logged its last line (siteReadiness in support/site-environment.ts), which can say that it failed. So a test
 * that needs the page asks for the `seededPage` fixture: it waits until "/" serves the page, for up to 180 s, and
 * if it never does, fails saying so, with what "/" answered last and the seed's last line in the site log.
 */
export const test = loggedIn.extend<{ seededPage: void }>({
	seededPage: [
		async ({ request }, use) => {
			await waitForSeededPage(
				async () => {
					try {
						const response = await request.get('/', { timeout: SEEDED_PAGE_REQUEST_TIMEOUT_MS });

						if (!response.ok()) {
							return { served: false, answer: String(response.status()) };
						}

						const served = (await response.text()).includes('<h1>Contact Us</h1>');

						return { served, answer: served ? 'the page' : `${response.status()}, without the page` };
					} catch (error) {
						return { served: false, answer: `the request failed: ${(error as Error).message.split('\n')[0]}` };
					}
				},
				{ waitMs: SEEDED_PAGE_WAIT_MS, logFolder: join(process.env.FORMULATE_E2E_RUN_FOLDER!, 'Logs') },
			);
			await use();
		},
		{ timeout: SEEDED_PAGE_FIXTURE_TIMEOUT_MS },
	],
});

export { expect };
