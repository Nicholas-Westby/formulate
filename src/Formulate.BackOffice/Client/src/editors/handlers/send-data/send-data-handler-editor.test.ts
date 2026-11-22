import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FormFieldDefinitionModel } from '../../../api/index.js';
import { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import { isSameKind } from '../../../core/kind-id.js';
import type { FormulatePickFieldsModalData } from '../../../core/pickers/pick-fields-modal.token.js';
import { fakeApi, jsonResponse } from '../../../test/fake-api.js';
import { UNKNOWN_KIND } from '../../../test/forms.js';
import { provideIcons } from '../../../test/icons.js';
import { API } from '../../../test/kind-items.js';
import { loadFormulateEnglishTerms } from '../../../test/localization.js';
import { SERVER_CONSTANTS } from '../../../test/server-constants.js';
import { createTestHost } from '../../../test/test-host.js';
import { click, press, typeInto, valuesOf } from '../../../test/ui.js';
import { FormulateFieldMappingsInputElement } from './field-mappings-input.element.js';
import { FormulateSendDataHandlerEditorElement } from './send-data-handler-editor.element.js';
import { FORMULATE_KIND_IDS, isAddedByAddAll, sendsValue } from './send-data-fields.js';
import { FORMULATE_TRANSMISSION_FORMATS } from './transmission-formats.js';

// The kinds as the definitions endpoint gives them, with the flags each definition has on the server.
const TEXT = '17906580-86ea-440b-bc30-9e1b099f803b';
const HIDDEN = '3df6facd-2ffa-4055-b0be-94e8fa8e7c4a';
const DATE = 'e70cb78c-cf52-4611-98b4-556382f23119';
const HEADER = '6383dd2c-68bd-482b-95db-811d09d01bc8';
const BUTTON = 'cde8565c-5e92-4112-9a1f-7ffa1940c53c';
const TEXT_CONSTANT = 'd9b1a60a-1186-4440-887b-93195c760b5e';
const UPLOAD = 'dfefa5ec-0200-4806-a2ab-0ab22058021d';
const RECAPTCHA = '80c0543d-419e-4ddf-ab05-2c2d052b97a2';

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

const FIELD_KINDS = [
	kind(TEXT, 'Text'),
	kind(HIDDEN, 'Hidden', { icon: 'icon-readonly' }),
	kind(DATE, 'Date'),
	kind(HEADER, 'Header', { isStored: false, isTransitory: true }),
	kind(BUTTON, 'Button', { isTransitory: true }),
	kind(TEXT_CONSTANT, 'Text Constant', { isServerSideOnly: true, isTransitory: true }),
	kind(UPLOAD, 'Upload'),
	kind(RECAPTCHA, 'reCAPTCHA', { isStored: false }),
];

const NAME_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const EMAIL_ID = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
const SOURCE_ID = '3d8f6b4e-2a5c-4d9f-b7e1-0c2e4a6b8d03';
const VISIT_ID = '4e9a7c5f-3b6d-4ea0-88f2-1d3f5b7c9e04';
const HEADING_ID = '5fab8d60-4c7e-4fb1-99a3-2e4a6c8d0f05';
const SEND_ID = '60bc9e71-5d8f-4ac2-8ab4-3f5b7d9e1a06';
const CAMPAIGN_ID = '71cdaf82-6e9a-4bd3-9bc5-4a6c8eaf2b07';
const CV_ID = '82debf93-7fab-4ce4-8cd6-5b7d9fba3c08';
const CAPTCHA_ID = '93efc0a4-8abc-4df5-9de7-6c8eafcb4d09';
const ODD_ID = 'a4f0d1b5-9bcd-4e06-aef8-7d9fbadc5e10';
// A field that was mapped, then deleted from the form.
const GONE_ID = 'b5a1e2c6-acde-4f17-8f09-8eafcbed6f11';

/** The form's fields, as the designer gives them to a handler's editor. */
const FORM_FIELDS = [
	{ id: NAME_ID, kindId: TEXT, name: 'Name', alias: 'name' },
	{ id: EMAIL_ID, kindId: TEXT, name: 'Email', alias: 'email' },
	{ id: SOURCE_ID, kindId: HIDDEN, name: 'Source', alias: 'source' },
	{ id: VISIT_ID, kindId: DATE, name: 'Visit date', alias: '' },
	{ id: HEADING_ID, kindId: HEADER, name: 'Heading', alias: 'heading' },
	{ id: SEND_ID, kindId: BUTTON, name: 'Send', alias: 'send' },
	{ id: CAMPAIGN_ID, kindId: TEXT_CONSTANT, name: 'Campaign', alias: 'campaign' },
	{ id: CV_ID, kindId: UPLOAD, name: 'CV', alias: 'cv' },
	{ id: CAPTCHA_ID, kindId: RECAPTCHA, name: 'Captcha', alias: 'captcha' },
	{ id: ODD_ID, kindId: UNKNOWN_KIND, name: 'Odd', alias: 'odd' },
].map((field) => ({ ...field, label: null, category: null, validations: [] }));

/** Formulate 3 stored field IDs without dashes, in upper case. */
const EMAIL_AS_STORED = EMAIL_ID.replace(/-/g, '').toUpperCase();

/** A configuration as the server gives it (SendDataConfiguration). */
const SEND_DATA = {
	url: 'https://crm.example.com/forms?source=formulate',
	method: 'POST',
	transmissionFormat: 'JSON',
	fields: [
		{ id: NAME_ID, name: 'full_name' },
		{ id: EMAIL_AS_STORED, name: 'email', note: 'kept' },
		{ id: GONE_ID, name: 'gone' },
	],
};

beforeAll(() => {
	loadFormulateEnglishTerms(['formulate_removeItem', 'formulate_moveItem', 'formulate_fieldNameSent']);
});

afterEach(() => {
	document.body.replaceChildren();
});

/** A back office host whose definitions endpoint gives the kinds above, with the back office's icons. */
function createHost() {
	fakeApi((request) =>
		jsonResponse(new URL(request.url).pathname === `${API}/definition/form-field` ? FIELD_KINDS : []),
	);
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	provideIcons(host);
	return host;
}

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 4; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function record(element: HTMLElement & { value: unknown }) {
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? structuredClone(element.value) : 'not an UmbChangeEvent');
	});
	return changes;
}

describe('Formulate Send Data constants', () => {
	it("spell the transmission formats and kinds as the server's constants do", () => {
		expect(FORMULATE_TRANSMISSION_FORMATS).toStrictEqual(SERVER_CONSTANTS.transmissionFormats);
		expect([
			isSameKind(FORMULATE_KIND_IDS.textConstant, SERVER_CONSTANTS.textConstantField.KindId!),
			isSameKind(FORMULATE_KIND_IDS.upload, SERVER_CONSTANTS.uploadField.KindId!),
		]).toStrictEqual([true, true]);
	});

	it('send a value for the fields the server sends one for, and add all of those but the ones it does not keep', () => {
		const rules = Object.fromEntries(
			FORM_FIELDS.map((field) => {
				const definition = FIELD_KINDS.find((candidate) => candidate.kindId === field.kindId);
				return [field.name, [sendsValue(field, definition), isAddedByAddAll(field, definition)]];
			}),
		);

		expect(rules).toStrictEqual({
			Name: [true, true],
			Email: [true, true],
			// The Hidden kind takes its value from the page, so it is sent.
			Source: [true, true],
			'Visit date': [true, true],
			// No input of their own.
			Heading: [false, false],
			Send: [false, false],
			// Its configured text.
			Campaign: [true, true],
			// Files are never sent.
			CV: [false, false],
			// Its response token is sent only when a mapping names the field on purpose.
			Captcha: [true, false],
			// A kind that is not installed takes no values.
			Odd: [false, false],
		});
	});
});

/** Shows the input as the Send Data editor does, and records the mappings it stores. */
async function renderMappings(value: ReadonlyArray<Record<string, unknown>>, readonly = false) {
	const host = createHost();
	const element = new TestFieldMappingsInput();
	element.fields = FORM_FIELDS;
	element.value = value;
	element.headline = 'Fields to send';
	element.readonly = readonly;
	const changes = record(element);
	host.append(element);
	await settle(element);

	const shadow = element.shadowRoot!;
	const rows = () => [...shadow.querySelectorAll('#rows > .row')];
	const refs = () =>
		rows().map((row) => {
			const ref = row.querySelector('uui-ref-node')!;
			return [ref.getAttribute('name'), ref.getAttribute('detail'), ref.querySelector('umb-icon')?.getAttribute('name') ?? null, ref.hasAttribute('error')];
		});
	const names = () => valuesOf(shadow.querySelectorAll('#rows > .row uui-input.name'));

	return { element, changes, shadow, rows, refs, names };
}

/** The input without the back office's modals: the dialog it would open, and the pick the user makes there. */
class TestFieldMappingsInput extends FormulateFieldMappingsInputElement {
	picks?: Array<string>;
	opened: Array<{ data: FormulatePickFieldsModalData; selection: Array<string> }> = [];

	protected override async pickIds(data: FormulatePickFieldsModalData, selection: Array<string>) {
		this.opened.push({ data: structuredClone(data), selection: [...selection] });
		return this.picks;
	}
}
customElements.define('formulate-test-field-mappings-input', TestFieldMappingsInput);

describe('Formulate field mappings input', () => {
	it('shows each mapped field by name, with its alias and icon, and the name it is sent with', async () => {
		const { shadow, refs, names, changes } = await renderMappings(SEND_DATA.fields);

		expect(refs()).toStrictEqual([
			['Name', 'name', 'icon-document-dashed-line', false],
			['Email', 'email', 'icon-document-dashed-line', false],
			['formulate_fieldNotFound', GONE_ID, 'icon-alert', true],
		]);
		expect(names()).toStrictEqual(['full_name', 'email', 'gone']);
		expect([...shadow.querySelectorAll('#rows > .row uui-input.name')].map((input) => input.getAttribute('label'))).toStrictEqual([
			'Name sent for Name',
			'Name sent for Email',
			'Name sent for item 3',
		]);
		expect([...shadow.querySelectorAll('#rows > .row .handle')].map((handle) => handle.getAttribute('aria-label'))).toStrictEqual([
			'Move Name',
			'Move Email',
			'Move item 3',
		]);
		expect([...shadow.querySelectorAll('#rows > .row uui-button.remove')].map((button) => button.getAttribute('label'))).toStrictEqual([
			'Remove Name',
			'Remove Email',
			'Remove item 3',
		]);
		expect([shadow.querySelector('#no-fields'), changes]).toStrictEqual([null, []]);
	});

	it('says that no fields are sent when none are mapped', async () => {
		const { shadow } = await renderMappings([]);

		expect(shadow.querySelector('#no-fields')?.textContent?.trim()).toBe('formulate_noFieldsSent');
	});

	it('stores a name as it is typed, keeping what else the mapping has, and removes a mapping', async () => {
		const { element, shadow, changes } = await renderMappings(SEND_DATA.fields);

		typeInto(shadow.querySelectorAll('#rows > .row uui-input.name')[1]!, 'email_address');
		click(shadow.querySelectorAll('#rows > .row uui-button.remove')[2]!);
		await settle(element);

		expect(changes).toStrictEqual([
			[{ id: NAME_ID, name: 'full_name' }, { id: EMAIL_AS_STORED, name: 'email_address', note: 'kept' }, { id: GONE_ID, name: 'gone' }],
			[{ id: NAME_ID, name: 'full_name' }, { id: EMAIL_AS_STORED, name: 'email_address', note: 'kept' }],
		]);
	});

	it("adds every field that sends a value and is not mapped yet, in the form's order, by its alias", async () => {
		const { element, shadow, refs, changes } = await renderMappings(SEND_DATA.fields);
		const addAll = shadow.querySelector('uui-button#add-all')!;

		click(addAll);
		await settle(element);
		// Nothing is left to add.
		click(addAll);
		await settle(element);

		expect(changes).toStrictEqual([
			[
				...SEND_DATA.fields,
				{ id: SOURCE_ID, name: 'source' },
				// No alias: the server sends the field's name.
				{ id: VISIT_ID, name: 'Visit date' },
				{ id: CAMPAIGN_ID, name: 'campaign' },
			],
		]);
		expect(refs().map(([name]) => name)).toStrictEqual(['Name', 'Email', 'formulate_fieldNotFound', 'Source', 'Visit date', 'Campaign']);
		expect(addAll.hasAttribute('disabled')).toBe(true);
	});

	it("opens the dialog on the form's fields that send a value, keeps the mappings still picked, and adds the new ones by their alias", async () => {
		const { element, shadow, changes } = await renderMappings(SEND_DATA.fields);
		element.picks = [EMAIL_ID, CAPTCHA_ID];

		click(shadow.querySelector('uui-button#choose')!);
		await settle(element);

		expect(element.opened).toHaveLength(1);
		expect(element.opened[0]!.data.headline).toBe('Fields to send');
		// As Add all fields does, it leaves out the heading, the button, the file and the kind that is not installed.
		expect(element.opened[0]!.data.fields.map(({ id, name, alias }) => [id, name, alias])).toStrictEqual(
			FORM_FIELDS.filter(({ id }) => ![HEADING_ID, SEND_ID, CV_ID, ODD_ID].includes(id)).map(({ id, name, alias }) => [id, name, alias]),
		);
		expect(element.opened[0]!.selection).toStrictEqual([NAME_ID, EMAIL_ID]);
		// Name is no longer picked; the field that is gone stays until it is removed.
		expect(changes).toStrictEqual([[{ id: EMAIL_AS_STORED, name: 'email', note: 'kept' }, { id: GONE_ID, name: 'gone' }, { id: CAPTCHA_ID, name: 'captcha' }]]);
	});

	it('still offers a field that sends nothing while it is mapped, so it can be let go of', async () => {
		const { element, shadow, changes } = await renderMappings([
			{ id: HEADING_ID, name: 'heading' },
			{ id: NAME_ID, name: 'name' },
		]);
		element.picks = [NAME_ID];

		click(shadow.querySelector('uui-button#choose')!);
		await settle(element);

		expect(element.opened[0]!.data.fields.map(({ id }) => id)).toStrictEqual([
			NAME_ID,
			EMAIL_ID,
			SOURCE_ID,
			VISIT_ID,
			HEADING_ID,
			CAMPAIGN_ID,
			CAPTCHA_ID,
		]);
		expect(element.opened[0]!.selection).toStrictEqual([HEADING_ID, NAME_ID]);
		// The heading is no longer picked.
		expect(changes).toStrictEqual([[{ id: NAME_ID, name: 'name' }]]);
	});

	it('moves a mapping with the arrow keys on its handle', async () => {
		const { element, rows, names } = await renderMappings(SEND_DATA.fields);

		press(rows()[1]!.querySelector('.handle')!, 'ArrowUp');
		await settle(element);

		expect(names()).toStrictEqual(['email', 'full_name', 'gone']);
	});

	it('can only be read when it is read-only', async () => {
		const { shadow, names } = await renderMappings(SEND_DATA.fields, true);

		expect([
			names(),
			[...shadow.querySelectorAll('uui-input.name')].every((input) => input.hasAttribute('readonly')),
			shadow.querySelectorAll('.handle, uui-button.remove, uui-button#choose, uui-button#add-all').length,
		]).toStrictEqual([['full_name', 'email', 'gone'], true, 0]);
	});
});

/** Shows the editor in the handler dialog's place, with the form's fields, and records what it stores. */
async function renderEditor(value: unknown, readonly = false) {
	const host = createHost();
	const element = new FormulateSendDataHandlerEditorElement();
	element.value = value;
	element.context = { formFields: FORM_FIELDS };
	element.readonly = readonly;
	const changes = record(element);
	host.append(element);
	await settle(element);

	const shadow = element.shadowRoot!;

	return {
		element,
		changes,
		shadow,
		url: shadow.querySelector('uui-input#url') as HTMLInputElement,
		method: shadow.querySelector('uui-select#method')!,
		format: shadow.querySelector('uui-select#transmission-format')!,
		fields: shadow.querySelector('formulate-field-mappings-input#fields') as FormulateFieldMappingsInputElement,
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

describe('Formulate Send Data handler editor', () => {
	it('shows each setting SendDataConfiguration reads, and stores nothing', async () => {
		const editor = await renderEditor(SEND_DATA);

		expect(editor.url.value).toBe('https://crm.example.com/forms?source=formulate');
		expect(optionsOf(editor.method)).toStrictEqual([
			['GET', 'GET', false],
			['POST', 'POST', true],
		]);
		expect(optionsOf(editor.format)).toStrictEqual([
			['Query String', 'Query String', false],
			['Form Body', 'Form Body', false],
			['JSON', 'JSON', true],
			['HubSpot JSON', 'HubSpot JSON', false],
		]);
		expect([editor.fields.value, editor.fields.fields, editor.fields.headline]).toStrictEqual([
			SEND_DATA.fields,
			FORM_FIELDS,
			'formulate_fieldsToSend',
		]);
		expect(editor.changes).toStrictEqual([]);
	});

	it('shows what the server sends with when the method or format is blank, in another case, or one it does not know', async () => {
		const blank = await renderEditor({ ...SEND_DATA, method: '', transmissionFormat: null });
		const cased = await renderEditor({ ...SEND_DATA, method: 'post', transmissionFormat: 'hubspot json' });
		const unknown = await renderEditor({ ...SEND_DATA, method: 'PUT', transmissionFormat: 'XML' });
		const picked = (select: Element) => optionsOf(select).find(([, , selected]) => selected);

		expect([blank, cased, unknown].map(({ method, format }) => [picked(method), picked(format)])).toStrictEqual([
			[['GET', 'GET', true], ['Query String', 'Query String', true]],
			[['POST', 'POST', true], ['HubSpot JSON', 'HubSpot JSON', true]],
			[['PUT', 'PUT', true], ['formulate_unknownTransmissionFormat', 'XML', true]],
		]);
		expect([blank, cased, unknown].map(({ changes }) => changes)).toStrictEqual([[], [], []]);
	});

	it('stores each change, keeping the settings it does not edit, such as the result handler', async () => {
		const editor = await renderEditor({ ...SEND_DATA, resultHandler: 'MySite.CrmResult, MySite' });

		typeInto(editor.url, 'https://hooks.example.com/in');
		choose(editor.method, 'GET');
		choose(editor.format, 'Form Body');
		editor.fields.value = [{ id: NAME_ID, name: 'name' }];
		editor.fields.dispatchEvent(new UmbChangeEvent());

		expect(editor.changes).toStrictEqual([
			{ ...SEND_DATA, resultHandler: 'MySite.CrmResult, MySite', url: 'https://hooks.example.com/in' },
			{ ...SEND_DATA, resultHandler: 'MySite.CrmResult, MySite', url: 'https://hooks.example.com/in', method: 'GET' },
			{
				...SEND_DATA,
				resultHandler: 'MySite.CrmResult, MySite',
				url: 'https://hooks.example.com/in',
				method: 'GET',
				transmissionFormat: 'Form Body',
			},
			{
				url: 'https://hooks.example.com/in',
				method: 'GET',
				transmissionFormat: 'Form Body',
				fields: [{ id: NAME_ID, name: 'name' }],
				resultHandler: 'MySite.CrmResult, MySite',
			},
		]);
	});

	it('starts from no configuration, and stores only what is set', async () => {
		const editor = await renderEditor(undefined);

		expect([editor.url.value, optionsOf(editor.method)[0]![2], optionsOf(editor.format)[0]![2], editor.fields.value]).toStrictEqual([
			'',
			true,
			true,
			[],
		]);
		typeInto(editor.url, 'https://hooks.example.com/in');

		expect(editor.changes).toStrictEqual([{ url: 'https://hooks.example.com/in' }]);
	});

	it('can only be read when it is read-only', async () => {
		const editor = await renderEditor(SEND_DATA, true);

		expect([
			editor.url.hasAttribute('readonly'),
			editor.method.hasAttribute('disabled'),
			editor.format.hasAttribute('disabled'),
			editor.fields.readonly,
		]).toStrictEqual([true, true, true, true]);
	});
});
