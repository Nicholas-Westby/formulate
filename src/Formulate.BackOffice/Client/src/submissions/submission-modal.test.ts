import '@umbraco-cms/backoffice/components';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SubmissionResponseModel } from '../api/index.js';
import { pathAndQuery } from '../test/fake-api.js';
import { loadFormulateEnglish } from '../test/localization.js';
import {
	ADA_ID,
	adaSubmission,
	applicationForm,
	CV_BYTES,
	CV_ID,
	graceSubmission,
	LONG_MESSAGE,
	problemResponse,
	recordDownloads,
	serveSubmissions,
} from '../test/submissions.js';
import { createTestHost } from '../test/test-host.js';
import { click } from '../test/ui.js';
import { FormulateSubmissionModalElement } from './submission-modal.element.js';
import { FORMULATE_SUBMISSION_MODAL, type FormulateSubmissionModalData } from './submission-modal.token.js';

const API = '/umbraco/management/api/v1/formulate';

beforeAll(() => {
	loadFormulateEnglish();
});

afterEach(() => {
	document.body.replaceChildren();
});

/** The application form's fields, as the Submissions view gives them to the sidebar. */
function formFields() {
	return applicationForm().fields.map(({ id, kindId, name }) => ({ id, kindId, name: name ?? null }));
}

/** Opens the sidebar of a submission as the modal manager would, in a back office host with notifications. */
async function openSidebar(submission: SubmissionResponseModel, fields = formFields(), answer?: Parameters<typeof serveSubmissions>[1]) {
	const requests = serveSubmissions([submission], answer);
	const host = createTestHost();
	const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
	const modals = new UmbModalManagerContext(host);
	const data: FormulateSubmissionModalData = { submission, fields };
	const modalContext = modals.open(host, FORMULATE_SUBMISSION_MODAL, { data }) as UmbModalContext<FormulateSubmissionModalData, never>;
	const element = new FormulateSubmissionModalElement();
	element.modalContext = modalContext;
	element.data = modalContext.data;
	host.append(element);
	await settle(element);

	return { element, modalContext, requests, peek, shadow: element.shadowRoot! };
}

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 4; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Each property the sidebar shows: its label, its description, and the text of its value. */
function propertiesOf(shadow: ShadowRoot) {
	return [...shadow.querySelectorAll('umb-property-layout')].map((property) => ({
		label: property.getAttribute('label'),
		description: property.getAttribute('description') ?? '',
		text: (property.textContent ?? '').replace(/\s+/g, ' ').trim(),
	}));
}

describe('Formulate submission sidebar', () => {
	it("shows the page and every stored value and file, in the form's order, under the fields' current names", async () => {
		const form = formFields();
		// The Email field was renamed after Ada sent the form.
		form[4].name = 'Email address';
		const { shadow } = await openSidebar(adaSubmission(), form);

		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe(
			`Submission from ${new Date('2026-11-22T10:52:00Z').toLocaleString('en-us')}`,
		);
		expect(propertiesOf(shadow)).toStrictEqual([
			{ label: 'Page', description: '', text: '/contact/' },
			{ label: 'Name', description: '', text: 'Ada Lovelace' },
			{ label: 'CV', description: '', text: 'cv.pdf' },
			{ label: 'Email address', description: '', text: 'ada@example.com' },
			// In full, as stored.
			{ label: 'Message', description: '', text: LONG_MESSAGE },
			{ label: 'Phone', description: '', text: '555 0100' },
		]);
		const link = shadow.querySelector('umb-property-layout[label="Page"] a')!;
		expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toStrictEqual([
			'https://example.com/contact/',
			'_blank',
			'noopener noreferrer',
		]);
	});

	it('keeps the line breaks of a value, and shows a value that was sent empty', async () => {
		const submission = graceSubmission();
		submission.values.push(
			{ fieldId: '5fab8d60-4c7e-4fb1-99a3-2e4a6c8d0f05', fieldName: 'Message', value: 'Line one\nLine two' },
			{ fieldId: '4e9a7c5f-3b6d-4ea0-88f2-1d3f5b7c9e04', fieldName: 'Email', value: '' },
		);
		const { shadow } = await openSidebar(submission);

		expect(propertiesOf(shadow).map(({ label, text }) => [label, text])).toStrictEqual([
			['Name', 'Grace Hopper'],
			['State', 'VA'],
			['Email', ''],
			['Message', 'Line one Line two'],
		]);
		// The sidebar's styles show the line break (white-space: pre-wrap), which jsdom does not lay out.
		expect(shadow.querySelector('umb-property-layout[label="Message"] .value')?.textContent).toBe('Line one\nLine two');
	});

	it('shows the values of fields no longer on the form after the others, under the names they were stored with', async () => {
		const submission = adaSubmission();
		submission.values.push({ fieldId: '82debf93-7fab-4ce4-8cd6-5b7d9fba3c08', fieldName: 'Company', value: 'Analytical Engines' });
		submission.files.push({ fieldId: '93efc0a4-8abc-4df5-9de7-6c8eafcb4d09', fieldName: '', fileName: 'engines.zip' });
		const fields = formFields().filter((field) => field.name !== 'Phone');
		const { shadow } = await openSidebar(submission, fields);

		expect(propertiesOf(shadow).slice(-3)).toStrictEqual([
			{ label: 'Phone', description: 'No longer on the form.', text: '555 0100' },
			{ label: 'Company', description: 'No longer on the form.', text: 'Analytical Engines' },
			{ label: 'Unnamed', description: 'No longer on the form.', text: 'engines.zip' },
		]);
	});

	it('shows no page when Store Data stored none, or none a link could safely open', async () => {
		const submission = adaSubmission();
		submission.url = 'javascript:alert(1)';
		const { shadow } = await openSidebar(submission);

		// The values still show; the page does not, and nothing links anywhere.
		expect(propertiesOf(shadow).map(({ label }) => label)).toStrictEqual(['Name', 'CV', 'Email', 'Message', 'Phone']);
		expect(shadow.querySelector('a')).toBeNull();
	});

	it('downloads each file through the API by the name Store Data stored, byte for byte, from a button named after it', async () => {
		const { shadow, requests, element } = await openSidebar(adaSubmission());
		const downloads = recordDownloads();
		const button = shadow.querySelector('uui-button[label="Download cv.pdf"]')!;

		click(button);
		await settle(element);

		expect(requests.map((request) => pathAndQuery(request).slice(API.length))).toStrictEqual([
			`/submission/${ADA_ID}/file/${CV_ID}?fileName=cv.pdf`,
		]);
		expect(downloads.map((download) => download.name)).toStrictEqual(['cv.pdf']);
		expect(new Uint8Array(await downloads[0].blob.arrayBuffer())).toStrictEqual(CV_BYTES);
	});

	it('says so when a file cannot be downloaded', async () => {
		const { shadow, peek, element } = await openSidebar(adaSubmission(), formFields(), (_request, path) =>
			path.includes('/file/') ? problemResponse(404, 'Item not found', 'There is no such file.') : undefined,
		);
		const downloads = recordDownloads();

		click(shadow.querySelector('uui-button[label="Download cv.pdf"]')!);
		await settle(element);

		expect(downloads).toStrictEqual([]);
		expect(peek.mock.calls).toStrictEqual([
			['danger', { data: { headline: 'cv.pdf could not be downloaded.', message: 'There is no such file.' } }],
		]);
	});

	it('closes with its Close button', async () => {
		const { shadow, modalContext } = await openSidebar(adaSubmission());
		const closed = modalContext.onSubmit().then(
			() => 'submitted',
			() => 'closed',
		);

		click(shadow.querySelector('uui-button[label="general_close"]')!);

		expect(await closed).toBe('closed');
	});
});
