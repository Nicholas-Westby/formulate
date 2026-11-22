import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BUTTON, HEADER, serveForms, TEXT, UNKNOWN_KIND } from '../../test/forms.js';
import { provideIcons } from '../../test/icons.js';
import { loadFormulateEnglishTerms } from '../../test/localization.js';
import { createTestHost } from '../../test/test-host.js';
import { click } from '../../test/ui.js';
import { manifests as bundle } from '../../bundle.manifests.js';
import { FormulateDefinitionsContext } from '../definitions.context.js';
import { FormulateFormFieldPickerElement } from './form-field-picker.element.js';
import type { FormulatePickableField } from './form-field-kinds.js';
import { FormulatePickFieldsModalElement } from './pick-fields-modal.element.js';
import {
	FORMULATE_PICK_FIELDS_MODAL,
	FORMULATE_PICK_FIELDS_MODAL_ALIAS,
	type FormulatePickFieldsModalData,
	type FormulatePickFieldsModalValue,
} from './pick-fields-modal.token.js';

const NAME_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const EMAIL_ID = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
const HEADING_ID = '3d8f6b4e-2a5c-4d9f-b7e1-0c2e4a6b8d03';
const SEND_ID = '4e9a7c5f-3b6d-4ea0-88f2-1d3f5b7c9e04';
const ODD_ID = '5fab8d60-4c7e-4fb1-99a3-2e4a6c8d0f05';
// A field that was picked, then deleted from the form.
const GONE_ID = 'a07d3f96-2c8a-4e6e-9bd5-8a4c6e2b7f08';

/** The form's fields, as the designer holds them; one is of a kind that is not installed, one has no name. */
const FIELDS: Array<FormulatePickableField> = [
	{ id: NAME_ID, kindId: TEXT, name: 'Name', alias: 'name' },
	{ id: EMAIL_ID, kindId: TEXT, name: 'Email', alias: 'email' },
	{ id: HEADING_ID, kindId: HEADER, name: 'Heading', alias: 'heading' },
	{ id: SEND_ID, kindId: BUTTON, name: null, alias: 'send' },
	{ id: ODD_ID, kindId: UNKNOWN_KIND, name: 'Odd', alias: null },
];

/** Formulate 3 stored field IDs without dashes, in upper case. */
const EMAIL_AS_STORED = EMAIL_ID.replace(/-/g, '').toUpperCase();

beforeAll(() => {
	// The names of the Remove buttons and of the dialog's fields; the other terms show as their keys.
	loadFormulateEnglishTerms(['formulate_removeItem', 'formulate_fieldAndAlias']);
});

afterEach(() => {
	document.body.replaceChildren();
});

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 4; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Opens the dialog as the modal manager would, with a modal context that holds its data and value. */
async function openDialog(data: FormulatePickFieldsModalData, value: FormulatePickFieldsModalValue) {
	const host = createTestHost();
	const modals = new UmbModalManagerContext(host);
	const modalContext = modals.open(host, FORMULATE_PICK_FIELDS_MODAL, { data, value }) as UmbModalContext<
		FormulatePickFieldsModalData,
		FormulatePickFieldsModalValue
	>;
	const element = new FormulatePickFieldsModalElement();
	element.modalContext = modalContext;
	element.data = modalContext.data;
	host.append(element);
	await settle(element);

	return { element, modalContext, shadow: element.shadowRoot! };
}

/** Whether the dialog was submitted (with its value), closed, or is still open shortly after. */
function outcomeOf(modalContext: UmbModalContext<FormulatePickFieldsModalData, FormulatePickFieldsModalValue>) {
	return Promise.race([
		modalContext.onSubmit().then(
			(value) => ({ submitted: value }),
			() => 'closed',
		),
		new Promise((resolve) => setTimeout(() => resolve('open'), 20)),
	]);
}

/** The dialog's fields: [label, which is the name a screen reader gives the item, alias, picked]. */
function menuItems(shadow: ShadowRoot) {
	return [...shadow.querySelectorAll('uui-menu-item')].map((item) => [
		item.getAttribute('label'),
		item.querySelector('.alias')?.textContent ?? null,
		item.hasAttribute('selected'),
	]);
}

describe('Formulate pick fields dialog', () => {
	const data: FormulatePickFieldsModalData = {
		headline: 'Recipient fields',
		fields: [
			{ id: NAME_ID, name: 'Name', alias: 'name', icon: 'icon-autofill' },
			{ id: EMAIL_ID, name: 'Email', alias: 'email', icon: 'icon-autofill' },
			{ id: HEADING_ID, name: 'Heading', alias: '' },
		],
	};

	it("lists the form's fields with their aliases, those picked before as picked, and gives the picks when submitted", async () => {
		const { shadow, modalContext } = await openDialog(data, { selection: [EMAIL_ID] });

		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe('Recipient fields');
		// Each field is named with its alias too, as two fields can have one name.
		expect(menuItems(shadow)).toStrictEqual([
			['Name (name)', 'name', false],
			['Email (email)', 'email', true],
			['Heading', null, false],
		]);
		expect([...shadow.querySelectorAll('uui-menu-item')].map((item) => item.querySelector('umb-icon')?.getAttribute('name') ?? null)).toStrictEqual([
			'icon-autofill',
			'icon-autofill',
			null,
		]);

		// The user picks Heading, then Name, and lets go of Email.
		const [name, email, heading] = shadow.querySelectorAll('uui-menu-item');
		heading!.dispatchEvent(new Event('selected'));
		name!.dispatchEvent(new Event('selected'));
		email!.dispatchEvent(new Event('deselected'));
		await settle(shadow.host as FormulatePickFieldsModalElement);
		expect(menuItems(shadow).map(([, , picked]) => picked)).toStrictEqual([true, false, true]);

		click(shadow.querySelector('#submit')!);
		expect(await outcomeOf(modalContext)).toStrictEqual({ submitted: { selection: [HEADING_ID, NAME_ID] } });
	});

	it('closes without a pick', async () => {
		const { shadow, modalContext } = await openDialog(data, { selection: [EMAIL_ID] });

		shadow.querySelector('uui-menu-item')!.dispatchEvent(new Event('selected'));
		click(shadow.querySelector('#close')!);

		expect(await outcomeOf(modalContext)).toBe('closed');
	});

	it("is registered by the alias its token opens, in Formulate's bundle", async () => {
		const manifest = bundle.find((candidate) => candidate.alias === FORMULATE_PICK_FIELDS_MODAL_ALIAS) as
			| { type: string; element: () => Promise<{ element?: CustomElementConstructor }> }
			| undefined;

		expect([FORMULATE_PICK_FIELDS_MODAL.toString(), manifest?.type, (await manifest?.element())?.element]).toStrictEqual([
			'Formulate.Modal.PickFields',
			'modal',
			FormulatePickFieldsModalElement,
		]);
	});

	it('says when the form has no fields to pick', async () => {
		const { shadow } = await openDialog({ headline: 'Fields to include', fields: [] }, { selection: [] });

		expect([shadow.querySelectorAll('uui-menu-item').length, shadow.querySelector('#no-fields')?.textContent]).toStrictEqual([
			0,
			'formulate_noFieldsToPick',
		]);
	});
});

/** The picker without the back office's modals: the dialog it would open, and the pick the user makes there. */
class TestFormFieldPicker extends FormulateFormFieldPickerElement {
	picks?: Array<string>;
	opened: Array<{ data: FormulatePickFieldsModalData; selection: Array<string> }> = [];

	protected override async pickIds(data: FormulatePickFieldsModalData, selection: Array<string>) {
		this.opened.push({ data: structuredClone(data), selection: [...selection] });
		return this.picks;
	}
}
customElements.define('formulate-test-form-field-picker', TestFormFieldPicker);

/** Shows a picker in a back office host that has the definitions and the back office's icons. */
async function render(value: ReadonlyArray<string>, readonly = false) {
	serveForms();
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	provideIcons(host);
	const element = new TestFormFieldPicker();
	element.fields = FIELDS;
	element.value = value;
	element.headline = 'Recipient fields';
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? structuredClone(element.value) : 'not an UmbChangeEvent');
	});
	host.append(element);
	await settle(element);

	return { element, changes, shadow: element.shadowRoot! };
}

/** Each ref the picker shows: its name, detail line, icon, and whether it says it is in error. */
function refs(shadow: ShadowRoot) {
	return [...shadow.querySelectorAll('uui-ref-node')].map((ref) => ({
		name: ref.getAttribute('name'),
		detail: ref.getAttribute('detail'),
		icon: ref.querySelector('umb-icon')?.getAttribute('name') ?? null,
		error: ref.hasAttribute('error'),
	}));
}

describe('Formulate form field picker', () => {
	it("shows each picked field by name, with its alias under it and its kind's icon, and a field that is gone by its ID", async () => {
		const { shadow, changes } = await render([EMAIL_AS_STORED, GONE_ID, HEADING_ID, ODD_ID]);

		expect(refs(shadow)).toStrictEqual([
			{ name: 'Email', detail: 'email', icon: 'icon-document-dashed-line', error: false },
			{ name: 'formulate_fieldNotFound', detail: GONE_ID, icon: 'icon-alert', error: true },
			// The back office has no icon of that name, so the fields' own one shows.
			{ name: 'Heading', detail: 'heading', icon: 'icon-autofill', error: false },
			// A kind that is not installed.
			{ name: 'Odd', detail: '', icon: 'icon-alert', error: false },
		]);
		expect(changes).toStrictEqual([]);
	});

	it('names each Remove button for its field, and removing one keeps the others as they were stored', async () => {
		const { shadow, changes } = await render([EMAIL_AS_STORED, GONE_ID, HEADING_ID]);

		const removes = [...shadow.querySelectorAll('uui-action-bar uui-button')];
		expect(removes.map((button) => button.getAttribute('aria-label'))).toStrictEqual(['Remove Email', 'Remove item 2', 'Remove Heading']);

		click(removes[1]!);
		await settle(shadow.host as TestFormFieldPicker);

		expect(changes).toStrictEqual([[EMAIL_AS_STORED, HEADING_ID]]);
		expect(refs(shadow).map((ref) => ref.name)).toStrictEqual(['Email', 'Heading']);
	});

	it("opens the dialog on the form's fields, keeps those still picked in their order, and adds the new ones after", async () => {
		const { shadow, element, changes } = await render([EMAIL_AS_STORED, GONE_ID, HEADING_ID]);
		element.picks = [HEADING_ID, NAME_ID];

		click(shadow.querySelector('#btn-add')!);
		await settle(element);

		expect(shadow.querySelector('#btn-add')?.getAttribute('label')).toBe('general_choose');
		expect(element.opened).toStrictEqual([
			{
				data: {
					headline: 'Recipient fields',
					fields: [
						{ id: NAME_ID, name: 'Name', alias: 'name', icon: 'icon-document-dashed-line' },
						{ id: EMAIL_ID, name: 'Email', alias: 'email', icon: 'icon-document-dashed-line' },
						{ id: HEADING_ID, name: 'Heading', alias: 'heading', icon: 'icon-autofill' },
						{ id: SEND_ID, name: 'formulate_unnamed', alias: 'send', icon: 'icon-autofill' },
						{ id: ODD_ID, name: 'Odd', alias: '', icon: 'icon-alert' },
					],
				},
				// By the form's own IDs; the field that is gone is not in the dialog.
				selection: [EMAIL_ID, HEADING_ID],
			},
		]);
		// Email is no longer picked; the field that is gone stays until it is removed.
		expect(changes).toStrictEqual([[GONE_ID, HEADING_ID, NAME_ID]]);
	});

	it('changes nothing when the dialog is closed, or gives back the same fields', async () => {
		const { shadow, element, changes } = await render([EMAIL_AS_STORED]);

		click(shadow.querySelector('#btn-add')!);
		await settle(element);
		element.picks = [EMAIL_ID];
		click(shadow.querySelector('#btn-add')!);
		await settle(element);

		expect([element.opened.length, changes]).toStrictEqual([2, []]);
	});

	it('can only be looked at when it is read-only', async () => {
		const { shadow } = await render([EMAIL_ID], true);

		expect([refs(shadow).length, shadow.querySelector('#btn-add'), shadow.querySelector('uui-action-bar')]).toStrictEqual([1, null, null]);
	});
});
