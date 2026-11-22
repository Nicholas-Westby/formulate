import type { Page, Response } from '@playwright/test';
import { KINDS, createKindItem } from '../fixtures/formulate-api.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { expect, test } from '../fixtures/seeded-page.ts';
import {
	cleanUp,
	createForm,
	createPage,
	fieldKind,
	findKinds,
	formField,
	openBackOffice,
	waitForPage,
	watchPage,
} from '../fixtures/site-forms.ts';
import { screenshotPath } from '../support/screenshots.ts';

// The dev site's sample custom field (src/Website/SampleFields): a Phone field, with a C# definition and map, and
// a renderer (src/Website/wwwroot/scripts/phone-field.js) that imports Formulate's API by its public URL and
// extends the built-in text renderer. The documentation shows the same code.

/** The Store Data handler's kind. */
const STORE_DATA_KIND_ID = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';
const PHONE_REQUIRED = 'Enter your phone number.';
/** The folder of the renderer's files. */
const RENDERER_FOLDER = '/App_Plugins/Formulate/PlainJavaScript/';
const SAMPLE_RENDERER = '/scripts/phone-field.js';

interface Submission {
	values: Array<{ fieldName: string; value: string }>;
}

async function readSubmissions(page: Page, formId: string): Promise<Submission[]> {
	const result = await callManagementApi<{ items: Submission[] }>(page, 'GET', `/formulate/submission?formId=${formId}&take=10`);

	return result.items;
}

test.use({ actionTimeout: 15_000 });

test('a custom field renderer built on a built-in one renders, validates and is stored, from modules that load once', async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	await openBackOffice(page);
	const kinds = await findKinds(page);
	const required = await createKindItem(page, 'validation', {
		name: 'Custom renderer required',
		kindId: KINDS.mandatory,
		configuration: { message: PHONE_REQUIRED },
	});
	const phone = formField(fieldKind(kinds, 'Phone'), 'Phone', 'phone', { validations: [required] });
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const { formId, layoutId } = await createForm(page, kinds, {
		name: 'Custom renderer form',
		fields: [phone, send],
		handlers: [{ kindId: STORE_DATA_KIND_ID, name: 'Store Data', alias: 'storeData', enabled: true }],
	});
	const created = await createPage(page, 'Custom renderer', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);
	// The responses for the renderer's files and the sample's renderer, as the page loads them.
	const responses: Response[] = [];
	site.on('response', (response) => {
		const path = new URL(response.url()).pathname;
		if (path.startsWith(RENDERER_FOLDER) || path === SAMPLE_RENDERER) {
			responses.push(response);
		}
	});

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);
		const form = site.locator('form.formulate__form');
		await expect(form).toBeVisible();

		// The Phone field is the sample's renderer: the built-in text field's markup, with the input type "tel".
		const field = form.locator('.formulate__field--phone');
		const input = form.getByLabel('Phone');
		await expect(input).toHaveAttribute('type', 'tel');
		await expect(input).toHaveAttribute('placeholder', 'Phone');
		await expect(field).toHaveClass(/formulate__validation-type--required/);

		// Its validation shows in the browser, from the base class.
		await form.getByRole('button', { name: 'Send' }).click();
		await expect(field.locator('.formulate__inline-validation-summary')).toContainText(PHONE_REQUIRED);
		await expect(input).toHaveAttribute('aria-invalid', 'true');
		await expect(form.locator('.formulate__validation-summary')).toContainText(PHONE_REQUIRED);
		await site.screenshot({ path: screenshotPath('custom-renderer-errors.png'), fullPage: true });

		// It is sent, and the page shows its thank-you.
		await input.fill('+1 555 0100');
		await form.getByRole('button', { name: 'Send' }).click();
		await expect(site.locator('#thank-you')).toBeVisible();
		expect(problems, 'no console errors').toEqual([]);

		// The view loads the renderer as a module, after a preload link for each of its modules, in the order of the
		// list the build wrote (the entry first).
		const modules = (await (await site.request.get(`${RENDERER_FOLDER}modules.json`)).json()) as string[];
		expect(modules[0]).toBe('formulate.min.js');
		expect(modules).toContain('api.min.js');
		const preloads = await site.locator('link[rel="modulepreload"]').evaluateAll((links) => links.map((x) => x.getAttribute('href')));
		expect(preloads).toEqual(modules.map((x) => `${RENDERER_FOLDER}${x}`));
		await expect(site.locator(`script[type="module"][src="${RENDERER_FOLDER}formulate.min.js"]`)).toHaveCount(1);
		await expect(site.locator(`script[type="module"][src="${SAMPLE_RENDERER}"]`)).toHaveCount(1);

		// Each file was asked for once (the sample's import of api.min.js is the renderer's own copy), with no
		// version in its URL. The renderer's files come with Cache-Control: no-cache, and the scripts as JavaScript.
		const urls = responses.map((x) => new URL(x.url()));
		const paths = urls.map((x) => x.pathname);
		expect(urls.filter((x) => x.search !== ''), 'no URL has a query string').toEqual([]);
		expect(paths.filter((x, i) => paths.indexOf(x) !== i), 'no file is asked for twice').toEqual([]);
		expect([...paths].sort()).toEqual(
			[...modules.map((x) => `${RENDERER_FOLDER}${x}`), `${RENDERER_FOLDER}themes/basic.min.css`, SAMPLE_RENDERER].sort(),
		);
		for (const response of responses) {
			const path = new URL(response.url()).pathname;
			expect(response.status(), path).toBe(200);
			if (path.endsWith('.js')) {
				expect(response.headers()['content-type'], path).toMatch(/^text\/javascript/);
			}
			if (path.startsWith(RENDERER_FOLDER)) {
				expect(response.headers()['cache-control'], path).toBe('no-cache');
			}
		}

		// Store Data kept the value.
		await openBackOffice(page);
		await expect.poll(async () => (await readSubmissions(page, formId)).length).toBe(1);
		const [submission] = await readSubmissions(page, formId);
		expect(submission!.values).toEqual(expect.arrayContaining([expect.objectContaining({ fieldName: 'Phone', value: '+1 555 0100' })]));
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId], validationIds: [required] });
	}
});
