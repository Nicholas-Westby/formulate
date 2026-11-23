import { describe, expect, it, vi } from 'vitest';
import type { FormFieldDefinitionModel, SubmissionResponseModel } from '../api/index.js';
import { FIELD_KINDS, FORM_ID, TEXT } from '../test/forms.js';
import { previewText, submissionColumns, submissionEntries, submissionPage, submissionRow } from './submission-rows.js';

const SUBMISSION_ID = '7d1e3f5a-9b2c-4d6e-8f0a-1b3c5d7e9f01';
const NAME_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const EMAIL_ID = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
const MESSAGE_ID = '3d8f6b4e-2a5c-4d9f-b7e1-0c2e4a6b8d03';
// An Email field that was deleted from the form, then added again: same name, new ID.
const OLD_EMAIL_ID = '4e9a7c5f-3b6d-4ea0-88f2-1d3f5b7c9e04';

/** A submission as the API gives it. */
function submission(values: SubmissionResponseModel['values'], files: SubmissionResponseModel['files'] = []): SubmissionResponseModel {
	return {
		id: SUBMISSION_ID,
		formId: FORM_ID,
		creationDate: '2026-11-22T10:52:00Z',
		pageId: 1105,
		url: 'https://example.com/contact/',
		values,
		files,
	};
}

describe('Formulate submission rows', () => {
	it('submission rows map values by field ID and truncate long text', () => {
		// The Name field was renamed Full name after this visitor sent the form; Store Data kept the old name.
		const fields = [
			{ id: NAME_ID, kindId: TEXT, name: 'Full name' },
			{ id: EMAIL_ID, kindId: TEXT, name: 'Email' },
			{ id: MESSAGE_ID, kindId: TEXT, name: 'Message' },
		];
		const message =
			'Hello, I would like to book a table for six people on Saturday evening, ideally by the window, and one of us needs a high chair.';
		const row = submissionRow(
			submission([
				// Formulate 3 stored some IDs in upper case without dashes.
				{ fieldId: '0F5A3C1E8B2D4E6F9A7C1D3E5F7A9B01', fieldName: 'Name', value: 'Ada Lovelace' },
				{ fieldId: OLD_EMAIL_ID, fieldName: 'Email', value: 'old@example.com' },
				{ fieldId: MESSAGE_ID, fieldName: 'Message', value: message },
			]),
			submissionColumns(fields, FIELD_KINDS),
		);

		// The value of the old Email field is not the new one's, though they share a name. The message is cut at
		// the last space within its first 100 characters.
		expect(row.values).toStrictEqual([
			'Ada Lovelace',
			'',
			'Hello, I would like to book a table for six people on Saturday evening, ideally by the window, and…',
		]);
	});

	it("has columns for the form's first four fields that store a value, in the form's order", () => {
		// The kinds' flags as the server's definitions set them.
		const kinds = [
			kind(TEXT_KIND, 'Text'),
			kind(HIDDEN_KIND, 'Hidden'),
			kind(HEADER_KIND, 'Header', { isStored: false, isTransitory: true }),
			kind(BUTTON_KIND, 'Button', { isTransitory: true }),
			kind(TEXT_CONSTANT_KIND, 'Text Constant', { isServerSideOnly: true, isTransitory: true }),
			kind(UPLOAD_KIND, 'Upload'),
			kind(RECAPTCHA_KIND, 'reCAPTCHA', { isStored: false }),
			kind(SECRET_KIND, 'Secret', { isHidden: true }),
		];
		const field = (name: string, kindId: string) => ({ id: `${name}-id`, kindId, name });
		const fields = [
			field('Heading', HEADER_KIND),
			field('Name', TEXT_KIND),
			field('Constant', TEXT_CONSTANT_KIND),
			field('CV', UPLOAD_KIND),
			field('Captcha', RECAPTCHA_KIND),
			field('Secret', SECRET_KIND),
			// A kind that is not installed: the server takes no value for it.
			field('Gone', '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a'),
			field('Source', HIDDEN_KIND),
			field('Send', BUTTON_KIND),
			field('Email', TEXT_KIND.toUpperCase()),
			field('Phone', TEXT_KIND),
			field('Company', TEXT_KIND),
		];

		expect(submissionColumns(fields, kinds).map((column) => column.name)).toStrictEqual(['Name', 'Source', 'Email', 'Phone']);
	});

	it('shows a value of up to 100 characters whole, as the table lays it out on one line', () => {
		expect(previewText('a'.repeat(100))).toBe('a'.repeat(100));
		// A textarea's lines, and runs of spaces, show as single spaces.
		expect(previewText('  Line one\r\n\r\nline \t two  ')).toBe('Line one line two');
		expect(previewText(`${'word '.repeat(20)}\n\n`)).toBe('word '.repeat(20).trim());
	});

	it('cuts a longer value at the last word boundary in its first 100 characters, or at 100 when no word ends there', () => {
		// A word that ends at the 100th character is kept whole.
		expect(previewText(`${'a'.repeat(100)} more`)).toBe(`${'a'.repeat(100)}…`);
		expect(previewText(`${'a'.repeat(99)} bbbbbbbbbb`)).toBe(`${'a'.repeat(99)}…`);
		// With no space, or only one so early that most of the 100 characters would go, the value is cut at 100.
		expect(previewText('a'.repeat(101))).toBe(`${'a'.repeat(100)}…`);
		expect(previewText(`ab ${'c'.repeat(120)}`)).toBe(`ab ${'c'.repeat(97)}…`);
	});

	it('ends a cut value with its last word, not with the comma, semicolon or colon after it', () => {
		// Each is cut at the space after its first 95 characters, which end with a comma, a semicolon or a colon.
		expect(previewText('word, '.repeat(30))).toBe(`${'word, '.repeat(15)}word…`);
		expect(previewText('Note: done; '.repeat(15))).toBe(`${'Note: done; '.repeat(7)}Note: done…`);
		expect(previewText('Item: '.repeat(30))).toBe(`${'Item: '.repeat(15)}Item…`);
		// A value of nothing but commas keeps them, so the cell does not look empty.
		expect(previewText(','.repeat(150))).toBe(`${','.repeat(100)}…`);
	});

	it('reads only as much of a long value as it shows, as a visitor can send a very long one', () => {
		const segment = Intl.Segmenter.prototype.segment;
		let read = 0;
		// Counts the characters read from each value.
		const spy = vi.spyOn(Intl.Segmenter.prototype, 'segment').mockImplementation(function (this: Intl.Segmenter, input) {
			const segments = segment.call(this, input);
			const counted = {
				containing: (index?: number) => segments.containing(index),
				*[Symbol.iterator]() {
					for (const item of segments) {
						read++;
						yield item;
					}
				},
			};
			return counted as unknown as Intl.Segments;
		});

		try {
			expect(previewText(`  ${'word '.repeat(100_000)}`)).toBe(`${'word '.repeat(20).trim()}…`);
			expect(read).toBeLessThan(200);
		} finally {
			spy.mockRestore();
		}
	});

	it('counts and cuts characters as people see them, so an emoji is never split', () => {
		// One character on screen, made of several code points.
		const family = '\u{1F469}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}';

		expect(previewText(`${'a'.repeat(99)}${family}`)).toBe(`${'a'.repeat(99)}${family}`);
		expect(previewText(`${'a'.repeat(99)}${family}${family}`)).toBe(`${'a'.repeat(99)}${family}…`);
	});

	it('gives a row the names of its files', () => {
		const row = submissionRow(
			submission(
				[{ fieldId: NAME_ID, fieldName: 'Name', value: 'Ada Lovelace' }],
				[
					{ fieldId: CV_ID, fieldName: 'CV', fileName: 'cv.pdf' },
					{ fieldId: CV_ID, fieldName: 'CV', fileName: 'cover letter.docx' },
				],
			),
			[{ id: NAME_ID, kindId: TEXT, name: 'Name' }],
		);

		expect(row).toStrictEqual({
			id: SUBMISSION_ID,
			creationDate: '2026-11-22T10:52:00Z',
			page: { href: 'https://example.com/contact/', host: 'example.com', path: '/contact/' },
			values: ['Ada Lovelace'],
			files: 'cv.pdf, cover letter.docx',
		});
	});

	it("cuts the names of a row's files like a value", () => {
		const names = ['a', 'b', 'c'].map((letter) => `${letter.repeat(40)}.pdf`);
		const row = submissionRow(
			submission(
				[],
				names.map((fileName) => ({ fieldId: CV_ID, fieldName: 'CV', fileName })),
			),
			[],
		);

		expect(row.files).toBe(`${names[0]}, ${names[1]}…`);
	});

	it('shows the host and path of the page a submission was sent from, as a link only to an http or https address', () => {
		expect(submissionPage('http://localhost:44334/')).toStrictEqual({ href: 'http://localhost:44334/', host: 'localhost:44334', path: '/' });
		// The path as people read it, without the query string or fragment.
		expect(submissionPage('https://example.com/caf%C3%A9/menu/?ref=mail#order')).toStrictEqual({
			href: 'https://example.com/caf%C3%A9/menu/?ref=mail#order',
			host: 'example.com',
			path: '/café/menu/',
		});
		// A path that cannot be decoded shows as stored.
		expect(submissionPage('https://example.com/50%-off/')?.path).toBe('/50%-off/');
		// No page, or nothing a link could safely open.
		for (const url of [null, undefined, '', '/contact/', 'javascript:alert(1)', 'data:text/html,hi', 'not a url']) {
			expect(submissionPage(url), String(url)).toBeUndefined();
		}
	});

	it("shows the host a link really goes to, so another site's address never looks like the site's own page", () => {
		// For content with no domain, Umbraco builds the address from the request's host, which a visitor can set.
		expect(submissionPage('https://evil.example.net/contact-us/')).toStrictEqual({
			href: 'https://evil.example.net/contact-us/',
			host: 'evil.example.net',
			path: '/contact-us/',
		});
		// Not the user name before the host, which can look like one.
		expect(submissionPage('https://www.example.com@evil.example.net/contact-us/')?.host).toBe('evil.example.net');
		// A name in another script shows as the browser sends it, so a look-alike (here with a Cyrillic a) shows as
		// what it is.
		expect(submissionPage('https://ex\u0430mple.com/')?.host).toBe('xn--exmple-4nf.com');
	});

	it("cuts a long path in a row like a value, but never the page's host", () => {
		const page = submissionPage(`https://${'h'.repeat(120)}.example.com/${'p'.repeat(150)}/`)!;
		const row = submissionRow({ ...submission([]), url: page.href }, []);

		expect(row.page).toStrictEqual({ href: page.href, host: `${'h'.repeat(120)}.example.com`, path: `/${'p'.repeat(99)}…` });
	});

	it("lists every stored value and file in the form's order, then those of fields no longer on the form under their stored names", () => {
		const fields = [
			{ id: NAME_ID, kindId: TEXT_KIND, name: 'Name' },
			{ id: HEADING_ID, kindId: HEADER_KIND, name: 'Heading' },
			{ id: CV_ID, kindId: UPLOAD_KIND, name: 'CV' },
			// Renamed after the visitor sent the form; and one with no name, which shows the name it was stored with.
			{ id: EMAIL_ID, kindId: TEXT_KIND, name: 'Email address' },
			{ id: MESSAGE_ID, kindId: TEXT_KIND, name: null },
		];
		const stored = submission(
			[
				{ fieldId: COMPANY_ID, fieldName: 'Company', value: 'Analytical Engines' },
				{ fieldId: MESSAGE_ID.toUpperCase(), fieldName: 'Message', value: 'Line one\nline two' },
				{ fieldId: EMAIL_ID, fieldName: 'Email', value: 'ada@example.com' },
				{ fieldId: NAME_ID, fieldName: 'Name', value: '' },
				{ fieldId: OLD_EMAIL_ID, fieldName: '', value: 'old@example.com' },
			],
			[
				{ fieldId: PORTFOLIO_ID, fieldName: 'Portfolio', fileName: 'engines.zip' },
				{ fieldId: CV_ID, fieldName: 'CV', fileName: 'cv.pdf' },
			],
		);

		expect(submissionEntries(stored, fields)).toStrictEqual([
			{ fieldId: NAME_ID, name: 'Name', values: [''], files: [], onForm: true },
			{ fieldId: CV_ID, name: 'CV', values: [], files: [stored.files[1]], onForm: true },
			{ fieldId: EMAIL_ID, name: 'Email address', values: ['ada@example.com'], files: [], onForm: true },
			{ fieldId: MESSAGE_ID, name: 'Message', values: ['Line one\nline two'], files: [], onForm: true },
			{ fieldId: COMPANY_ID, name: 'Company', values: ['Analytical Engines'], files: [], onForm: false },
			{ fieldId: OLD_EMAIL_ID, name: null, values: ['old@example.com'], files: [], onForm: false },
			{ fieldId: PORTFOLIO_ID, name: 'Portfolio', values: [], files: [stored.files[0]], onForm: false },
		]);
	});
});

const CV_ID = '5fab8d60-4c7e-4fb1-99a3-2e4a6c8d0f05';
const HEADING_ID = '60bc9e71-5d8f-4ac2-8ab4-3f5b7d9e1a06';
// Fields deleted from the form after the visitor sent it.
const COMPANY_ID = '71cdaf82-6e9a-4bd3-9bc5-4a6c8eaf2b07';
const PORTFOLIO_ID = '82debf93-7fab-4ce4-8cd6-5b7d9fba3c08';

const TEXT_KIND = '17906580-86ea-440b-bc30-9e1b099f803b';
const HIDDEN_KIND = '3df6facd-2ffa-4055-b0be-94e8fa8e7c4a';
const HEADER_KIND = '6383dd2c-68bd-482b-95db-811d09d01bc8';
const BUTTON_KIND = 'cde8565c-5e92-4112-9a1f-7ffa1940c53c';
const TEXT_CONSTANT_KIND = 'd9b1a60a-1186-4440-887b-93195c760b5e';
const UPLOAD_KIND = 'dfefa5ec-0200-4806-a2ab-0ab22058021d';
const RECAPTCHA_KIND = '80c0543d-419e-4ddf-ab05-2c2d052b97a2';
// A kind whose definition hides it: the server takes no value for it.
const SECRET_KIND = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/** A field kind's definition, with the flags most kinds have. */
function kind(kindId: string, name: string, flags: Partial<FormFieldDefinitionModel> = {}): FormFieldDefinitionModel {
	return {
		kindId,
		name,
		icon: 'icon-document-dashed-line',
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
		...flags,
	};
}
