import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormulateFormFieldPickerElement } from '../../../core/pickers/form-field-picker.element.js';
import type { FormulatePickFieldsModalData } from '../../../core/pickers/pick-fields-modal.token.js';
import { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import type { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';
import { settle } from '../../../test/editors.js';
import { fakeApi, jsonResponse } from '../../../test/fake-api.js';
import { BUTTON, fieldKind, HEADER, serveForms, TEXT, UNKNOWN_KIND } from '../../../test/forms.js';
import { API } from '../../../test/kind-items.js';
import { loadFormulateEnglishTerms } from '../../../test/localization.js';
import { SERVER_CONSTANTS } from '../../../test/server-constants.js';
import { createTestHost } from '../../../test/test-host.js';
import { click, typeInto } from '../../../test/ui.js';
import { FormulateDesignedEmailHandlerEditorElement } from './designed-email-handler-editor.element.js';
import { givesEmailLine } from './email-fields.js';
import type { FormulateEmailRecipientsInputElement } from './email-recipients-input.element.js';
import { FORMULATE_SAMPLE_EMAIL_VIEWS } from './email-view-paths.js';
import { FormulateSendEmailHandlerEditorElement } from './send-email-handler-editor.element.js';

const NAME_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const EMAIL_ID = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
const HEADING_ID = '3d8f6b4e-2a5c-4d9f-b7e1-0c2e4a6b8d03';

/** The form's fields, as the designer gives them to a handler's editor. */
const FORM_FIELDS = [
	{ id: NAME_ID, kindId: TEXT, name: 'Name', alias: 'name', label: 'Your name', category: null, validations: [] },
	{ id: EMAIL_ID, kindId: TEXT, name: 'Email', alias: 'email', label: 'Your email', category: null, validations: [] },
	{ id: HEADING_ID, kindId: HEADER, name: 'Heading', alias: 'heading', label: null, category: null, validations: [] },
];

/** A configuration as the server gives it (EmailHandlerConfiguration and SendEmailConfiguration). */
const SEND_EMAIL = {
	senderEmail: 'forms@example.com',
	recipients: [{ email: 'team@example.com' }],
	recipientFields: [{ id: EMAIL_ID }],
	deliveryType: 'CC ',
	subject: 'New enquiry',
	message: 'Someone wrote in.\nPlease reply.',
	appendFields: true,
	appendPayload: false,
	excludeFieldLabels: true,
	includeHiddenFields: false,
	fieldsToInclude: [{ id: NAME_ID }],
};

/** A configuration as the server gives it (EmailHandlerConfiguration and DesignedEmailConfiguration). */
const DESIGNED_EMAIL = {
	senderEmail: null,
	recipients: [{ email: 'team@example.com' }],
	recipientFields: [],
	deliveryType: 'to',
	subject: 'Designed',
	message: null,
	subjectRazorPath: null,
	htmlEmailRazorPath: '~/Views/Email.cshtml',
	textEmailRazorPath: null,
};

afterEach(() => {
	document.body.replaceChildren();
});

/** Shows an editor in the handler dialog's place, with the form's fields, and records what it stores. */
async function render<T extends FormulateKindEditorElementBase>(element: T, value: unknown, readonly = false) {
	serveForms();
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	element.value = value;
	element.context = { formFields: FORM_FIELDS };
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? structuredClone(element.value) : 'not an UmbChangeEvent');
	});
	host.append(element);
	for (let i = 0; i < 3; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}

	const shadow = element.shadowRoot!;
	const query = <E extends Element = HTMLInputElement>(selector: string) => shadow.querySelector(selector) as E;

	return {
		element,
		changes,
		shadow,
		sender: query('uui-input#sender-email'),
		recipients: query<FormulateEmailRecipientsInputElement>('formulate-email-recipients-input#recipients'),
		recipientFields: query<FormulateFormFieldPickerElement>('formulate-form-field-picker#recipient-fields'),
		deliveryType: query('uui-select#delivery-type'),
		subject: query('uui-input#subject'),
		message: query('uui-textarea#message'),
	};
}

/** The options of a uui-select: [name, value, selected]. */
function optionsOf(select: Element) {
	return ((select as Element & { options: Array<{ name: string; value: string; selected?: boolean }> }).options ?? []).map(
		(option) => [option.name, option.value, !!option.selected],
	);
}

/** Picks an option of a uui-select as a user does. */
function choose(select: Element, value: string) {
	(select as HTMLInputElement).value = value;
	select.dispatchEvent(new Event('change'));
}

/** Switches a uui-toggle as a user does. */
function toggle(element: Element, checked: boolean) {
	(element as HTMLInputElement).checked = checked;
	element.dispatchEvent(new Event('change'));
}

/** Gives an input that stores a list (the pickers, the recipients) a new value, as a user does. */
function pick(element: Element, value: unknown) {
	(element as HTMLElement & { value: unknown }).value = value;
	element.dispatchEvent(new UmbChangeEvent());
}

function togglesOf(shadow: ShadowRoot) {
	return Object.fromEntries(
		[...shadow.querySelectorAll('uui-toggle')].map((element) => [element.id, element.checked]),
	);
}

describe('Formulate Email handler editor', () => {
	it('shows each setting SendEmailConfiguration reads, and stores nothing', async () => {
		const editor = await render(new FormulateSendEmailHandlerEditorElement(), SEND_EMAIL);
		const fieldsToInclude = editor.shadow.querySelector('formulate-form-field-picker#fields-to-include') as FormulateFormFieldPickerElement;

		expect([editor.sender.value, editor.recipients.value, editor.subject.value, editor.message.value]).toStrictEqual([
			'forms@example.com',
			[{ email: 'team@example.com' }],
			'New enquiry',
			'Someone wrote in.\nPlease reply.',
		]);
		// Delivery is read as the server reads it: trimmed, in any case.
		expect(optionsOf(editor.deliveryType)).toStrictEqual([
			['formulate_deliveryTo', 'to', false],
			['formulate_deliveryCc', 'cc', true],
			['formulate_deliveryBcc', 'bcc', false],
		]);
		expect(togglesOf(editor.shadow)).toStrictEqual({
			'append-fields': true,
			'include-hidden-fields': false,
			'exclude-field-labels': true,
			'append-payload': false,
		});
		// The pickers choose from the form's fields, by their IDs.
		expect(
			[editor.recipientFields, fieldsToInclude].map((picker) => [picker.value, picker.fields, picker.headline]),
		).toStrictEqual([
			[[EMAIL_ID], FORM_FIELDS, 'formulate_recipientFields'],
			[[NAME_ID], FORM_FIELDS, 'formulate_fieldsToInclude'],
		]);
		expect(editor.changes).toStrictEqual([]);
	});

	it('shows a delivery the server does not know as Bcc, which is how the server sends it', async () => {
		for (const deliveryType of [null, 'everyone']) {
			const { deliveryType: select, changes } = await render(new FormulateSendEmailHandlerEditorElement(), {
				...SEND_EMAIL,
				deliveryType,
			});

			expect([optionsOf(select).find(([, , selected]) => selected)?.[1], changes]).toStrictEqual(['bcc', []]);
		}
	});

	it('stores each change, keeping the settings it does not edit and what else a picked field has', async () => {
		const stored = { ...SEND_EMAIL, recipientFields: [{ id: EMAIL_ID, note: 'kept' }], future: { kept: true } };
		const editor = await render(new FormulateSendEmailHandlerEditorElement(), stored);
		const fieldsToInclude = editor.shadow.querySelector('formulate-form-field-picker#fields-to-include')!;

		typeInto(editor.sender, 'Forms <forms@example.com>');
		choose(editor.deliveryType, 'to');
		typeInto(editor.subject, 'Hello');
		typeInto(editor.message, 'Hi');
		pick(editor.recipients, [{ email: 'team@example.com' }, { email: 'office@example.com' }]);
		pick(editor.recipientFields, [EMAIL_ID, NAME_ID]);
		toggle(editor.shadow.querySelector('uui-toggle#append-payload')!, true);
		toggle(editor.shadow.querySelector('uui-toggle#exclude-field-labels')!, false);
		toggle(editor.shadow.querySelector('uui-toggle#include-hidden-fields')!, true);
		toggle(editor.shadow.querySelector('uui-toggle#append-fields')!, false);
		pick(fieldsToInclude, []);

		expect(editor.changes).toHaveLength(11);
		expect(editor.changes.at(-1)).toStrictEqual({
			senderEmail: 'Forms <forms@example.com>',
			recipients: [{ email: 'team@example.com' }, { email: 'office@example.com' }],
			recipientFields: [{ id: EMAIL_ID, note: 'kept' }, { id: NAME_ID }],
			deliveryType: 'to',
			subject: 'Hello',
			message: 'Hi',
			appendFields: false,
			appendPayload: true,
			excludeFieldLabels: false,
			includeHiddenFields: true,
			fieldsToInclude: [],
			future: { kept: true },
		});
	});

	it('starts from no configuration, and stores only what is set', async () => {
		const editor = await render(new FormulateSendEmailHandlerEditorElement(), undefined);

		expect([editor.sender.value, editor.recipients.value, editor.recipientFields.value, togglesOf(editor.shadow)]).toStrictEqual([
			'',
			[],
			[],
			{ 'append-fields': false, 'include-hidden-fields': false, 'exclude-field-labels': false, 'append-payload': false },
		]);
		typeInto(editor.subject, 'Hello');

		expect(editor.changes).toStrictEqual([{ subject: 'Hello' }]);
	});

	it('can only be read when it is read-only', async () => {
		const editor = await render(new FormulateSendEmailHandlerEditorElement(), SEND_EMAIL, true);

		expect([
			[editor.sender, editor.subject, editor.message, ...editor.shadow.querySelectorAll('uui-toggle')].every((input) =>
				input.hasAttribute('readonly'),
			),
			editor.deliveryType.hasAttribute('disabled'),
			[editor.recipients, ...editor.shadow.querySelectorAll('formulate-form-field-picker')].map(
				(input) => (input as HTMLElement & { readonly: boolean }).readonly,
			),
		]).toStrictEqual([true, true, [true, true, true]]);
	});
});

// The kinds as the definitions endpoint gives them, with the flags each definition has on the server.
const HIDDEN = '3df6facd-2ffa-4055-b0be-94e8fa8e7c4a';
const RICH_TEXT = '6fcdfdc9-293f-4913-b762-f4ba502216eb';
const TEXT_CONSTANT = 'd9b1a60a-1186-4440-887b-93195c760b5e';
const UPLOAD = 'dfefa5ec-0200-4806-a2ab-0ab22058021d';
const RECAPTCHA = '80c0543d-419e-4ddf-ab05-2c2d052b97a2';
const EMAIL_FIELD_KINDS = [
	fieldKind({ kindId: TEXT, name: 'Text' }),
	fieldKind({ kindId: HIDDEN, name: 'Hidden' }),
	fieldKind({ kindId: HEADER, name: 'Header', isStored: false, isTransitory: true }),
	fieldKind({ kindId: RICH_TEXT, name: 'Rich Text', isStored: false, isTransitory: true }),
	fieldKind({ kindId: BUTTON, name: 'Button', isTransitory: true }),
	fieldKind({ kindId: TEXT_CONSTANT, name: 'Text Constant', isServerSideOnly: true, isTransitory: true }),
	fieldKind({ kindId: UPLOAD, name: 'Upload' }),
	fieldKind({ kindId: RECAPTCHA, name: 'reCAPTCHA', isStored: false }),
];

/** A form with a field of each kind, and one of a kind that is not installed. */
const EVERY_KIND_FIELDS = [
	['Name', TEXT],
	['Source', HIDDEN],
	['Heading', HEADER],
	['Intro', RICH_TEXT],
	['Send', BUTTON],
	['Campaign', TEXT_CONSTANT],
	['CV', UPLOAD],
	['Captcha', RECAPTCHA],
	['Odd', UNKNOWN_KIND],
].map(([name, kindId], index) => ({
	id: `00000000-0000-4000-8000-0000000000${String(index + 10)}`,
	kindId: kindId!,
	name: name!,
	alias: name!.toLowerCase(),
	label: null,
	category: null,
	validations: [],
}));

/**
 * Shows the Send Email editor for a form with a field of each kind, and gives what the dialog of one of its pickers
 * offers, by the fields' names.
 */
async function renderEveryKindForm(value: object) {
	fakeApi((request) => jsonResponse(new URL(request.url).pathname === `${API}/definition/form-field` ? EMAIL_FIELD_KINDS : []));
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	// The dialogs the pickers open, as the back office's modal manager holds them.
	const modals = new UmbModalManagerContext(host);
	const opened: Array<UmbModalContext> = [];
	modals.modals.subscribe((stack) => stack.forEach((modal) => opened.includes(modal) || opened.push(modal)));
	const editor = new FormulateSendEmailHandlerEditorElement();
	editor.value = value;
	editor.context = { formFields: EVERY_KIND_FIELDS };
	host.append(editor);
	await settle(editor);
	const namesOffered = async (id: string) => {
		const picker = editor.shadowRoot!.querySelector(`formulate-form-field-picker#${id}`)!;
		const before = opened.length;
		click(picker.shadowRoot!.querySelector('#btn-add')!);
		await expect.poll(() => opened.length).toBe(before + 1);
		const dialog = opened.at(-1)!;
		dialog.reject();

		return (dialog.data as FormulatePickFieldsModalData).fields.map((field) => field.name);
	};

	return { editor, namesOffered };
}

/** The ID of the field of EVERY_KIND_FIELDS with this name. */
function idOf(name: string) {
	return EVERY_KIND_FIELDS.find((field) => field.name === name)!.id;
}

describe('Formulate Email handler editor, the fields to include', () => {
	it('can write a line for a field with a posted value, for an upload, and for a Text Constant, its text', () => {
		const lines = (includeHiddenFields: boolean) =>
			EVERY_KIND_FIELDS.map((field) => [
				field.name,
				givesEmailLine(
					EMAIL_FIELD_KINDS.find((kind) => kind.kindId === field.kindId),
					includeHiddenFields,
				),
			]);

		// SendEmailContentBuilder.Build: no value is posted for a transitory, hidden or not installed kind
		// (AttemptSubmitForm.GetInputFieldIds), the value of a kind that stores nothing is left out, and so is a
		// Hidden field's, unless the handler includes hidden fields.
		expect(lines(true)).toStrictEqual([
			['Name', true],
			['Source', true],
			['Heading', false],
			['Intro', false],
			['Send', false],
			['Campaign', true],
			['CV', true],
			['Captcha', false],
			['Odd', false],
		]);
		expect(lines(false)).toStrictEqual([
			['Name', true],
			['Source', false],
			['Heading', false],
			['Intro', false],
			['Send', false],
			['Campaign', true],
			['CV', true],
			['Captcha', false],
			['Odd', false],
		]);
	});

	it('counts a server side kind whose definition is hidden as a hidden field, as the server does', () => {
		const kind = fieldKind({ kindId: '6b1e0c55-1d2f-4a8b-9c3d-4e5f6a7b8c9d', name: 'Secret', isServerSideOnly: true, isHidden: true });

		expect([givesEmailLine(kind, true), givesEmailLine(kind, false)]).toStrictEqual([true, false]);
	});

	it('offers only the fields the email can write a line for, and still a field picked before', async () => {
		const { namesOffered } = await renderEveryKindForm({ ...SEND_EMAIL, fieldsToInclude: [{ id: idOf('Heading') }] });

		expect(await namesOffered('fields-to-include')).toStrictEqual(['Name', 'Heading', 'Campaign', 'CV']);
		// Who to send the email to can come from any field, as before.
		expect(await namesOffered('recipient-fields')).toHaveLength(EVERY_KIND_FIELDS.length);
	});

	it('offers a Hidden field while the email includes hidden fields, and while it is picked', async () => {
		const { editor, namesOffered } = await renderEveryKindForm({ ...SEND_EMAIL, includeHiddenFields: false, fieldsToInclude: [] });

		expect(await namesOffered('fields-to-include')).toStrictEqual(['Name', 'Campaign', 'CV']);

		toggle(editor.shadowRoot!.querySelector('uui-toggle#include-hidden-fields')!, true);
		await settle(editor);
		expect(await namesOffered('fields-to-include')).toStrictEqual(['Name', 'Source', 'Campaign', 'CV']);

		// A field picked before stays offered when the setting is off, so it can still be seen and let go of.
		editor.value = { ...SEND_EMAIL, includeHiddenFields: false, fieldsToInclude: [{ id: idOf('Source') }] };
		await settle(editor);
		expect(await namesOffered('fields-to-include')).toStrictEqual(['Name', 'Source', 'Campaign', 'CV']);
	});
});

describe('Formulate Designed Email handler editor', () => {
	it("shows the settings DesignedEmailConfiguration reads, and none of the Email handler's own", async () => {
		const editor = await render(new FormulateDesignedEmailHandlerEditorElement(), DESIGNED_EMAIL);
		const views = ['subject-view', 'html-view', 'text-view'].map((id) => editor.shadow.querySelector(`uui-input#${id}`) as HTMLInputElement);

		expect([editor.sender.value, editor.recipients.value, editor.recipientFields.value, editor.subject.value, editor.message.value]).toStrictEqual([
			'',
			[{ email: 'team@example.com' }],
			[],
			'Designed',
			'',
		]);
		expect(optionsOf(editor.deliveryType).find(([, , selected]) => selected)?.[1]).toBe('to');
		expect(views.map((input) => input.value)).toStrictEqual(['', '~/Views/Email.cshtml', '']);
		expect([editor.shadow.querySelectorAll('uui-toggle').length, editor.shadow.querySelector('#fields-to-include')]).toStrictEqual([0, null]);
		expect(editor.changes).toStrictEqual([]);
	});

	it("offers the built-in sample views as hints, by the server's paths", async () => {
		loadFormulateEnglishTerms(['formulate_subjectViewDescription', 'formulate_htmlViewDescription', 'formulate_textViewDescription']);
		const editor = await render(new FormulateDesignedEmailHandlerEditorElement(), DESIGNED_EMAIL);
		const description = (label: string) =>
			editor.shadow.querySelector(`umb-property-layout[label="${label}"]`)?.getAttribute('description') ?? '';

		expect(FORMULATE_SAMPLE_EMAIL_VIEWS).toStrictEqual({
			subject: SERVER_CONSTANTS.emailViewPaths.SampleSubject,
			html: SERVER_CONSTANTS.emailViewPaths.SampleHtml,
			text: SERVER_CONSTANTS.emailViewPaths.SampleText,
		});
		expect(
			[
				['formulate_subjectView', FORMULATE_SAMPLE_EMAIL_VIEWS.subject],
				['formulate_htmlView', FORMULATE_SAMPLE_EMAIL_VIEWS.html],
				['formulate_textView', FORMULATE_SAMPLE_EMAIL_VIEWS.text],
			].map(([label, path]) => description(label!).includes(`\`${path}\``)),
		).toStrictEqual([true, true, true]);
	});

	it('stores the view paths as they are typed, keeping the settings it does not edit', async () => {
		const editor = await render(new FormulateDesignedEmailHandlerEditorElement(), { ...DESIGNED_EMAIL, future: 1 });

		typeInto(editor.shadow.querySelector('uui-input#subject-view')!, FORMULATE_SAMPLE_EMAIL_VIEWS.subject);
		typeInto(editor.shadow.querySelector('uui-input#text-view')!, 'Views/Email (Text).cshtml');
		choose(editor.deliveryType, 'bcc');

		expect(editor.changes.at(-1)).toStrictEqual({
			...DESIGNED_EMAIL,
			subjectRazorPath: FORMULATE_SAMPLE_EMAIL_VIEWS.subject,
			textEmailRazorPath: 'Views/Email (Text).cshtml',
			deliveryType: 'bcc',
			future: 1,
		});
	});
});
