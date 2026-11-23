import { expect, type Page } from '@playwright/test';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** A field of a form sent to the Management API: a value, or a file. */
type FormValue = string | { name: string; mimeType: string; buffer: Buffer };

/**
 * What the back office sends as its bearer token. Umbraco 17 and 18 keep a signed-in user's access token in an
 * HttpOnly cookie, and take a request's token from that cookie when the request carries this placeholder, as the
 * back office's own requests do; without it, they answer 401. Umbraco 19 has no token cookie: it signs a request
 * in by the back office's sign-in cookie alone, and answers requests that carry the placeholder as well.
 */
const TOKEN_PLACEHOLDER = 'Bearer [redacted]';

/**
 * Calls the Management API from the test runner, with the sign-in cookies of the page's browser context, the way
 * the back office calls it. The page need not show the back office, so a test can set things up before it opens
 * any page, and clean up from whatever page it ends on.
 *
 * On Umbraco 17 and 18, the access token in the cookie is the one the back office got when it last started, since
 * it trades the token for a new one each time. If the site answers 401 because that one has run out, the call starts
 * the back office once in a page of its own, to get a new one, and calls again.
 * @param page A page of the signed-in browser context.
 * @param method The HTTP method.
 * @param path The path after /umbraco/management/api/v1, such as /server/information.
 * @param body The request body, sent as JSON.
 * @returns The response body.
 */
export function callManagementApi<T = unknown>(page: Page, method: Method, path: string, body?: unknown): Promise<T> {
	return send<T>(page, method, path, body === undefined ? {} : { data: body });
}

/**
 * Sends a form to the Management API, as it takes files (see callManagementApi).
 * @param page A page of the signed-in browser context.
 * @param path The path after /umbraco/management/api/v1, such as /temporary-file.
 * @param form The form's fields, by name.
 * @returns The response body.
 */
export function sendFormToManagementApi<T = unknown>(page: Page, path: string, form: Record<string, FormValue>): Promise<T> {
	return send<T>(page, 'POST', path, { multipart: form });
}

async function send<T>(page: Page, method: Method, path: string, content: { data?: unknown; multipart?: Record<string, FormValue> }): Promise<T> {
	const call = () =>
		page.request.fetch(`/umbraco/management/api/v1${path}`, { method, headers: { Authorization: TOKEN_PLACEHOLDER }, ...content });
	let response = await call();

	if (response.status() === 401) {
		console.log(`${method} ${path} answered 401, so the back office is started to renew the sign-in.`);
		await refreshSignIn(page);
		response = await call();
	}

	const text = await response.text();

	if (!response.ok()) {
		throw new Error(`${method} ${path} answered ${response.status()}: ${text}`);
	}

	return (text ? JSON.parse(text) : undefined) as T;
}

/** Starts the back office in a page of its own, which trades the context's access token for a new one. */
async function refreshSignIn(page: Page) {
	const backOffice = await page.context().newPage();

	try {
		await backOffice.goto('/umbraco/section/formulate');
		await expect(backOffice.locator('umb-backoffice-header')).toBeVisible();
	} finally {
		await backOffice.close();
	}
}
