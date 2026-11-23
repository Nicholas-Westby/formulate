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

/** What a visitor sends: a name and an email, maybe the values of other fields by their labels, and maybe a file. */
interface Visitor {
	name: string;
	email: string;
	more?: Record<string, string>;
	file?: { name: string; buffer: Buffer };
}

/** Sends the form from its page, as a visitor does, and waits for the page's thank-you. */
async function sendForm(site: Page, path: string, values: Visitor) {
	await site.goto(path);
	const form = site.locator('form.formulate__form');
	await form.getByLabel('Name', { exact: true }).fill(values.name);
	await form.getByLabel('Email', { exact: true }).fill(values.email);

	for (const [label, value] of Object.entries(values.more ?? {})) {
		await form.getByLabel(label, { exact: true }).fill(value);
	}

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
		// A page link shows where it goes: the host as well as the path.
		const pageText = `${new URL(pageUrl).host}${created.path}`;
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

		// The form's Submissions view lists them: each row's icon, Created, Page, the fields that store a value (not the
		// upload or the button), Files, and the row's actions.
		await page.goto(`/umbraco/section/formulate/workspace/formulate-form/edit/${formId}`);
		await editor.getByRole('tab', { name: 'Submissions', exact: true }).click();
		const view = page.locator('formulate-form-submissions-workspace-view');
		const table = view.locator('umb-table');
		await expect(table.locator('uui-table-row')).toHaveCount(2);
		await expect(table.locator('uui-table-head-cell')).toHaveText(['', 'Created', 'Page', 'Name', 'Email', 'Files', '']);
		const [graceDate, adaDate] = [await shownDate(page, grace!.creationDate), await shownDate(page, ada!.creationDate)];
		expect(await cellsOf(table)).toEqual([
			['', graceDate, pageText, 'Grace Hopper', 'grace@example.com', '', ''],
			['', adaDate, pageText, 'Ada Lovelace', 'ada@example.com', 'notes.txt', ''],
		]);
		// The page is the real page the form was sent from (its URL as Store Data recorded it), and opens in a new tab.
		const pageLinks = table.getByRole('link', { name: pageText, exact: true });
		await expect(pageLinks).toHaveCount(2);
		await expect(pageLinks.first()).toHaveAttribute('href', pageUrl);
		await expect(pageLinks.first()).toHaveAttribute('target', '_blank');
		// Each row's actions are named after the row: its place in the list, and when it was sent.
		const adaRow = table.locator('uui-table-row', { hasText: 'Ada Lovelace' });
		const graceRow = table.locator('uui-table-row', { hasText: 'Grace Hopper' });
		await expect(adaRow.getByRole('button', { name: `Open submission 2 of 2, from ${adaDate}`, exact: true })).toBeVisible();
		await expect(graceRow.getByRole('button', { name: `Delete submission 1 of 2, from ${graceDate}`, exact: true })).toBeVisible();
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
		await expect(sidebar.locator('umb-property-layout[label="Page"]').getByRole('link', { name: pageText })).toHaveAttribute(
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

		// The export has a header and a row for each submission, newest first, with the page and the file's name, and no
		// column for the Send button, which stores no value.
		const [csv] = await Promise.all([page.waitForEvent('download'), view.getByRole('button', { name: 'Export to CSV', exact: true }).click()]);
		expect(csv.suggestedFilename()).toBe('submissions.csv');
		const bytes = readFileSync(await csv.path());
		expect(bytes.subarray(0, 3)).toEqual(BOM);
		const utc = (submission: Submission) => `${submission.creationDate.slice(0, 19)}Z`;
		expect(bytes.subarray(3).toString('utf8').split('\r\n')).toEqual([
			'Submission Id,Created,Page Id,URL,Name,Email,Attachment',
			`${grace!.id},${utc(grace!)},${grace!.pageId},${pageUrl},Grace Hopper,grace@example.com,`,
			`${ada!.id},${utc(ada!)},${ada!.pageId},${pageUrl},Ada Lovelace,ada@example.com,notes.txt`,
			'',
		]);

		// Deleting a row asks first, in the danger colour, then leaves the other row; the API agrees.
		await graceRow.getByRole('button', { name: `Delete submission 1 of 2, from ${graceDate}`, exact: true }).click();
		const confirm = page.locator('umb-confirm-modal');
		await expect(confirm).toContainText(`the submission from ${graceDate}`);
		await expect(confirm.locator('uui-button[color="danger"]')).toHaveAttribute('label', 'Delete');
		await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
		await expect(table.locator('uui-table-row')).toHaveCount(1);
		expect(await cellsOf(table)).toEqual([['', adaDate, pageText, 'Ada Lovelace', 'ada@example.com', 'notes.txt', '']]);
		const left = await readSubmissions(page, formId);
		expect(left.total).toBe(1);
		expect(left.items.map((submission) => submission.id)).toEqual([ada!.id]);

		// Reloaded on its own address, the view shows its rows again.
		await expect(page).toHaveURL(new RegExp(`/workspace/formulate-form/edit/${formId}/view/submissions$`));
		await page.reload();
		await expect(table.locator('uui-table-row')).toHaveCount(1);
		expect(await cellsOf(table)).toEqual([['', adaDate, pageText, 'Ada Lovelace', 'ada@example.com', 'notes.txt', '']]);
	} finally {
		await site.close();
		await openBackOffice(page);
		await deleteSubmissions(page, formId).catch(() => undefined);
		await cleanUp(page, { documentIds: pageId ? [pageId] : [], formIds: [formId] });
	}
});

/** An address as most visitors send one, which a window 1280 pixels wide shows whole. */
const ORDINARY_EMAIL = 'maria.lopez@example.com';

/**
 * Visitors who send long values: a long message, a long email address and a file with a long name. Maria's address is
 * an ordinary one, in the same column as the long one.
 */
const LONG_VISITORS: Array<Visitor> = [
	{
		name: 'Maria Lopez',
		email: ORDINARY_EMAIL,
		more: {
			Topic: 'Prices for charities and schools',
			Message:
				'Could you send me a price list for 20 seats? We would also like to know whether you give charities and schools a discount, and for how long a quote stays valid.',
		},
	},
	{
		name: 'Sam Patel',
		email: 'samuel.patel.customer.support@example-company.com',
		more: { Topic: 'Support', Message: 'The download link on the pricing page shows an error. My notes on the error are attached.' },
		file: { name: 'notes-on-the-error-from-the-pricing-page-on-my-laptop.txt', buffer: NOTES },
	},
];

/** The window widths of a small laptop and of a tablet on its side. */
const NARROW_WIDTHS = [1280, 1024];

/** How far the content of the table that umb-table draws reaches past the table's own box, in pixels. */
function tableOverflow(table: Locator) {
	return table.evaluate((element) => {
		const uuiTable = element.shadowRoot!.querySelector('uui-table')!;
		return uuiTable.scrollWidth - uuiTable.clientWidth;
	});
}

/** What is cut of a table cell: the cell and each element in it whose content reaches past its box, across or down. */
function cutParts(cell: Locator) {
	return cell.evaluate((element) =>
		[element, ...element.querySelectorAll('*')]
			.filter((part) => part.scrollWidth > part.clientWidth || part.scrollHeight > part.clientHeight)
			.map((part) => `${part.localName} ${part.scrollWidth}x${part.scrollHeight} in ${part.clientWidth}x${part.clientHeight}`),
	);
}

test("at 1280 and 1024 pixels each row's actions stay on screen, however long its values are, and at 1280 an ordinary address shows whole", async ({
	page,
	context,
	seededPage,
}) => {
	void seededPage;
	test.setTimeout(180_000);
	await openBackOffice(page);
	const kinds = await findKinds(page);
	const { formId, layoutId } = await createForm(page, kinds, {
		name: 'Long submissions test form',
		fields: [
			formField(fieldKind(kinds, 'Text'), 'Name', 'name'),
			formField(fieldKind(kinds, 'Text'), 'Email', 'email'),
			formField(fieldKind(kinds, 'Text'), 'Topic', 'topic'),
			formField(fieldKind(kinds, 'Text Area'), 'Message', 'message'),
			formField(fieldKind(kinds, 'Upload'), 'Attachment', 'attachment'),
			formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } }),
		],
		handlers: [{ kindId: STORE_DATA_KIND_ID, name: 'Store Data', alias: 'storeData' }],
	});
	const site = await context.newPage();
	let pageId: string | undefined;

	try {
		const created = await createPage(page, 'Long submissions test', layoutId);
		pageId = created.id;
		await waitForPage(site, created.path);
		for (const visitor of LONG_VISITORS) {
			await sendForm(site, created.path, visitor);
		}

		await page.goto(`/umbraco/section/formulate/workspace/formulate-form/edit/${formId}`);
		await page.locator('umb-workspace-editor').getByRole('tab', { name: 'Submissions', exact: true }).click();
		const table = page.locator('formulate-form-submissions-workspace-view umb-table');
		const rows = table.locator('uui-table-row');
		await expect(rows).toHaveCount(LONG_VISITORS.length);
		await expect(table.locator('uui-table-head-cell')).toHaveText(['', 'Created', 'Page', 'Name', 'Email', 'Topic', 'Message', 'Files', '']);

		// Each row's date, which opens it, and its Delete are whole on the screen, and the table is no wider than its box.
		for (const width of NARROW_WIDTHS) {
			await page.setViewportSize({ width, height: 900 });
			for (const [index, row] of (await rows.all()).entries()) {
				const where = `row ${index + 1} at ${width} px`;
				await expect.soft(row.getByRole('button', { name: /^Open submission / }), `the date of ${where}`).toBeInViewport({ ratio: 1 });
				await expect.soft(row.getByRole('button', { name: /^Delete submission / }), `Delete in ${where}`).toBeInViewport({ ratio: 1 });
			}
			expect.soft(await tableOverflow(table), `the table's overflow at ${width} px`).toBe(0);
			// At 1280 pixels the ordinary address reads in full: nothing in its cell is cut, across or down.
			if (width === 1280) {
				const email = rows.filter({ hasText: ORDINARY_EMAIL }).locator('uui-table-cell').nth(4);
				await expect(email).toHaveText(ORDINARY_EMAIL);
				expect.soft(await cutParts(email), `what is cut of ${ORDINARY_EMAIL} at ${width} px`).toEqual([]);
				// A value its three lines cut shows in full as a title on hover.
				const longEmail = LONG_VISITORS[1]!.email;
				const cut = rows.filter({ hasText: longEmail }).locator('uui-table-cell').nth(4).locator('formulate-submission-value');
				await cut.hover();
				await expect.soft(cut, `the title of ${longEmail} at ${width} px`).toHaveAttribute('title', longEmail);
				await page.mouse.move(0, 0);
			}
			await page.screenshot({ path: screenshotPath(`submissions-long-${width}.png`), animations: 'disabled' });
		}

		// Delete asks first, from each row at each width. Nothing is deleted here: the dialog is closed with Cancel.
		const confirm = page.locator('umb-confirm-modal');
		for (const width of NARROW_WIDTHS) {
			await page.setViewportSize({ width, height: 900 });
			for (const row of await rows.all()) {
				await row.getByRole('button', { name: /^Delete submission / }).click();
				await expect(confirm).toContainText('Are you sure you want to delete the submission from');
				await confirm.locator('uui-button#cancel').click();
				await expect(confirm).toHaveCount(0);
			}
		}

		// The date opens the submission at the narrower width too.
		await rows.first().getByRole('button', { name: /^Open submission / }).click();
		const sidebar = page.locator('formulate-submission-modal');
		await expect(sidebar.locator('umb-property-layout[label="Email"] .value')).toHaveText(LONG_VISITORS[1]!.email);
		await sidebar.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(rows).toHaveCount(LONG_VISITORS.length);
	} finally {
		await site.close();
		await openBackOffice(page);
		await deleteSubmissions(page, formId).catch(() => undefined);
		await cleanUp(page, { documentIds: pageId ? [pageId] : [], formIds: [formId] });
	}
});
