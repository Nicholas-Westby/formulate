import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { KINDS, createKindItem } from '../fixtures/formulate-api.ts';
import { callManagementApi, sendFormToManagementApi } from '../fixtures/management-api.ts';
import { SEEDED_PAGE_ID, expect, test } from '../fixtures/seeded-page.ts';
import {
	cleanUp,
	createForm,
	createPage,
	fieldKind,
	findKinds,
	formField,
	waitForPage,
	watchPage,
	type FormField,
	type LayoutRow,
	type SiteKinds,
} from '../fixtures/site-forms.ts';
import { screenshotPath } from '../support/screenshots.ts';

/** The Store Data handler's kind. */
const STORE_DATA_KIND_ID = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';
const THANK_YOU = 'Thank you, your message was sent.';
const EMAIL_REQUIRED = 'Enter your email address.';
const EMAIL_INVALID = 'That does not look like an email address.';
/** The Image media type, which Umbraco's rich text editor picks images of. */
const IMAGE_MEDIA_TYPE_ID = 'cc07b313-0843-4aa8-bbda-871c8da728c8';
/** A blue PNG, 120 by 80 pixels. */
const BLUE_PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAHgAAABQCAIAAABd+SbeAAAAg0lEQVR42u3QQQ0AAAgEoOthQ5vayhbOBxsJSPVwIApEi0a0aNEWRItGtGjRFkSLRrRo0YgWjWjRohEtGtGiRSNaNKJFi0a0aESLFo1o0YgWLRrRohEtWjSiRSNatGhEi0a0aNGIFo1o0aIRLRrRokUjWjSiRYtGtGhEixaNaNGI/mMB95Dv0SDKTaAAAAAASUVORK5CYII=';
/** A label that would end the script block holding the form's data, if it were not escaped. */
const TRICKY_LABEL = 'Note </script><script>window.formulateScriptBroke = true</script>';

interface Submission {
	url: string | null;
	pageId: number | null;
	values: Array<{ fieldName: string; value: string }>;
}

/** Makes a form that stores its submissions, with a Basic layout. Returns their IDs. */
function createStoredForm(page: Page, kinds: SiteKinds, name: string, fields: Array<FormField>, rows: Array<LayoutRow> | undefined) {
	return createForm(page, kinds, {
		name,
		fields,
		handlers: [{ kindId: STORE_DATA_KIND_ID, name: 'Store Data', alias: 'storeData', enabled: true }],
		rows,
	});
}

async function readSubmissions(page: Page, formId: string): Promise<Submission[]> {
	const result = await callManagementApi<{ items: Submission[] }>(page, 'GET', `/formulate/submission?formId=${formId}&take=10`);

	return result.items;
}

/**
 * Opens the form in the form designer and its Intro field's dialog, lets the test edit the Rich Text field's
 * text there, then submits the dialog and saves the form. Returns the text the API stored.
 */
async function editIntro(page: Page, formId: string, edit: (dialog: Locator, text: Locator) => Promise<void>) {
	await page.goto(`/umbraco/section/formulate/workspace/formulate-form/edit/${formId}`);
	await page.locator('formulate-form-fields-workspace-view').getByRole('button', { name: 'Edit Intro', exact: true }).click();
	const dialog = page.locator('formulate-edit-field-modal');
	const text = dialog.locator('umb-input-tiptap [contenteditable="true"]');
	await expect(text).toBeVisible();
	await edit(dialog, text);
	await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith(`/formulate/form/${formId}`));
	await page.locator('umb-workspace-action uui-button[label="Save"]').click();
	expect((await saved).ok()).toBe(true);
	const stored = await callManagementApi<{ fields: Array<{ configuration: { text: string } }> }>(page, 'GET', `/formulate/form/${formId}`);

	return stored.fields[0]!.configuration.text;
}

/**
 * Selects a line of the text in the rich text editor with a triple click, which the editor itself turns into a
 * selection of the line's words. After a single click, the caret was sometimes at the start of the text instead.
 */
async function selectLine(text: Locator, words: string) {
	await text.getByText(words, { exact: true }).click({ clickCount: 3 });
}

/** Uploads a blue PNG, logo.png, and makes an image of it in the media library; returns the media's ID. */
async function createImage(page: Page, name: string) {
	const temporaryFileId = randomUUID();
	// The file is sent as a form, as the Management API takes it.
	await sendFormToManagementApi(page, '/temporary-file', {
		Id: temporaryFileId,
		File: { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(BLUE_PNG, 'base64') },
	});
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/media', {
		id,
		parent: null,
		mediaType: { id: IMAGE_MEDIA_TYPE_ID },
		values: [{ alias: 'umbracoFile', value: { temporaryFileId }, culture: null, segment: null }],
		variants: [{ culture: null, segment: null, name }],
	});

	return id;
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
	const email = formField(fieldKind(kinds, 'Text'), 'Your email', 'yourEmail', { validations: [required, regex] });
	const note = formField(fieldKind(kinds, 'Text'), TRICKY_LABEL, 'note');
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const { formId, layoutId } = await createStoredForm(page, kinds, 'Frontend simple form', [email, note, send], undefined);
	const created = await createPage(page, 'Frontend simple', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);

		// The form shows, with the Basic theme and the renderer's entry module (formulate.min.js, which keeps its URL).
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
		await site.screenshot({ path: screenshotPath('frontend-form.png'), fullPage: true });

		// A label that holds "</script>" shows as it was written, and breaks nothing.
		await expect(form.locator('label', { hasText: 'Note' })).toContainText(TRICKY_LABEL);
		expect(await site.evaluate(() => (window as unknown as { formulateScriptBroke?: boolean }).formulateScriptBroke)).toBeUndefined();

		// Submitting nothing shows the messages from the browser, and sends nothing.
		await form.getByRole('button', { name: 'Send' }).click();
		const emailField = form.locator('.formulate__field', { hasText: 'Your email' });
		await expect(emailField.locator('.formulate__inline-validation-summary')).toContainText(EMAIL_REQUIRED);
		await expect(form.locator('.formulate__validation-summary')).toContainText(EMAIL_REQUIRED);
		await site.screenshot({ path: screenshotPath('frontend-errors.png'), fullPage: true });
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
	const first = formField(fieldKind(kinds, 'Text'), 'First name', 'firstName', { validations: [required] });
	const last = formField(fieldKind(kinds, 'Text'), 'Last name', 'lastName');
	const next = formField(fieldKind(kinds, 'Button'), 'Go on', 'next', { configuration: { buttonKind: 'Next' } });
	const previous = formField(fieldKind(kinds, 'Button'), 'Go back', 'previous', { configuration: { buttonKind: 'Previous' } });
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const row = (...ids: string[]) => ({ isStep: false, cells: [{ columnSpan: 12, fields: ids.map((id) => ({ id })) }] });
	const { formId, layoutId } = await createStoredForm(
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
		await site.screenshot({ path: screenshotPath('frontend-steps.png'), fullPage: true });

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

test("a Rich Text field's text edited in its dialog is stored as the editor writes it, and shows on the page", async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	const kinds = await findKinds(page);
	const intro = formField(fieldKind(kinds, 'Rich Text'), 'Intro', 'intro', { configuration: { text: '<p>Welcome to our form.</p>' } });
	const { formId, layoutId } = await createStoredForm(page, kinds, 'Frontend rich text form', [intro], undefined);
	const created = await createPage(page, 'Frontend rich text', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		const stored = await editIntro(page, formId, async (_dialog, text) => {
			await selectLine(text, 'Welcome to our form.');
			await page.keyboard.type('Welcome. Ask us anything.');
		});
		expect(stored).toBe('<p>Welcome. Ask us anything.</p>');

		await waitForPage(site, created.path);
		await site.goto(created.path);
		await expect(site.locator('.formulate__field--rich-text')).toHaveText('Welcome. Ask us anything.');
		expect(problems, 'no console errors').toEqual([]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
	}
});

test("a link to a content page, picked in a Rich Text field's editor, takes visitors to that page", async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	const kinds = await findKinds(page);
	const intro = formField(fieldKind(kinds, 'Rich Text'), 'Intro', 'intro', {
		configuration: { text: '<p>Welcome to our form.</p><p>Contact us</p>' },
	});
	const { formId, layoutId } = await createStoredForm(page, kinds, 'Frontend rich text link form', [intro], undefined);
	const created = await createPage(page, 'Frontend rich text link', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		const stored = await editIntro(page, formId, async (dialog, text) => {
			await selectLine(text, 'Contact us');
			await dialog.getByRole('button', { name: 'Link', exact: true }).click();
			const linkPicker = page.locator('umb-link-picker-modal');
			await linkPicker.getByRole('button', { name: 'Content', exact: true }).click();
			const documentPicker = page.locator('umb-document-link-picker-modal');
			await documentPicker.getByText('Contact Us', { exact: true }).click();
			await documentPicker.getByRole('button', { name: 'Choose', exact: true }).click();
			await linkPicker.getByRole('button', { name: 'Add', exact: true }).click();
			await expect(linkPicker).toHaveCount(0);
			await expect(text.getByRole('link', { name: 'Contact us', exact: true })).toBeVisible();
			await page.screenshot({ path: screenshotPath('rich-text-editor.png'), animations: 'disabled' });
		});
		// As Umbraco's rich text editor writes a link to a content page: by the page's key, for the site to resolve.
		expect(stored).toContain(`href="/{localLink:${SEEDED_PAGE_ID}}"`);

		await waitForPage(site, created.path);
		await site.goto(created.path);
		const link = site.locator('.formulate__field--rich-text').getByRole('link', { name: 'Contact us', exact: true });
		await expect(link).toHaveAttribute('href', '/');
		await link.click();
		await expect(site.locator('h1')).toHaveText('Contact Us');
		expect(new URL(site.url()).pathname).toBe('/');
		expect(problems, 'no console errors').toEqual([]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
	}
});

test("an image picked from the media library in a Rich Text field's editor shows on the page", async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	const kinds = await findKinds(page);
	const mediaId = await createImage(page, 'Frontend logo');
	const intro = formField(fieldKind(kinds, 'Rich Text'), 'Intro', 'intro', {
		configuration: { text: '<p>Welcome to our form.</p><p>Logo</p>' },
	});
	const { formId, layoutId } = await createStoredForm(page, kinds, 'Frontend rich text image form', [intro], undefined);
	const created = await createPage(page, 'Frontend rich text image', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		const stored = await editIntro(page, formId, async (dialog, text) => {
			// The image takes the place of the selected word.
			await selectLine(text, 'Logo');
			await dialog.getByRole('button', { name: 'Media Picker', exact: true }).click();
			const mediaPicker = page.locator('umb-media-picker-modal');
			await mediaPicker.locator('uui-card-media[title="Frontend logo"]').click();
			await mediaPicker.getByRole('button', { name: 'Choose', exact: true }).click();
			const details = page.locator('umb-media-caption-alt-text-modal');
			const altText = details.getByRole('textbox', { name: 'alt text' });
			// The dialog puts the media's name in the box once it has loaded the media. If that lands while the test
			// types, the box keeps both, as "Frontend logoOur logo".
			await expect(altText).toHaveValue('Frontend logo');
			await altText.fill('Our logo');
			await details.getByRole('button', { name: 'Submit', exact: true }).click();
			await expect(text.getByRole('img', { name: 'Our logo', exact: true })).toBeVisible();
		});
		// As Umbraco's rich text editor writes an image from the media library: with the media's key.
		expect(stored).toContain(`data-udi="umb://media/${mediaId.replaceAll('-', '')}"`);

		await waitForPage(site, created.path);
		await site.goto(created.path);
		const image = site.locator('.formulate__field--rich-text').getByRole('img', { name: 'Our logo', exact: true });
		// At the media's own address on the site, as Umbraco shows an image of its own rich text.
		await expect(image).toHaveAttribute('src', /^\/media\/[^/]+\/logo\.png\?/);
		await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth)).toBe(120);
		expect(problems, 'no console errors').toEqual([]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId], mediaIds: [mediaId] });
	}
});
