import { vi } from 'vitest';
import type { FormFieldDefinitionModel, FormFieldModel, FormResponseModel, SubmissionResponseModel } from '../api/index.js';
import { fakeApi, jsonResponse } from './fake-api.js';
import { BUTTON, DROP_DOWN, FIELD_KINDS, FORM_ID, HANDLER_KINDS, HEADER, TEXT } from './forms.js';
import { API } from './kind-items.js';

// What the tests of the submissions viewer share: a form with fields of each sort, its submissions, and a fake API
// that lists, deletes, exports and downloads them as the server does.

export const UPLOAD = 'dfefa5ec-0200-4806-a2ab-0ab22058021d';

export const NAME_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
export const HEADING_ID = '1a6b4d2f-9c3e-4f70-8b8d-2e4f6a8c0d02';
export const STATE_ID = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
export const CV_ID = '3d8f6b4e-2a5c-4d9f-b7e1-0c2e4a6b8d03';
export const EMAIL_ID = '4e9a7c5f-3b6d-4ea0-88f2-1d3f5b7c9e04';
export const MESSAGE_ID = '5fab8d60-4c7e-4fb1-99a3-2e4a6c8d0f05';
export const PHONE_ID = '60bc9e71-5d8f-4ac2-8ab4-3f5b7d9e1a06';
export const SEND_ID = '71cdaf82-6e9a-4bd3-9bc5-4a6c8eaf2b07';

export const ADA_ID = 'a1d2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a01';
export const GRACE_ID = 'b2e3b4c5-d6e7-4f80-9bac-1d2e3f4a5b02';

/** The kinds of field, with an upload's, as the definitions endpoint gives them. */
export const SUBMISSION_FIELD_KINDS: Array<FormFieldDefinitionModel> = [
	...FIELD_KINDS,
	{
		kindId: UPLOAD,
		name: 'Upload',
		icon: 'icon-download-alt',
		category: 'Inputs',
		editorAlias: null,
		supportsLabel: true,
		supportsValidation: true,
		supportsCategory: true,
		isServerSideOnly: false,
		isStored: true,
		isHidden: false,
		isTransitory: false,
		defaultConfiguration: null,
	},
];

function field(id: string, kindId: string, name: string): FormFieldModel {
	return { id, kindId, name, alias: name.toLowerCase(), label: name, category: null, validations: [], configuration: null };
}

/**
 * A form with fields of each sort: the first four that store a value are Name, State, Email and Message; the
 * heading and the button store none, and the CV's files are kept apart.
 */
export function applicationForm(): FormResponseModel {
	return {
		id: FORM_ID,
		name: 'Application',
		alias: 'application',
		parentId: null,
		fields: [
			field(NAME_ID, TEXT, 'Name'),
			field(HEADING_ID, HEADER, 'Heading'),
			field(STATE_ID, DROP_DOWN, 'State'),
			field(CV_ID, UPLOAD, 'CV'),
			field(EMAIL_ID, TEXT, 'Email'),
			field(MESSAGE_ID, TEXT, 'Message'),
			field(PHONE_ID, TEXT, 'Phone'),
			field(SEND_ID, BUTTON, 'Send'),
		],
		handlers: [],
	};
}

/** A long message, which the table cuts at the last word in its first 100 characters. */
export const LONG_MESSAGE =
	'Hello, I would like to apply for the analyst role you advertised, and I have attached my CV with the details of my work.';

/** Ada's submission, with a file, sent from the contact page. */
export function adaSubmission(): SubmissionResponseModel {
	return {
		id: ADA_ID,
		formId: FORM_ID,
		creationDate: '2026-11-22T10:52:00Z',
		pageId: 1105,
		url: 'https://example.com/contact/',
		values: [
			{ fieldId: NAME_ID, fieldName: 'Name', value: 'Ada Lovelace' },
			{ fieldId: EMAIL_ID, fieldName: 'Email', value: 'ada@example.com' },
			{ fieldId: MESSAGE_ID, fieldName: 'Message', value: LONG_MESSAGE },
			{ fieldId: PHONE_ID, fieldName: 'Phone', value: '555 0100' },
		],
		files: [{ fieldId: CV_ID, fieldName: 'CV', fileName: 'cv.pdf' }],
	};
}

/** Grace's submission, sent later, from no page. */
export function graceSubmission(): SubmissionResponseModel {
	return {
		id: GRACE_ID,
		formId: FORM_ID,
		creationDate: '2026-11-22T11:05:00Z',
		pageId: null,
		url: null,
		values: [
			{ fieldId: NAME_ID, fieldName: 'Name', value: 'Grace Hopper' },
			{ fieldId: STATE_ID, fieldName: 'State', value: 'VA' },
		],
		files: [],
	};
}

/** Submissions sent a minute apart, newest first, as the API lists them. */
export function manySubmissions(count: number): Array<SubmissionResponseModel> {
	return Array.from({ length: count }, (_, index) => ({
		id: `c0000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		formId: FORM_ID,
		creationDate: new Date(Date.UTC(2026, 10, 22, 12, 0) - index * 60_000).toISOString(),
		pageId: null,
		url: null,
		values: [{ fieldId: NAME_ID, fieldName: 'Name', value: `Visitor ${index + 1}` }],
		files: [],
	}));
}

/** The export of the application form's submissions, as the server writes it: UTF-8 with a byte order mark. */
export const EXPORT_BYTES = new Uint8Array([
	0xef,
	0xbb,
	0xbf,
	...new TextEncoder().encode('Submission Id,Created,Page Id,URL,Name\r\na1d2a3b4,2026-11-22T10:52:00Z,1105,,Zoë\r\n'),
]);

/** The bytes of Ada's CV. */
export const CV_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x00, 0xff]);

/** A problem, as the API reports one. */
export function problemResponse(status: number, title: string, detail: string) {
	return new Response(JSON.stringify({ type: 'Error', title, status, detail }), {
		status,
		headers: { 'Content-Type': 'application/problem+json' },
	});
}

/**
 * A Formulate API with the application form, the field kinds and the form's submissions. It lists them a page at a
 * time, deletes them, and gives the export and Ada's CV as the server does.
 * @param submissions The submissions, newest first; deleting one takes it out.
 * @param answer An answer that replaces the API's answer to a request, unless it gives undefined.
 */
export function serveSubmissions(
	submissions: Array<SubmissionResponseModel> = [],
	answer: (request: Request, path: string) => Response | undefined | Promise<Response | undefined> = () => undefined,
) {
	return fakeApi(async (request) => {
		const url = new URL(request.url);
		const path = url.pathname.slice(API.length);
		const answered = await answer(request, path);

		if (answered) return answered;
		if (path === '/definition/form-field') return jsonResponse(SUBMISSION_FIELD_KINDS);
		if (path === '/definition/form-handler') return jsonResponse(HANDLER_KINDS);
		if (path === `/form/${FORM_ID}`) return jsonResponse(applicationForm());

		if (path === '/submission') {
			const skip = Number(url.searchParams.get('skip'));
			const take = Number(url.searchParams.get('take'));
			return jsonResponse({ total: submissions.length, items: submissions.slice(skip, skip + take) });
		}

		if (path === '/submission/export') {
			return new Response(EXPORT_BYTES, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
		}

		if (path === `/submission/${ADA_ID}/file/${CV_ID}` && url.searchParams.get('fileName') === 'cv.pdf') {
			return new Response(CV_BYTES, { headers: { 'Content-Type': 'application/octet-stream' } });
		}

		const [, , id] = path.split('/');
		const index = submissions.findIndex((submission) => submission.id === id);

		if (request.method === 'DELETE' && index !== -1) {
			submissions.splice(index, 1);
			return new Response(null, { status: 200 });
		}

		return problemResponse(404, 'Item not found', 'There is no such submission.');
	});
}

/** A download the page started, by the name it saves as, with what it saves. */
export interface FormulateTestDownload {
	name: string;
	blob: Blob;
}

/**
 * Records the downloads that core's blobDownload starts: jsdom has no object URLs, and saves nothing.
 * @returns The downloads, in the order they were started.
 */
export function recordDownloads(): Array<FormulateTestDownload> {
	const downloads: Array<FormulateTestDownload> = [];
	const blobs = new Map<string, Blob>();
	Object.assign(URL, {
		createObjectURL: (blob: Blob) => {
			const url = `blob:https://formulate.test/${blobs.size + 1}`;
			blobs.set(url, blob);
			return url;
		},
		revokeObjectURL: () => undefined,
	});
	vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockImplementation(function (this: HTMLAnchorElement, event: Event) {
		if (event.type === 'click' && this.download && blobs.has(this.href)) {
			downloads.push({ name: this.download, blob: blobs.get(this.href)! });
		}
		return true;
	});

	return downloads;
}
