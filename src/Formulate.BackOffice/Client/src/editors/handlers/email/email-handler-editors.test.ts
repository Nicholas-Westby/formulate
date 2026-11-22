import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, describe, expect, it } from 'vitest';
import type { FormulateFormFieldPickerElement } from '../../../core/pickers/form-field-picker.element.js';
import { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import type { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';
import { HEADER, serveForms, TEXT } from '../../../test/forms.js';
import { loadFormulateEnglishTerms } from '../../../test/localization.js';
import { SERVER_CONSTANTS } from '../../../test/server-constants.js';
import { createTestHost } from '../../../test/test-host.js';
import { typeInto } from '../../../test/ui.js';
import { FormulateDesignedEmailHandlerEditorElement } from './designed-email-handler-editor.element.js';
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
