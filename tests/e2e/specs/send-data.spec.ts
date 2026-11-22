import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures/seeded-page.ts';
import {
	cleanUp,
	createForm,
	createPage,
	fieldKind,
	findKinds,
	formEvents,
	formField,
	openBackOffice,
	waitForPage,
	watchPage,
} from '../fixtures/site-forms.ts';
import { readEchoRecords, type EchoRecord } from '../support/echo.ts';
import { transmissionFormats } from '../support/server-constants.ts';
import { runFolderPaths, siteAddresses } from '../support/site-environment.ts';

/** The Send Data handler's kind. */
const SEND_DATA_KIND_ID = 'c76e8d1d-5df2-44cb-8fa2-85c32312d688';
/** The User-Agent Send Data sends, as Formulate 3 did. */
const USER_AGENT = 'Formulate, an Umbraco Form Builder';
const THANK_YOU = 'Thank you, your message was sent.';

/** The pairs of a query string or a form body, in order. */
function pairsOf(text: string): Array<[string, string]> {
	return [...new URLSearchParams(text)];
}

test.use({ actionTimeout: 15_000 });

test("Send Data sends a page's submission to the echo in each transmission format, with the page's absolute URL", async ({
	page,
	context,
	seededPage,
}) => {
	void seededPage;
	test.setTimeout(180_000);
	const formats = transmissionFormats();
	const { origin, plainOrigin } = siteAddresses(process.env.FORMULATE_E2E_PORT);
	const echoFolder = runFolderPaths(process.env.FORMULATE_E2E_RUN_FOLDER!).echo;
	// Each handler sends to a path of its own under this test's, with a query value of the URL's own.
	const run = `/dev/echo/${randomUUID()}/`;
	const echoUrl = (name: string) => `${plainOrigin}${run}${name}?source=e2e`;

	await openBackOffice(page);
	const kinds = await findKinds(page);
	const name = formField(fieldKind(kinds, 'Text'), 'Full name', 'fullName');
	const email = formField(fieldKind(kinds, 'Text'), 'Email', 'email');
	const visit = formField(fieldKind(kinds, 'Date'), 'Visit date', 'visitDate');
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	// As the editor stores them: each field's ID, and the name it is sent with.
	const fields = [
		{ id: name.id, name: 'full_name' },
		{ id: email.id, name: 'email' },
		{ id: visit.id, name: 'date' },
	];
	const handler = (format: string, method: string, path: string) => ({
		kindId: SEND_DATA_KIND_ID,
		name: `Send as ${format}`,
		configuration: { url: echoUrl(path), method, transmissionFormat: format, fields },
	});
	const { formId, layoutId } = await createForm(page, kinds, {
		name: 'Send data test form',
		fields: [name, email, visit, send],
		handlers: [
			handler(formats.QueryString, 'GET', 'query-string'),
			handler(formats.FormBody, 'POST', 'form-body'),
			handler(formats.Json, 'POST', 'json'),
			handler(formats.HubSpotJson, 'POST', 'hubspot-json'),
		],
	});
	const created = await createPage(page, 'Send data test', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);
		const form = site.locator('form.formulate__form');
		await form.getByLabel('Full name').fill('Ada Lovelace');
		await form.getByLabel('Email').fill('ada@example.com');
		await form.getByLabel('Visit date').fill('2026-03-05');
		await form.getByRole('button', { name: 'Send' }).click();
		// The thank-you is on the page, hidden, until the form is sent.
		await expect(site.locator('#thank-you')).toBeVisible();
		await expect(site.locator('#thank-you')).toHaveText(THANK_YOU);
		expect(await formEvents(site)).toEqual({ 'formulate form: submit: success': 1 });
		expect(problems, 'no console errors').toEqual([]);

		// The handlers run before the submission is answered, so each request has arrived.
		await expect.poll(() => readEchoRecords(echoFolder, run).length, { message: 'the echo received each request' }).toBe(4);
		const records = new Map(readEchoRecords(echoFolder, run).map((record) => [record.path.slice(run.length), record]));
		const received = (path: string): EchoRecord => {
			const record = records.get(path);
			expect(record, `the echo received ${path}`).toBeTruthy();
			return record!;
		};
		// Dates are sent as Formulate 3 sent them.
		const sent = [
			['full_name', 'Ada Lovelace'],
			['email', 'ada@example.com'],
			['date', 'March 05, 2026'],
		];

		// Query String: the URL's own value, then the fields, in the query of a GET.
		const queryString = received('query-string');
		expect([queryString.method, pairsOf(queryString.query), queryString.body]).toStrictEqual([
			'GET',
			[['source', 'e2e'], ...sent],
			'',
		]);

		// Form Body: the same pairs in a form body; the URL keeps its own query.
		const formBody = received('form-body');
		expect([formBody.method, formBody.headers['content-type'], pairsOf(formBody.query), pairsOf(formBody.body)]).toStrictEqual([
			'POST',
			'application/x-www-form-urlencoded',
			[['source', 'e2e']],
			[['source', 'e2e'], ...sent],
		]);

		// JSON: an object of the fields.
		const json = received('json');
		expect([json.method, json.headers['content-type'], JSON.parse(json.body)]).toStrictEqual([
			'POST',
			'application/json; charset=utf-8',
			Object.fromEntries(sent),
		]);

		// HubSpot JSON: the fields, and the page the form was sent from, by its absolute URL.
		const hubSpot = received('hubspot-json');
		expect([hubSpot.method, hubSpot.headers['content-type'], JSON.parse(hubSpot.body)]).toStrictEqual([
			'POST',
			'application/json; charset=utf-8',
			{
				fields: sent.map(([fieldName, value]) => ({ name: fieldName, value })),
				context: { pageUri: new URL(created.path, origin).href, pageName: 'Send data test' },
			},
		]);

		// Every request says it is Formulate's, and carries no cookie.
		for (const record of records.values()) {
			expect([record.headers['user-agent'], record.headers.cookie]).toStrictEqual([USER_AGENT, undefined]);
		}
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
	}
});
