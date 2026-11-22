import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
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
import { siteAddresses } from '../support/site-environment.ts';

/** The Store Data handler's kind. */
const STORE_DATA_KIND_ID = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';
/** The "Form with Basic Layout" kind of form, which the Forms tree's create dialog offers. */
const BASIC_LAYOUT_FORM_KIND_ID = '3a11bd58-0ac6-43d7-8f63-2f88e7c132af';
const THANK_YOU = 'Thank you, your message was sent.';
/** The small text file a visitor sends, with characters outside ASCII, so only the same bytes match it. */
const NOTES = Buffer.from('Notes for the team.\nCafé at 10:00, naïve plan ☕\n', 'utf8');
/** The UTF-8 byte order mark the CSV export starts with, so Excel reads it as UTF-8. */
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** A submission, as the submissions API gives it. */
interface Submission {
	id: string;
	creationDate: string;
	pageId: number | null;
	url: string | null;
	values: Array<{ fieldId: string; fieldName: string; value: string }>;
	files: Array<{ fieldId: string; fieldName: string; fileName: string }>;
}

function readSubmissions(page: Page, formId: string) {
	return callManagementApi<{ total: number; items: Array<Submission> }>(page, 'GET', `/formulate/submission?formId=${formId}&take=10`);
}

/** Sends the form from its page, as a visitor does, and waits for the page's thank-you. */
async function sendForm(site: Page, path: string, values: { name: string; email: string; file?: { name: string; buffer: Buffer } }) {
	await site.goto(path);
	const form = site.locator('form.formulate__form');
	await form.getByLabel('Name', { exact: true }).fill(values.name);
	await form.getByLabel('Email', { exact: true }).fill(values.email);

	if (values.file) {
		await form.getByLabel('Attachment', { exact: true }).setInputFiles({ ...values.file, mimeType: 'text/plain' });
	}

	await form.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(site.locator('#thank-you')).toBeVisible();
	await expect(site.locator('#thank-you')).toHaveText(THANK_YOU);
}

/** The text of each cell of each row of a table, in order. */
function cellsOf(table: Locator) {
	return table
		.locator('uui-table-row')
		.evaluateAll((rows) =>
			rows.map((row) => [...row.querySelectorAll('uui-table-cell')].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim())),
		);
}

/** A date as the back office's own tables show it: in the user's language (en-US for the E2E user), in the browser. */
function shownDate(page: Page, iso: string) {
	return page.evaluate((date) => new Date(date).toLocaleString('en-us'), iso);
}

/** Deletes a form's submissions through the API: the form's own delete leaves them, as they outlive their form. */
async function deleteSubmissions(page: Page, formId: string) {
	const { items } = await readSubmissions(page, formId);

	for (const submission of items) {
		await callManagementApi(page, 'DELETE', `/formulate/submission/${submission.id}`);
	}
}

test.use({ actionTimeout: 15_000 });

test('the Submissions view lists what visitors sent, newest first, opens each with its files, exports them and deletes one', async ({
	page,
	context,
	seededPage,
}) => {
	void seededPage;
	test.setTimeout(180_000);
	const { origin } = siteAddresses(process.env.FORMULATE_E2E_PORT);
	await openBackOffice(page);

	// A form that is not saved yet has no submissions, so it has no Submissions view.
	await page.goto(`/umbraco/section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${BASIC_LAYOUT_FORM_KIND_ID}`);
	const editor = page.locator('umb-workspace-editor');
	await expect(editor.getByRole('tab', { name: 'Fields', exact: true })).toBeVisible();
	await expect(editor.getByRole('tab', { name: 'Handlers', exact: true })).toBeVisible();
	await expect(editor.getByRole('tab')).toHaveCount(2);

	const kinds = await findKinds(page);
	const name = formField(fieldKind(kinds, 'Text'), 'Name', 'name');
	const email = formField(fieldKind(kinds, 'Text'), 'Email', 'email');
	const attachment = formField(fieldKind(kinds, 'Upload'), 'Attachment', 'attachment');
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const { formId, layoutId } = await createForm(page, kinds, {
		name: 'Submissions test form',
		fields: [name, email, attachment, send],
		handlers: [{ kindId: STORE_DATA_KIND_ID, name: 'Store Data', alias: 'storeData' }],
	});
	const site = await context.newPage();
	let pageId: string | undefined;

	try {
		const created = await createPage(page, 'Submissions test', layoutId);
		pageId = created.id;
		const pageUrl = new URL(created.path, origin).href;
		const problems = await watchPage(site);

		// Two visitors send the form from its page: the first with a file, the second without one.
		await waitForPage(site, created.path);
		await sendForm(site, created.path, { name: 'Ada Lovelace', email: 'ada@example.com', file: { name: 'notes.txt', buffer: NOTES } });
		await sendForm(site, created.path, { name: 'Grace Hopper', email: 'grace@example.com' });
		expect(problems, 'no console errors').toEqual([]);

		// Store Data kept both, newest first, each with the URL of the page it was sent from.
		const stored = await readSubmissions(page, formId);
		expect(stored.total).toBe(2);
		const [grace, ada] = stored.items;
		expect(grace!.values.find((value) => value.fieldId === name.id)?.value).toBe('Grace Hopper');
		expect(ada!.values.find((value) => value.fieldId === name.id)?.value).toBe('Ada Lovelace');
		expect(ada!.files).toEqual([{ fieldId: attachment.id, fieldName: 'Attachment', fileName: 'notes.txt' }]);
		expect([ada!.url, grace!.url]).toEqual([pageUrl, pageUrl]);
		expect(ada!.pageId, 'the row records the page').toEqual(expect.any(Number));

		// The form's Submissions view lists them: Created, Page, the fields that store a value (not the upload or the
		// button), Files, and the row's actions.
		await page.goto(`/umbraco/section/formulate/workspace/formulate-form/edit/${formId}`);
		await editor.getByRole('tab', { name: 'Submissions', exact: true }).click();
		const view = page.locator('formulate-form-submissions-workspace-view');
		const table = view.locator('umb-table');
		await expect(table.locator('uui-table-row')).toHaveCount(2);
		await expect(table.locator('uui-table-head-cell')).toHaveText(['Created', 'Page', 'Name', 'Email', 'Files', '']);
		const [graceDate, adaDate] = [await shownDate(page, grace!.creationDate), await shownDate(page, ada!.creationDate)];
		expect(await cellsOf(table)).toEqual([
			[graceDate, '/submissions-test/', 'Grace Hopper', 'grace@example.com', '', ''],
			[adaDate, '/submissions-test/', 'Ada Lovelace', 'ada@example.com', 'notes.txt', ''],
		]);
		// The page is the real page the form was sent from (its URL as Store Data recorded it), and opens in a new tab.
		const pageLinks = table.getByRole('link', { name: '/submissions-test/', exact: true });
		await expect(pageLinks).toHaveCount(2);
		await expect(pageLinks.first()).toHaveAttribute('href', pageUrl);
		await expect(pageLinks.first()).toHaveAttribute('target', '_blank');
		// Each row's actions are named after the row.
		const adaRow = table.locator('uui-table-row', { hasText: 'Ada Lovelace' });
		const graceRow = table.locator('uui-table-row', { hasText: 'Grace Hopper' });
		await expect(adaRow.getByRole('button', { name: `Open the submission from ${adaDate}`, exact: true })).toBeVisible();
		await expect(graceRow.getByRole('button', { name: `Delete the submission from ${graceDate}`, exact: true })).toBeVisible();
		await page.screenshot({ path: screenshotPath('submissions.png'), animations: 'disabled' });

		// A click on a row opens the submission in a sidebar, with every value in the form's order and its file.
		await adaRow.getByText('ada@example.com', { exact: true }).click();
		const sidebar = page.locator('formulate-submission-modal');
		await expect(sidebar.locator('umb-body-layout')).toHaveAttribute('headline', `Submission from ${adaDate}`);
		const properties = sidebar.locator('umb-property-layout');
		await expect(properties).toHaveCount(4);
		expect(await properties.evaluateAll((items) => items.map((item) => item.getAttribute('label')))).toEqual([
			'Page',
			'Name',
			'Email',
			'Attachment',
		]);
		await expect(sidebar.locator('umb-property-layout[label="Page"]').getByRole('link', { name: '/submissions-test/' })).toHaveAttribute(
			'href',
			pageUrl,
		);
		await expect(sidebar.locator('umb-property-layout[label="Name"] .value')).toHaveText('Ada Lovelace');
		await expect(sidebar.locator('umb-property-layout[label="Email"] .value')).toHaveText('ada@example.com');
		await page.screenshot({ path: screenshotPath('submission.png'), animations: 'disabled' });

		// Its download gives the file the visitor sent, byte for byte, under the name Store Data gave it.
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			sidebar.getByRole('button', { name: 'Download notes.txt', exact: true }).click(),
		]);
		expect(download.suggestedFilename()).toBe('notes.txt');
		expect(readFileSync(await download.path())).toEqual(NOTES);
		await sidebar.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(sidebar).toHaveCount(0);

		// The export has a header and a row for each submission, newest first, with the page and the file's name.
		const [csv] = await Promise.all([page.waitForEvent('download'), view.getByRole('button', { name: 'Export to CSV', exact: true }).click()]);
		expect(csv.suggestedFilename()).toBe('submissions.csv');
		const bytes = readFileSync(await csv.path());
		expect(bytes.subarray(0, 3)).toEqual(BOM);
		const utc = (submission: Submission) => `${submission.creationDate.slice(0, 19)}Z`;
		expect(bytes.subarray(3).toString('utf8').split('\r\n')).toEqual([
			'Submission Id,Created,Page Id,URL,Name,Email,Attachment,Send',
			`${grace!.id},${utc(grace!)},${grace!.pageId},${pageUrl},Grace Hopper,grace@example.com,,`,
			`${ada!.id},${utc(ada!)},${ada!.pageId},${pageUrl},Ada Lovelace,ada@example.com,notes.txt,`,
			'',
		]);

		// Deleting a row asks first, in the danger colour, then leaves the other row; the API agrees.
		await graceRow.getByRole('button', { name: `Delete the submission from ${graceDate}`, exact: true }).click();
		const confirm = page.locator('umb-confirm-modal');
		await expect(confirm).toContainText(`the submission from ${graceDate}`);
		await expect(confirm.locator('uui-button[color="danger"]')).toHaveAttribute('label', 'Delete');
		await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(table.locator('uui-table-row')).toHaveCount(1);
		expect(await cellsOf(table)).toEqual([[adaDate, '/submissions-test/', 'Ada Lovelace', 'ada@example.com', 'notes.txt', '']]);
		const left = await readSubmissions(page, formId);
		expect(left.total).toBe(1);
		expect(left.items.map((submission) => submission.id)).toEqual([ada!.id]);
	} finally {
		await site.close();
		await openBackOffice(page);
		await deleteSubmissions(page, formId).catch(() => undefined);
		await cleanUp(page, { documentIds: pageId ? [pageId] : [], formIds: [formId] });
	}
});
