import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { KINDS, createKindItem } from '../fixtures/formulate-api.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { expect, test } from '../fixtures/seeded-page.ts';

const SCREENSHOTS = join(import.meta.dirname, '..', 'screenshots');

/** The seed's document type (src/Website/Seed), which shows the form its "form" property picks. */
const DOCUMENT_TYPE_ID = '5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a02';
/** The Store Data handler's kind. */
const STORE_DATA_KIND_ID = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';
const THANK_YOU = 'Thank you, your message was sent.';
const EMAIL_REQUIRED = 'Enter your email address.';
const EMAIL_INVALID = 'That does not look like an email address.';
/** A label that would end the script block holding the form's data, if it were not escaped. */
const TRICKY_LABEL = 'Note </script><script>window.formulateScriptBroke = true</script>';

interface KindDefinition {
	kindId: string;
	name: string;
	isHidden?: boolean;
	isServerSideOnly?: boolean;
	isLegacy?: boolean;
	defaultConfiguration?: unknown;
}

interface SeedKinds {
	text: KindDefinition;
	button: KindDefinition;
	basicLayoutKindId: string;
	formKindId: string;
	templateId: string;
}

interface Submission {
	url: string | null;
	pageId: number | null;
	values: Array<{ fieldName: string; value: string }>;
}

async function findKinds(page: Page): Promise<SeedKinds> {
	const [fieldKinds, layoutKinds, templates, formOptions] = await Promise.all([
		callManagementApi<Array<KindDefinition>>(page, 'GET', '/formulate/definition/form-field'),
		callManagementApi<Array<KindDefinition>>(page, 'GET', '/formulate/definition/layout'),
		callManagementApi<Array<{ id: string; isDefault: boolean }>>(page, 'GET', '/formulate/definition/template'),
		callManagementApi<Array<{ entityType: string; kindId?: string; name: string }>>(
			page,
			'GET',
			'/formulate/tree/forms/create-options',
		),
	]);
	const text = fieldKinds.find((kind) => kind.name.toLowerCase() === 'text');
	const button = fieldKinds.find((kind) => kind.name.toLowerCase() === 'button');
	const layout = layoutKinds.find((kind) => !kind.isLegacy && /basic/i.test(kind.name));
	const form = formOptions.find((option) => option.entityType === 'formulate-form' && option.name === 'Form');
	const template = templates.find((candidate) => candidate.isDefault) ?? templates[0];
	expect(text, 'a Text field kind exists').toBeTruthy();
	expect(button, 'a Button field kind exists').toBeTruthy();
	expect(layout, 'the Basic layout kind exists').toBeTruthy();
	expect(form?.kindId, 'the Forms root offers the plain Form kind').toBeTruthy();
	expect(template, 'a template exists').toBeTruthy();

	return {
		text: text!,
		button: button!,
		basicLayoutKindId: layout!.kindId,
		formKindId: form!.kindId!,
		templateId: template!.id,
	};
}

function field(kind: KindDefinition, name: string, alias: string, options: { validations?: string[]; configuration?: unknown } = {}) {
	return {
		id: randomUUID(),
		kindId: kind.kindId,
		name,
		alias,
		label: name,
		validations: options.validations ?? [],
		...(options.configuration ?? kind.defaultConfiguration
			? { configuration: options.configuration ?? kind.defaultConfiguration }
			: {}),
	};
}

/** Makes a form that stores its submissions, with a Basic layout. Returns their IDs. */
async function createForm(
	page: Page,
	kinds: SeedKinds,
	name: string,
	fields: Array<ReturnType<typeof field>>,
	rows: Array<{ isStep: boolean; cells: Array<{ columnSpan: number; fields: Array<{ id: string }> }> }> | undefined,
) {
	const formId = randomUUID();
	const layoutId = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', {
		id: formId,
		kindId: kinds.formKindId,
		name,
		fields,
		handlers: [{ id: randomUUID(), kindId: STORE_DATA_KIND_ID, name: 'Store Data', alias: 'storeData', enabled: true }],
	});
	await callManagementApi(page, 'POST', '/formulate/layout', {
		id: layoutId,
		formId,
		kindId: kinds.basicLayoutKindId,
		name: `${name} layout`,
		templateId: kinds.templateId,
		configuration: { autoPopulate: rows === undefined, rows: rows ?? [] },
	});

	return { formId, layoutId };
}

/** Makes a published page of the seeded document type that shows the layout, and returns its ID and path. */
async function createPage(page: Page, name: string, layoutId: string) {
	const documentType = await callManagementApi<{ defaultTemplate?: { id: string } | null }>(
		page,
		'GET',
		`/document-type/${DOCUMENT_TYPE_ID}`,
	);
	expect(documentType.defaultTemplate?.id, 'the seeded document type has a template').toBeTruthy();
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/document', {
		id,
		parent: null,
		documentType: { id: DOCUMENT_TYPE_ID },
		template: { id: documentType.defaultTemplate!.id },
		values: [{ alias: 'form', value: { id: layoutId }, culture: null, segment: null }],
		variants: [{ culture: null, segment: null, name }],
	});
	await callManagementApi(page, 'PUT', `/document/${id}/publish`, { publishSchedules: [{ culture: null }] });

	return { id, path: `/${name.toLowerCase().replaceAll(' ', '-')}/` };
}

/** Moves the page to the recycle bin and deletes the form's items, ignoring what is already gone. */
async function cleanUp(page: Page, items: { documentIds: string[]; formIds: string[]; validationIds: string[] }) {
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	for (const id of items.documentIds) {
		await callManagementApi(page, 'PUT', `/document/${id}/move-to-recycle-bin`).catch(() => undefined);
	}
	for (const id of items.formIds) {
		await callManagementApi(page, 'DELETE', `/formulate/form/${id}`).catch(() => undefined);
	}
	for (const id of items.validationIds) {
		await callManagementApi(page, 'DELETE', `/formulate/validation/${id}`).catch(() => undefined);
	}
}

/** Records the page's console errors and uncaught errors, and the form's events. */
async function watchPage(site: Page) {
	const problems: string[] = [];
	site.on('console', (message) => {
		if (message.type() === 'error') {
			problems.push(`console: ${message.text()}`);
		}
	});
	site.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
	await site.addInitScript(() => {
		const events: Record<string, number> = {};
		(window as unknown as { formulateEvents: Record<string, number> }).formulateEvents = events;
		for (const name of ['formulate form: submit: success', 'formulate form: submit: failure']) {
			document.addEventListener(name, () => {
				events[name] = (events[name] ?? 0) + 1;
			});
		}
	});

	return problems;
}

async function waitForPage(site: Page, path: string) {
	await expect
		.poll(async () => (await site.request.get(path)).text(), { message: `${path} is published` })
		.toContain('formulate-plain-js-forms');
}

/** Opens the back office, so the Management API can be called from the page. */
async function openBackOffice(page: Page) {
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
}

async function readSubmissions(page: Page, formId: string): Promise<Submission[]> {
	const result = await callManagementApi<{ items: Submission[] }>(page, 'GET', `/formulate/submission?formId=${formId}&take=10`);

	return result.items;
}

test.use({ actionTimeout: 15_000 });

test('a form renders with the theme, validates in the browser, and its submission is stored', async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	const kinds = await findKinds(page);
	const required = await createKindItem(page, 'validation', {
		name: 'Frontend required',
		kindId: KINDS.mandatory,
		configuration: { message: EMAIL_REQUIRED },
	});
	const regex = await createKindItem(page, 'validation', {
		name: 'Frontend email',
		kindId: KINDS.regex,
		configuration: { regex: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', message: EMAIL_INVALID },
	});
	const email = field(kinds.text, 'Your email', 'yourEmail', { validations: [required, regex] });
	const note = field(kinds.text, TRICKY_LABEL, 'note');
	const send = field(kinds.button, 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const { formId, layoutId } = await createForm(page, kinds, 'Frontend simple form', [email, note, send], undefined);
	const created = await createPage(page, 'Frontend simple', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);

		// The form shows, with the Basic theme and the renderer's script (named by a content hash).
		const form = site.locator('form.formulate__form');
		await expect(form).toBeVisible();
		const themeLink = site.locator('link[rel="stylesheet"][href*="basic"]');
		await expect(themeLink).toHaveCount(1);
		const themeResponse = await site.request.get((await themeLink.getAttribute('href'))!);
		expect(themeResponse.ok(), 'the theme stylesheet is served').toBe(true);
		// Values the Basic theme sets (its black border and its grey shadow, in settings/_colors.scss and _shadows.scss).
		const themedButton = await form.getByRole('button', { name: 'Send' }).evaluate((button) => {
			const style = getComputedStyle(button);
			return { border: style.borderTopColor, shadow: style.boxShadow };
		});
		expect(themedButton.border, 'the theme gives the button its black border').toBe('rgb(0, 0, 0)');
		expect(themedButton.shadow, 'the theme gives the button a shadow').not.toBe('none');
		await site.screenshot({ path: join(SCREENSHOTS, 'frontend-form.png'), fullPage: true });

		// A label that holds "</script>" shows as it was written, and breaks nothing.
		await expect(form.locator('label', { hasText: 'Note' })).toContainText(TRICKY_LABEL);
		expect(await site.evaluate(() => (window as unknown as { formulateScriptBroke?: boolean }).formulateScriptBroke)).toBeUndefined();

		// Submitting nothing shows the messages from the browser, and sends nothing.
		await form.getByRole('button', { name: 'Send' }).click();
		const emailField = form.locator('.formulate__field', { hasText: 'Your email' });
		await expect(emailField.locator('.formulate__inline-validation-summary')).toContainText(EMAIL_REQUIRED);
		await expect(form.locator('.formulate__validation-summary')).toContainText(EMAIL_REQUIRED);
		await site.screenshot({ path: join(SCREENSHOTS, 'frontend-errors.png'), fullPage: true });
		expect(await site.evaluate(() => (window as unknown as { formulateEvents: object }).formulateEvents)).toEqual({});

		// An email that does not match the pattern shows the pattern's message.
		await form.getByLabel('Your email').fill('not-an-email');
		await form.getByRole('button', { name: 'Send' }).click();
		await expect(emailField.locator('.formulate__inline-validation-summary')).toContainText(EMAIL_INVALID);
		await expect(emailField.locator('.formulate__inline-validation-summary')).not.toContainText(EMAIL_REQUIRED);
		await expect(site.locator('#thank-you')).toBeHidden();

		// A valid email is sent: the success event fires, and the page shows its own thank-you.
		await form.getByLabel('Your email').fill('visitor@example.com');
		await form.getByLabel('Note').fill('Hello');
		await form.getByRole('button', { name: 'Send' }).click();
		await expect(site.locator('#thank-you')).toBeVisible();
		await expect(site.locator('#thank-you')).toHaveText(THANK_YOU);
		expect(await site.evaluate(() => (window as unknown as { formulateEvents: object }).formulateEvents)).toEqual({
			'formulate form: submit: success': 1,
		});
		expect(problems, 'no console errors').toEqual([]);

		// Store Data kept one row, with the values, and the URL of the page it was sent from.
		await openBackOffice(page);
		await expect.poll(async () => (await readSubmissions(page, formId)).length).toBe(1);
		const [submission] = await readSubmissions(page, formId);
		expect(submission!.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fieldName: 'Your email', value: 'visitor@example.com' }),
				expect.objectContaining({ fieldName: TRICKY_LABEL, value: 'Hello' }),
			]),
		);
		expect(submission!.pageId, 'the row records the page').not.toBeNull();
		expect(new URL(submission!.url!, site.url()).href).toBe(new URL(created.path, site.url()).href);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId], validationIds: [required, regex] });
	}
});

test('a multi-step form moves between its steps and is stored when it is sent', async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	const kinds = await findKinds(page);
	const required = await createKindItem(page, 'validation', {
		name: 'Frontend steps required',
		kindId: KINDS.mandatory,
		configuration: { message: 'Enter your first name.' },
	});
	const first = field(kinds.text, 'First name', 'firstName', { validations: [required] });
	const last = field(kinds.text, 'Last name', 'lastName');
	const next = field(kinds.button, 'Go on', 'next', { configuration: { buttonKind: 'Next' } });
	const previous = field(kinds.button, 'Go back', 'previous', { configuration: { buttonKind: 'Previous' } });
	const send = field(kinds.button, 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const row = (...ids: string[]) => ({ isStep: false, cells: [{ columnSpan: 12, fields: ids.map((id) => ({ id })) }] });
	const { formId, layoutId } = await createForm(
		page,
		kinds,
		'Frontend steps form',
		[first, last, next, previous, send],
		[row(first.id), row(next.id), { isStep: true, cells: [] }, row(last.id), row(previous.id, send.id)],
	);
	const created = await createPage(page, 'Frontend steps', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);

		const form = site.locator('form.formulate__form');
		const steps = form.locator('section.formulate__step');
		await expect(steps).toHaveCount(2);
		// The renderer hides the inactive step itself (the attribute, not only the theme's styles).
		await expect(steps.nth(0)).not.toHaveAttribute('hidden');
		await expect(steps.nth(1)).toHaveAttribute('hidden');
		await expect(steps.nth(1)).toBeHidden();

		// The first step has to be valid before the form moves on.
		await form.getByRole('button', { name: 'Go on' }).click();
		await expect(steps.nth(0).locator('.formulate__inline-validation-summary')).toContainText('Enter your first name.');
		await expect(steps.nth(0)).toBeVisible();
		await expect(steps.nth(1)).toBeHidden();

		await form.getByLabel('First name').fill('Ada');
		await form.getByRole('button', { name: 'Go on' }).click();
		await expect(steps.nth(1)).toBeVisible();
		await expect(steps.nth(1)).not.toHaveAttribute('hidden');
		await expect(steps.nth(0)).toBeHidden();
		await expect(steps.nth(0)).toHaveAttribute('hidden');
		await site.screenshot({ path: join(SCREENSHOTS, 'frontend-steps.png'), fullPage: true });

		// Back keeps what was typed.
		await form.getByRole('button', { name: 'Go back' }).click();
		await expect(steps.nth(0)).toBeVisible();
		await expect(steps.nth(1)).toBeHidden();
		await expect(form.getByLabel('First name')).toHaveValue('Ada');
		await form.getByRole('button', { name: 'Go on' }).click();
		await expect(steps.nth(1)).toBeVisible();

		await form.getByLabel('Last name').fill('Lovelace');
		await form.getByRole('button', { name: 'Send' }).click();
		await expect(site.locator('#thank-you')).toBeVisible();
		await expect(site.locator('#thank-you')).toHaveText(THANK_YOU);
		expect(await site.evaluate(() => (window as unknown as { formulateEvents: object }).formulateEvents)).toEqual({
			'formulate form: submit: success': 1,
		});
		expect(problems, 'no console errors').toEqual([]);

		await openBackOffice(page);
		await expect.poll(async () => (await readSubmissions(page, formId)).length).toBe(1);
		const [submission] = await readSubmissions(page, formId);
		expect(submission!.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fieldName: 'First name', value: 'Ada' }),
				expect.objectContaining({ fieldName: 'Last name', value: 'Lovelace' }),
			]),
		);
		expect(new URL(submission!.url!, site.url()).href).toBe(new URL(created.path, site.url()).href);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId], validationIds: [required] });
	}
});
