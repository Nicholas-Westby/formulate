import { expect, test as loggedIn } from './login.ts';

/** The key of the dev site's seeded "Contact Us" page (src/Website/Seed), which is served at "/". */
export const SEEDED_PAGE_ID = '5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a03';

/**
 * The dev site seeds its test page when the application has started, which can end after the site
 * starts answering requests, so a test that needs the page asks for the `seededPage` fixture: it waits
 * until "/" serves the page.
 */
export const test = loggedIn.extend<{ seededPage: void }>({
	seededPage: async ({ request }, use) => {
		await expect
			.poll(
				async () => {
					const response = await request.get('/');

					return response.ok() && (await response.text()).includes('<h1>Contact Us</h1>');
				},
				{ message: 'the seeded Contact Us page is served', timeout: 60_000 },
			)
			.toBe(true);
		await use();
	},
});

export { expect };
