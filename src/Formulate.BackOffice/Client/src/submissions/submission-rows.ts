import type { FormFieldDefinitionModel, SubmissionFileModel, SubmissionResponseModel } from '../api/index.js';
import { FORMULATE_KIND_IDS } from '../core/field-kind-ids.js';
import { isSameGuid } from '../core/guid.js';
import { isSameKind } from '../core/kind-id.js';

/** How many fields the table has a column for. */
const COLUMN_COUNT = 4;

/** The most characters of a value the table shows. */
const PREVIEW_LENGTH = 100;

/** A field of the form, as the submissions viewer needs it. */
export interface FormulateSubmissionField {
	id: string;
	kindId: string;
	/** The field's current name. */
	name: string | null;
}

/**
 * The page a submission was sent from, as a link. The link shows where it goes, host and path, such as
 * www.example.com/contact-us/: for content with no domain, Umbraco builds the address from the host the visitor's
 * request named, so it can be another site's.
 */
export interface FormulateSubmissionPage {
	/** The page's address, as Store Data stored it (an http or https URL). */
	href: string;
	/** The address's host, with its port when it has one, such as www.example.com. */
	host: string;
	/** The address's path, as people read it, such as /contact-us/. */
	path: string;
}

/** What a row of the submissions table shows of a submission. */
export interface FormulateSubmissionRow {
	id: string;
	/** When the submission was sent, as the API gives it (UTC). */
	creationDate: string;
	/** The page it was sent from; none when Store Data stored no address a link could open. */
	page?: FormulateSubmissionPage;
	/** A value for each column, cut short when it is long. */
	values: Array<string>;
	/** The names of its files, cut short like a value when they are long. */
	files: string;
}

/** What the sidebar shows of a field of a submission: its stored values and files. */
export interface FormulateSubmissionEntry {
	fieldId: string;
	/** The field's current name, or for a field no longer on the form (or with no name), its stored name. */
	name: string | null;
	values: Array<string>;
	files: Array<SubmissionFileModel>;
	/** Whether the field is still on the form. */
	onForm: boolean;
}

/**
 * Whether Store Data keeps a value for a field, as the server decides it. The server takes a visitor's value only
 * for a field whose kind is installed and not server side only, hidden or transitory (AttemptSubmitForm
 * .GetInputFieldIds); Store Data keeps it unless the kind is not stored, such as reCAPTCHA (StoreFields). An
 * upload's files are kept apart from the values, and the table lists them under Files.
 * @param field The field.
 * @param definition The definition of its kind; undefined when the kind is not installed.
 */
export function storesValue(field: FormulateSubmissionField, definition: FormFieldDefinitionModel | undefined): boolean {
	if (!definition || definition.isServerSideOnly || definition.isHidden || definition.isTransitory || !definition.isStored) {
		return false;
	}

	return !isSameKind(field.kindId, FORMULATE_KIND_IDS.upload);
}

/**
 * The fields the table has a column for: the form's first four that store a value, in the form's order.
 * @param fields The form's fields, in order.
 * @param kinds The definitions of the fields' kinds.
 */
export function submissionColumns(
	fields: ReadonlyArray<FormulateSubmissionField>,
	kinds: ReadonlyArray<FormFieldDefinitionModel>,
): Array<FormulateSubmissionField> {
	return fields
		.filter((field) =>
			storesValue(
				field,
				kinds.find((kind) => isSameKind(kind.kindId, field.kindId)),
			),
		)
		.slice(0, COLUMN_COUNT);
}

/** Splits text into the characters people see, so an emoji made of several code points counts as one. */
const CHARACTERS = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** A character that shows as space, such as a line break or a tab. */
const SPACE = /^\s+$/;

/**
 * A value as the table shows it, on one line: its line breaks and runs of spaces as single spaces. Up to 100
 * characters show whole. A longer value is cut at the last word boundary in its first 100 characters, and ends
 * with "…"; when no word ends in the second half of them (a long address, say), it is cut at 100. Only as much of
 * the value is read as the cut needs, as a visitor can send a very long one.
 * @param value The stored value.
 */
export function previewText(value: string): string {
	const characters: Array<string> = [];
	let spaced = false;

	for (const { segment } of CHARACTERS.segment(value)) {
		// Spaces show only between words, one at a time.
		if (SPACE.test(segment)) {
			spaced = characters.length > 0;
			continue;
		}

		if (spaced) {
			characters.push(' ');
			spaced = false;
		}

		characters.push(segment);

		// One character more than is shown says the value is longer, and where its last word ends.
		if (characters.length > PREVIEW_LENGTH) {
			break;
		}
	}

	if (characters.length <= PREVIEW_LENGTH) {
		return characters.join('');
	}

	// A space right after the 100th character ends a word too.
	const space = characters.lastIndexOf(' ', PREVIEW_LENGTH);
	const end = space >= PREVIEW_LENGTH / 2 ? space : PREVIEW_LENGTH;

	return `${characters.slice(0, end).join('').trimEnd()}…`;
}

/**
 * The page a submission was sent from, from the address Store Data stored: a link only to an http or https
 * address, so a stored address can never run script or open anything else.
 * @param url The stored address.
 * @returns The link, with the address's host and path to show; undefined for no address, or one a link must not
 * open.
 */
export function submissionPage(url: string | null | undefined): FormulateSubmissionPage | undefined {
	const address = absoluteUrl(url);

	if (address?.protocol !== 'https:' && address?.protocol !== 'http:') {
		return undefined;
	}

	// The host as the browser sends it: a name in another script shows in its ASCII form, so a look-alike shows as
	// what it is. A user name before the host is left out, as it can look like a host.
	return { href: address.href, host: address.host, path: readablePath(address.pathname) };
}

/** An absolute URL, or undefined for none or anything else. */
function absoluteUrl(url: string | null | undefined): URL | undefined {
	try {
		return url ? new URL(url) : undefined;
	} catch {
		return undefined;
	}
}

/** A URL's path as people read it: /caf%C3%A9/ as /café/. A path that cannot be decoded is shown as it is. */
function readablePath(path: string): string {
	try {
		return decodeURI(path);
	} catch {
		return path;
	}
}

/**
 * A submission as a row of the table. Each column shows the value stored for its field, found by the field's ID: a
 * field can be renamed after a visitor sent the form, and another can have a name the submission's value has.
 * @param submission The submission, as the API gives it.
 * @param columns The fields the table has a column for.
 */
export function submissionRow(
	submission: SubmissionResponseModel,
	columns: ReadonlyArray<FormulateSubmissionField>,
): FormulateSubmissionRow {
	const page = submissionPage(submission.url);

	return {
		id: submission.id,
		creationDate: submission.creationDate,
		// A long path is cut like a value; the host never is, as it says where the link goes.
		...(page ? { page: { ...page, path: previewText(page.path) } } : {}),
		values: columns.map((column) => previewText(valuesOf(submission, column.id).join(', '))),
		files: previewText(submission.files.map((file) => file.fileName).join(', ')),
	};
}

/** The values a submission stored for a field. */
function valuesOf(submission: SubmissionResponseModel, fieldId: string) {
	return submission.values.filter((value) => isSameGuid(value.fieldId, fieldId)).map((value) => value.value);
}

/**
 * What the sidebar shows of a submission: each field the submission stored a value or file for, those on the form
 * in the form's order, under their current names; then the ones no longer on the form, in the order they were
 * stored, under the names they were stored with.
 * @param submission The submission, as the API gives it.
 * @param fields The form's fields, in order.
 */
export function submissionEntries(
	submission: SubmissionResponseModel,
	fields: ReadonlyArray<FormulateSubmissionField>,
): Array<FormulateSubmissionEntry> {
	const entries: Array<FormulateSubmissionEntry> = [];
	const entryOf = (fieldId: string, storedName: string) => {
		let entry = entries.find((candidate) => isSameGuid(candidate.fieldId, fieldId));

		if (!entry) {
			const field = fields.find((candidate) => isSameGuid(candidate.id, fieldId));
			entry = { fieldId: field?.id ?? fieldId, name: field?.name || storedName || null, values: [], files: [], onForm: !!field };
			entries.push(entry);
		}

		return entry;
	};

	for (const value of submission.values) {
		entryOf(value.fieldId, value.fieldName).values.push(value.value);
	}

	for (const file of submission.files) {
		entryOf(file.fieldId, file.fieldName).files.push(file);
	}

	const position = (entry: FormulateSubmissionEntry) => {
		const index = fields.findIndex((field) => isSameGuid(field.id, entry.fieldId));
		return index === -1 ? fields.length : index;
	};

	// A stable sort: the fields no longer on the form keep the order they were stored in.
	return entries.sort((a, b) => position(a) - position(b));
}
