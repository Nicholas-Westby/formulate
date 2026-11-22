import { client } from '../api/client.gen.js';

/** The server address the generated API client uses in tests. */
export const FAKE_API_ORIGIN = 'https://formulate.test';

/**
 * Makes the generated API client send its requests to `respond` instead of the network.
 * @returns The requests, in the order they were sent.
 */
export function fakeApi(respond: (request: Request) => Response | Promise<Response>): Array<Request> {
	const requests: Array<Request> = [];

	client.setConfig({
		baseUrl: FAKE_API_ORIGIN,
		fetch: async (input: RequestInfo | URL) => {
			const request = input instanceof Request ? input : new Request(input);
			requests.push(request);
			return respond(request);
		},
	});

	return requests;
}

/** A JSON response with the given status. */
export function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** A request's path and query string, such as /umbraco/management/api/v1/formulate/config?x=1. */
export function pathAndQuery(request: Request): string {
	const url = new URL(request.url);
	return url.pathname + url.search;
}
