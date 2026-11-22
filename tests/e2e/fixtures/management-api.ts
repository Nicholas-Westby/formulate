import type { Page } from '@playwright/test';

/**
 * Calls the Management API from a signed-in back office page, through the back office's own HTTP client,
 * so each request is signed in the way the running Umbraco version does it: Umbraco 17 and 18 send a
 * placeholder bearer token next to the sign-in cookie, Umbraco 19 sends the cookie alone.
 * @param page A page showing the back office.
 * @param method The HTTP method.
 * @param path The path after /umbraco/management/api/v1, such as /server/information.
 * @param body The request body, sent as JSON.
 * @returns The response body.
 */
export async function callManagementApi<T = unknown>(
	page: Page,
	method: 'GET' | 'POST' | 'DELETE',
	path: string,
	body?: unknown,
): Promise<T> {
	const result = await page.evaluate(
		async (request) => {
			// A variable, so TypeScript does not look for the module: the page's import map resolves it.
			const httpClientModule = '@umbraco-cms/backoffice/http-client';
			const { umbHttpClient } = await import(httpClientModule);
			const { data, error, response } = await umbHttpClient.request({
				method: request.method,
				url: `/umbraco/management/api/v1${request.path}`,
				body: request.body,
				headers: { 'Content-Type': 'application/json' },
				security: [{ scheme: 'bearer', type: 'http' }],
				throwOnError: false,
			});

			return { status: response?.status ?? 0, data, error };
		},
		{ method, path, body },
	);

	if (result.status < 200 || result.status > 299) {
		throw new Error(`${method} ${path} answered ${result.status}: ${JSON.stringify(result.error)}`);
	}

	return result.data as T;
}
