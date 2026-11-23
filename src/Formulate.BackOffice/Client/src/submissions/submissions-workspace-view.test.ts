import '@umbraco-cms/backoffice/components';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SubmissionResponseModel } from '../api/index.js';
import { pathAndQuery } from '../test/fake-api.js';
import { createFormWorkspaceHost, FORM_ID, registerFormRepositories } from '../test/forms.js';
import { destroyKept, keep } from '../test/kind-items.js';
import { loadFormulateEnglish } from '../test/localization.js';
import {
	ADA_ID,
	adaSubmission,
	CV_ID,
	EMAIL_ID,
	EXPORT_BYTES,
	GRACE_ID,
	graceSubmission,
	manySubmissions,
	MESSAGE_ID,
	NAME_ID,
	problemResponse,
	recordDownloads,
	serveSubmissions,
	STATE_ID,
} from '../test/submissions.js';
import { click } from '../test/ui.js';
import { FormulateFormWorkspaceContext } from '../forms/workspace/form-workspace.context.js';
import { FormulateFormSubmissionsWorkspaceViewElement } from './submissions-workspace-view.element.js';

const API = '/umbraco/management/api/v1/formulate';

beforeAll(() => {
	registerFormRepositories();
	loadFormulateEnglish();
	// Umbraco UI's pagination watches its size; jsdom has no ResizeObserver.
	globalThis.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
});

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

/** A date as the back office's own tables show it: in the user's language (here jsdom's, en-US). */
function shown(date: string) {
	return new Date(date).toLocaleString('en-us');
}

/**
 * The Submissions view of the application form's workspace, on an API with these submissions. The dialogs it opens
 * answer, in turn, with the given answers: true submits, anything else closes.
 */
async function openView(
	submissions: Array<SubmissionResponseModel>,
	options: { answers?: Array<boolean>; answer?: Parameters<typeof serveSubmissions>[1] } = {},
) {
	const requests = serveSubmissions(submissions, options.answer);
	const { host, peek } = createFormWorkspaceHost();
	const context = keep(new FormulateFormWorkspaceContext(host));
	await context.load(FORM_ID);
	const modals = new UmbModalManagerContext(host);
	const opened: Array<{ alias: string; data: unknown }> = [];
	const answers = [...(options.answers ?? [])];
	vi.spyOn(modals, 'open').mockImplementation((_host, token, args) => {
		opened.push({ alias: String(token), data: (args as { data?: unknown } | undefined)?.data });
		const submit = answers.shift() === true;
		const onSubmit = () => (submit ? Promise.resolve(undefined) : Promise.reject(new Error('Closed')));
		return { onSubmit } as unknown as UmbModalContext;
	});
	const view = new FormulateFormSubmissionsWorkspaceViewElement();
	host.append(view);
	await settle(view);

	return { view, context, requests, opened, peek, shadow: view.shadowRoot! };
}

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 6; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function tableOf(shadow: ShadowRoot) {
	return shadow.querySelector('umb-table')?.shadowRoot ?? null;
}

/** The table's column headings. */
function headingsOf(shadow: ShadowRoot) {
	return [...(tableOf(shadow)?.querySelectorAll('uui-table-head-cell') ?? [])].map((cell) => cell.textContent?.trim());
}

/** The table's rows. */
function rowsOf(shadow: ShadowRoot) {
	return [...(tableOf(shadow)?.querySelectorAll('uui-table-row') ?? [])];
}

/** The text of each cell of each row. */
function cellsOf(shadow: ShadowRoot) {
	return rowsOf(shadow).map((row) =>
		[...row.querySelectorAll('uui-table-cell')].map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()),
	);
}

/**
 * Clicks something in a row, and the click bubbles up to the row, as a browser's does. Unlike a browser's, it stays in
 * the table: past it, it would reach the back office router, which jsdom cannot follow.
 */
function clickInRow(element: Element) {
	element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** The requests for the submissions, as method, path and query. */
function submissionRequests(requests: Array<Request>) {
	return requests
		.filter((request) => new URL(request.url).pathname.startsWith(`${API}/submission`))
		.map((request) => `${request.method} ${pathAndQuery(request).slice(API.length)}`);
}

const LIST = `/submission?formId=${FORM_ID}`;

describe('Formulate Submissions view', () => {
	it("lists the form's submissions as the API gives them, newest first, with their dates, pages, values and files", async () => {
		const { shadow, requests } = await openView([graceSubmission(), adaSubmission()]);

		// Umbraco's collections show 50 items a page.
		expect(submissionRequests(requests)).toStrictEqual([`GET ${LIST}&skip=0&take=50`]);
		// The first four fields that store a value, by their names: not the heading, the upload or the button.
		expect(headingsOf(shadow)).toStrictEqual(['Created', 'Page', 'Name', 'State', 'Email', 'Message', 'Files', '']);
		expect(cellsOf(shadow)).toStrictEqual([
			[shown('2026-11-22T11:05:00Z'), '', 'Grace Hopper', 'VA', '', '', '', ''],
			[
				shown('2026-11-22T10:52:00Z'),
				'example.com/contact/',
				'Ada Lovelace',
				'',
				'ada@example.com',
				'Hello, I would like to apply for the analyst role you advertised, and I have attached my CV with the…',
				'cv.pdf',
				'',
			],
		]);
		// The page opens in a new tab.
		const link = rowsOf(shadow)[1].querySelector('a')!;
		expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toStrictEqual([
			'https://example.com/contact/',
			'_blank',
			'noopener noreferrer',
		]);
	});

	it("shows where each page link goes, host and all, even when Store Data stored another site's address", async () => {
		const ada = adaSubmission();
		ada.url = 'https://evil.example.net/contact-us/';
		const { shadow } = await openView([ada]);
		const link = rowsOf(shadow)[0].querySelector('a')!;

		expect([link.textContent, link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toStrictEqual([
			'evil.example.net/contact-us/',
			'https://evil.example.net/contact-us/',
			'_blank',
			'noopener noreferrer',
		]);
	});

	it("names each row's actions after the row, by when it was sent", async () => {
		const { shadow } = await openView([graceSubmission(), adaSubmission()]);
		const grace = shown('2026-11-22T11:05:00Z');
		const [first] = rowsOf(shadow);

		expect(first.querySelector('uui-button[label^="Open"]')?.getAttribute('label')).toBe(`Open the submission from ${grace}`);
		expect(first.querySelector('uui-action-bar uui-button')?.getAttribute('aria-label')).toBe(`Delete the submission from ${grace}`);
		expect(first.querySelector('uui-action-bar uui-button')?.getAttribute('label')).toBe('general_delete');
	});

	it('opens a submission in a sidebar from its date, or from anywhere else on its row, with the fields of the form', async () => {
		const { shadow, opened } = await openView([graceSubmission(), adaSubmission()]);
		const [grace, ada] = rowsOf(shadow);

		// The date's button opens it once: the row leaves a click on a button to the button.
		clickInRow(grace.querySelector('uui-button[label^="Open"]')!);
		clickInRow(ada.querySelectorAll('uui-table-cell')[4]);
		await settle(shadow.host as FormulateFormSubmissionsWorkspaceViewElement);

		expect(opened.map(({ alias, data }) => [alias, (data as { submission: SubmissionResponseModel }).submission.id])).toStrictEqual([
			['Formulate.Modal.Submission', GRACE_ID],
			['Formulate.Modal.Submission', ADA_ID],
		]);
		expect((opened[1].data as { fields: unknown }).fields).toStrictEqual([
			{ id: NAME_ID, kindId: '17906580-86ea-440b-bc30-9e1b099f803b', name: 'Name' },
			{ id: '1a6b4d2f-9c3e-4f70-8b8d-2e4f6a8c0d02', kindId: '6383dd2c-68bd-482b-95db-811d09d01bc8', name: 'Heading' },
			{ id: STATE_ID, kindId: '6d3df157-1bc4-4fcf-b2b7-0a94fe719b47', name: 'State' },
			{ id: CV_ID, kindId: 'dfefa5ec-0200-4806-a2ab-0ab22058021d', name: 'CV' },
			{ id: EMAIL_ID, kindId: '17906580-86ea-440b-bc30-9e1b099f803b', name: 'Email' },
			{ id: MESSAGE_ID, kindId: '17906580-86ea-440b-bc30-9e1b099f803b', name: 'Message' },
			{ id: '60bc9e71-5d8f-4ac2-8ab4-3f5b7d9e1a06', kindId: '17906580-86ea-440b-bc30-9e1b099f803b', name: 'Phone' },
			{ id: '71cdaf82-6e9a-4bd3-9bc5-4a6c8eaf2b07', kindId: 'cde8565c-5e92-4112-9a1f-7ffa1940c53c', name: 'Send' },
		]);
	});

	it("opens nothing from a row's page link or its delete button", async () => {
		const { shadow, opened } = await openView([adaSubmission()]);
		const [ada] = rowsOf(shadow);
		const link = ada.querySelector('a')!;
		// The browser follows the link in a new tab; jsdom cannot, so the click is only checked, not followed.
		link.addEventListener('click', (event) => event.preventDefault());

		clickInRow(link);
		clickInRow(ada.querySelector('uui-action-bar uui-button')!);
		await settle(shadow.host as FormulateFormSubmissionsWorkspaceViewElement);

		// Only the delete's confirmation opened.
		expect(opened.map(({ alias }) => alias)).toStrictEqual(['Umb.Modal.Confirm']);
	});

	it('says, in one sentence, that a form with no submissions has none, and that Store Data keeps them', async () => {
		const { shadow } = await openView([]);

		expect(shadow.querySelector('umb-table')).toBeNull();
		expect(shadow.querySelector('#empty')?.textContent?.trim()).toBe(
			'There are no submissions yet: a Store Data handler on this form keeps each one that visitors send.',
		);
		expect(shadow.querySelector('uui-button[label="Export to CSV"]')).toBeNull();
	});

	it('says so when the submissions cannot be read', async () => {
		const { shadow } = await openView([adaSubmission()], {
			answer: (_request, path) => (path === '/submission' ? problemResponse(500, 'Server error', 'The database is down.') : undefined),
		});

		expect(shadow.querySelector('umb-table')).toBeNull();
		expect(shadow.querySelector('#failed')?.textContent?.trim()).toBe('The submissions could not be read.');
	});

	it('asks before deleting a submission, in the danger colour, then shows the page again without it', async () => {
		const submissions = [graceSubmission(), adaSubmission()];
		const { shadow, requests, opened, view } = await openView(submissions, { answers: [true] });
		const grace = shown('2026-11-22T11:05:00Z');

		click(rowsOf(shadow)[0].querySelector('uui-action-bar uui-button')!);
		await settle(view);

		expect(opened).toStrictEqual([
			{
				alias: 'Umb.Modal.Confirm',
				data: {
					headline: 'Delete submission',
					content: `Are you sure you want to delete the submission from ${grace}? Its files are deleted with it.`,
					color: 'danger',
					confirmLabel: 'general_delete',
				},
			},
		]);
		expect(submissionRequests(requests)).toStrictEqual([
			`GET ${LIST}&skip=0&take=50`,
			`DELETE /submission/${GRACE_ID}`,
			`GET ${LIST}&skip=0&take=50`,
		]);
		expect(cellsOf(shadow).map((cells) => cells[2])).toStrictEqual(['Ada Lovelace']);
	});

	it('deletes nothing when the question is closed', async () => {
		const { shadow, requests, view } = await openView([graceSubmission(), adaSubmission()], { answers: [false] });

		click(rowsOf(shadow)[0].querySelector('uui-action-bar uui-button')!);
		await settle(view);

		expect(submissionRequests(requests)).toStrictEqual([`GET ${LIST}&skip=0&take=50`]);
		expect(rowsOf(shadow)).toHaveLength(2);
	});

	it('says so when a delete fails, and keeps the submission', async () => {
		const { shadow, requests, peek, view } = await openView([graceSubmission(), adaSubmission()], {
			answers: [true],
			answer: (request) => (request.method === 'DELETE' ? problemResponse(500, 'Server error', 'The database is down.') : undefined),
		});

		click(rowsOf(shadow)[0].querySelector('uui-action-bar uui-button')!);
		await settle(view);

		expect(peek.mock.calls).toStrictEqual([
			['danger', { data: { headline: 'The submission could not be deleted.', message: 'The database is down.' } }],
		]);
		expect(submissionRequests(requests)).toStrictEqual([`GET ${LIST}&skip=0&take=50`, `DELETE /submission/${GRACE_ID}`]);
		expect(rowsOf(shadow)).toHaveLength(2);
	});

	it('just leaves out a submission that someone else deleted already', async () => {
		const submissions = [graceSubmission(), adaSubmission()];
		const { shadow, peek, view } = await openView(submissions, { answers: [true] });
		submissions.shift();

		click(rowsOf(shadow)[0].querySelector('uui-action-bar uui-button')!);
		await settle(view);

		expect(peek).not.toHaveBeenCalled();
		expect(cellsOf(shadow).map((cells) => cells[2])).toStrictEqual(['Ada Lovelace']);
	});

	it('pages through the submissions 50 at a time, as Umbraco collections do, and hides the pages when there is one', async () => {
		const { shadow, requests, view } = await openView(manySubmissions(120));
		const pagination = shadow.querySelector('uui-pagination')!;

		expect([pagination.total, pagination.current]).toStrictEqual([3, 1]);
		expect(rowsOf(shadow)).toHaveLength(50);

		pagination.goToPage(3);
		await settle(view);

		expect(submissionRequests(requests).at(-1)).toBe(`GET ${LIST}&skip=100&take=50`);
		expect(cellsOf(shadow).map((cells) => cells[2])).toStrictEqual(
			Array.from({ length: 20 }, (_, index) => `Visitor ${index + 101}`),
		);
		expect(pagination.current).toBe(3);

		const few = await openView(manySubmissions(50));
		expect(few.shadow.querySelector('uui-pagination')).toBeNull();
	});

	it('keeps the page asked for last when the read of a page asked for before it ends later', async () => {
		let answerPageTwo = () => {};
		const pageTwoAnswered = new Promise<void>((resolve) => (answerPageTwo = resolve));
		const { shadow, requests, view } = await openView(manySubmissions(120), {
			// The API is slow to give page 2.
			answer: async (request) => {
				if (new URL(request.url).searchParams.get('skip') === '50') await pageTwoAnswered;
				return undefined;
			},
		});
		const pagination = shadow.querySelector('uui-pagination')!;

		pagination.goToPage(2);
		await settle(view);
		pagination.goToPage(3);
		await settle(view);
		answerPageTwo();
		await settle(view);

		expect(cellsOf(shadow).map((cells) => cells[2])).toStrictEqual(
			Array.from({ length: 20 }, (_, index) => `Visitor ${index + 101}`),
		);
		expect(pagination.current).toBe(3);
		// Page 2's late answer is dropped, without asking for page 3 again.
		expect(submissionRequests(requests)).toStrictEqual([
			`GET ${LIST}&skip=0&take=50`,
			`GET ${LIST}&skip=50&take=50`,
			`GET ${LIST}&skip=100&take=50`,
		]);
	});

	it('steps back a page when a delete leaves its page empty', async () => {
		const { shadow, requests, view } = await openView(manySubmissions(51), { answers: [true] });
		shadow.querySelector('uui-pagination')!.goToPage(2);
		await settle(view);
		const [last] = rowsOf(shadow);

		click(last.querySelector('uui-action-bar uui-button')!);
		await settle(view);

		expect(submissionRequests(requests)).toStrictEqual([
			`GET ${LIST}&skip=0&take=50`,
			`GET ${LIST}&skip=50&take=50`,
			`DELETE /submission/c0000000-0000-4000-8000-000000000050`,
			`GET ${LIST}&skip=50&take=50`,
			`GET ${LIST}&skip=0&take=50`,
		]);
		expect(rowsOf(shadow)).toHaveLength(50);
		expect(shadow.querySelector('uui-pagination')).toBeNull();
	});

	it("downloads the form's submissions as the CSV the API gives, byte for byte, with its byte order mark", async () => {
		const { shadow, requests, view } = await openView([graceSubmission(), adaSubmission()]);
		const downloads = recordDownloads();

		click(shadow.querySelector('uui-button[label="Export to CSV"]')!);
		await settle(view);

		expect(submissionRequests(requests).at(-1)).toBe(`GET /submission/export?formId=${FORM_ID}`);
		expect(downloads.map((download) => download.name)).toStrictEqual(['submissions.csv']);
		expect(new Uint8Array(await downloads[0].blob.arrayBuffer())).toStrictEqual(EXPORT_BYTES);
	});

	it('says so when the export fails', async () => {
		const { shadow, peek, view } = await openView([adaSubmission()], {
			answer: (_request, path) => (path === '/submission/export' ? problemResponse(500, 'Server error', 'The disk is full.') : undefined),
		});
		const downloads = recordDownloads();

		click(shadow.querySelector('uui-button[label="Export to CSV"]')!);
		await settle(view);

		expect(downloads).toStrictEqual([]);
		expect(peek.mock.calls).toStrictEqual([
			['danger', { data: { headline: 'The submissions could not be exported.', message: 'The disk is full.' } }],
		]);
	});
});
