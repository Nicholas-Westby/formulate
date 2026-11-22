import type { UmbInputWithAliasElement } from '@umbraco-cms/backoffice/components';
import '@umbraco-cms/backoffice/components';
import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { UmbModalManagerContext, type UmbModalContext, type UmbModalToken } from '@umbraco-cms/backoffice/modal';
import { afterEach, describe, expect, it } from 'vitest';
import { FormulateDefinitionsContext } from '../../core/definitions.context.js';
import type { FormulateKindEditorSlotElement } from '../../core/kind-editor-slot.element.js';
import {
	BUTTON,
	CONFIG,
	DROP_DOWN,
	FORM_ID,
	HEADER,
	serveForms,
	STORE_DATA,
	TEXT,
	UNKNOWN_KIND,
} from '../../test/forms.js';
import { createTestHost } from '../../test/test-host.js';
import { click, typeInto } from '../../test/ui.js';
import { newFormField, newFormHandler, toFormField } from '../form-items.js';
import type { FormulateFormFieldModel, FormulateFormHandlerModel } from '../types.js';
import { FormulateEditFieldModalElement } from './edit-field/edit-field-modal.element.js';
import { FORMULATE_EDIT_FIELD_MODAL, type FormulateEditFieldModalData } from './edit-field/edit-field-modal.token.js';
import { FormulateEditHandlerModalElement } from './edit-handler/edit-handler-modal.element.js';
import { FORMULATE_EDIT_HANDLER_MODAL, type FormulateEditHandlerModalData } from './edit-handler/edit-handler-modal.token.js';
import { FormulatePickKindModalElement } from './pick-kind/pick-kind-modal.element.js';
import { FORMULATE_PICK_KIND_MODAL, type FormulatePickKindModalData } from './pick-kind/pick-kind-modal.token.js';

const MANDATORY_ID = '5c2e8a41-7d3b-4f19-a6e0-3b9d1f7c2a03';

/**
 * Opens a modal element as the modal manager would, inside a back office host that has the definitions:
 * with a modal context that holds its data and value.
 */
async function openModal<Data extends object, Value>(
	token: UmbModalToken<Data, Value>,
	element: HTMLElement & { modalContext?: unknown; data?: unknown; updateComplete: Promise<unknown> },
	data: Data,
	config = CONFIG,
) {
	serveForms([], undefined, config);
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	const modals = new UmbModalManagerContext(host);
	const modalContext = modals.open(host, token, { data }) as UmbModalContext<Data, Value>;
	element.modalContext = modalContext;
	element.data = modalContext.data;
	host.append(element);
	await settle(element);

	return { element, modalContext, shadow: element.shadowRoot! };
}

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 4; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Whether the modal was submitted (with its value), closed, or is still open shortly after. */
function outcomeOf<Value>(modalContext: UmbModalContext<object, Value>) {
	return Promise.race([
		modalContext.onSubmit().then(
			(value) => ({ submitted: value }),
			() => 'closed',
		),
		new Promise((resolve) => setTimeout(() => resolve('open'), 20)),
	]);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate pick kind dialog', () => {
	const kinds: FormulatePickKindModalData['kinds'] = [
		{ kindId: TEXT, name: 'Text', icon: 'icon-document-dashed-line', category: 'Inputs' },
		{ kindId: HEADER, name: 'Header', icon: 'icon-heading', category: 'Content' },
		{ kindId: DROP_DOWN, name: 'Drop Down', icon: 'icon-list', category: 'Inputs' },
		{ kindId: BUTTON, name: 'Button', icon: 'icon-mouse-cursor', category: 'Actions' },
	];

	/** The groups shown, each with the names of its kinds. */
	function groupsOf(shadow: ShadowRoot) {
		return [...shadow.querySelectorAll('.category')].map((category) => ({
			name: category.querySelector('.category-name')?.textContent?.trim(),
			kinds: [...category.querySelectorAll('uui-button')].map((button) => button.getAttribute('label')),
		}));
	}

	it('groups the kinds by category, in the order the categories first come, each with its icon and name', async () => {
		const { shadow } = await openModal(FORMULATE_PICK_KIND_MODAL, new FormulatePickKindModalElement(), {
			headline: 'Add field',
			kinds,
		});

		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe('Add field');
		expect(groupsOf(shadow)).toStrictEqual([
			{ name: 'Inputs', kinds: ['Text', 'Drop Down'] },
			{ name: 'Content', kinds: ['Header'] },
			{ name: 'Actions', kinds: ['Button'] },
		]);
		const text = shadow.querySelector('uui-button[label="Text"]')!;
		expect([text.querySelector('umb-icon')?.getAttribute('name'), text.textContent?.trim()]).toStrictEqual([
			'icon-document-dashed-line',
			'Text',
		]);
	});

	it('gives back the kind that is picked', async () => {
		const { shadow, modalContext } = await openModal(FORMULATE_PICK_KIND_MODAL, new FormulatePickKindModalElement(), {
			headline: 'Add field',
			kinds,
		});

		click(shadow.querySelector('uui-button[label="Drop Down"]')!);

		expect(await outcomeOf(modalContext)).toStrictEqual({ submitted: { kindId: DROP_DOWN } });
	});

	it('shows only the kinds whose names have the text typed in the filter', async () => {
		const { shadow, element } = await openModal(FORMULATE_PICK_KIND_MODAL, new FormulatePickKindModalElement(), {
			headline: 'Add field',
			kinds,
		});

		typeInto(shadow.querySelector('#filter')!, 'DOWN');
		await settle(element);
		expect(groupsOf(shadow)).toStrictEqual([{ name: 'Inputs', kinds: ['Drop Down'] }]);

		typeInto(shadow.querySelector('#filter')!, 'signature');
		await settle(element);
		expect([groupsOf(shadow), shadow.querySelector('#nothing-found')?.textContent?.trim()]).toStrictEqual([
			[],
			'formulate_noKindsFound',
		]);
	});

	it('gives back nothing when closed', async () => {
		const { shadow, modalContext } = await openModal(FORMULATE_PICK_KIND_MODAL, new FormulatePickKindModalElement(), {
			headline: 'Add field',
			kinds,
		});

		click(shadow.querySelector('uui-button#close')!);

		expect(await outcomeOf(modalContext)).toBe('closed');
	});
});

describe('Formulate field dialog', () => {
	const formFields: Array<FormulateFormFieldModel> = [
		toFormField({ id: '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02', kindId: TEXT, name: 'Email', alias: 'email', validations: [] }),
	];

	function textField(): FormulateFormFieldModel {
		return {
			id: '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01',
			kindId: TEXT,
			name: 'Name',
			alias: 'name',
			label: 'Your name',
			category: 'Contact',
			validations: [MANDATORY_ID],
		};
	}

	function openField(data: FormulateEditFieldModalData, config = CONFIG) {
		return openModal(FORMULATE_EDIT_FIELD_MODAL, new FormulateEditFieldModalElement(), data, config);
	}

	function partsOf(shadow: ShadowRoot) {
		const name = shadow.querySelector('umb-input-with-alias#name') as UmbInputWithAliasElement | null;
		const select = shadow.querySelector('uui-select#category') as (HTMLElement & { options: Array<Record<string, unknown>> }) | null;

		return {
			name: name ? [name.value, name.alias] : null,
			label: (shadow.querySelector('uui-input#label') as HTMLInputElement | null)?.value ?? null,
			category: select?.options.map(({ name, value, group, selected }) => ({ name, value, group, selected: !!selected })) ?? null,
			validations: (shadow.querySelector('formulate-validation-picker') as { value?: unknown } | null)?.value ?? null,
		};
	}

	function slotOf(shadow: ShadowRoot) {
		return shadow.querySelector('formulate-kind-editor-slot') as FormulateKindEditorSlotElement;
	}

	it('shows the name and alias, label, category and validations of a kind that has them', async () => {
		const { shadow } = await openField({ field: textField(), formFields, formId: FORM_ID });

		expect(partsOf(shadow)).toStrictEqual({
			name: ['Name', 'name'],
			label: 'Your name',
			category: [
				{ name: 'formulate_noCategory', value: '', group: undefined, selected: false },
				{ name: 'Name', value: 'Name', group: 'Personal', selected: false },
				{ name: 'Contact', value: 'Contact', group: 'Personal', selected: true },
				{ name: 'Consent', value: 'Consent', group: 'Marketing', selected: false },
			],
			validations: [MANDATORY_ID],
		});
		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe('formulate_editField');
	});

	it("shows only the name and alias of a kind without a label, category or validations, and its kind's settings", async () => {
		const header = { ...newFormField({ kindId: HEADER, defaultConfiguration: { text: null } }), name: 'Intro' };
		const { shadow } = await openField({ field: header, formFields, formId: FORM_ID, isNew: true });
		const slot = slotOf(shadow);

		expect(partsOf(shadow)).toStrictEqual({ name: ['Intro', ''], label: null, category: null, validations: null });
		expect([slot.type, slot.editorAlias, slot.value]).toStrictEqual(['formulateFieldEditor', 'formulate-header-field', { text: null }]);
		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe('formulate_addField');
	});

	it('has no category when Formulate has no field categories set up, unless the field already has one', async () => {
		const noCategories = { ...CONFIG, fieldCategories: [] };
		const without = await openField({ field: { ...textField(), category: null }, formFields }, noCategories);
		expect(partsOf(without.shadow).category).toBeNull();
		document.body.replaceChildren();

		// A category that is no longer set up stays, so it is not lost by opening the field.
		const kept = await openField({ field: textField(), formFields }, noCategories);
		expect(partsOf(kept.shadow).category).toStrictEqual([
			{ name: 'formulate_noCategory', value: '', group: undefined, selected: false },
			{ name: 'Contact', value: 'Contact', group: undefined, selected: true },
		]);
	});

	it("gives its kind's editor the configuration, frozen, and the form's fields and ID", async () => {
		const dropDown = { ...newFormField({ kindId: DROP_DOWN, defaultConfiguration: { dataValue: 'x' } }), name: 'State' };
		const { shadow } = await openField({ field: dropDown, formFields, formId: FORM_ID });
		const slot = slotOf(shadow);

		expect([slot.editorAlias, slot.value, Object.isFrozen(slot.value)]).toStrictEqual(['formulate-drop-down-field', { dataValue: 'x' }, true]);
		expect(slot.context).toStrictEqual({ formFields, formId: FORM_ID });
	});

	it('gives back the field as it was edited, and leaves the field it was given as it was', async () => {
		const field = textField();
		const given = structuredClone(field);
		const { shadow, element, modalContext } = await openField({ field, formFields, formId: FORM_ID });

		const name = shadow.querySelector('umb-input-with-alias#name') as UmbInputWithAliasElement;
		name.value = 'Full name';
		name.alias = 'fullName';
		name.dispatchEvent(new UmbChangeEvent());
		typeInto(shadow.querySelector('uui-input#label')!, '');
		const category = shadow.querySelector('uui-select#category') as HTMLInputElement;
		category.value = 'Name';
		category.dispatchEvent(new Event('change'));
		const validations = shadow.querySelector('formulate-validation-picker')!;
		validations.value = [];
		validations.dispatchEvent(new UmbChangeEvent());
		const slot = slotOf(shadow);
		slot.value = { anything: true };
		slot.dispatchEvent(new UmbChangeEvent());
		await settle(element);
		click(shadow.querySelector('uui-button#submit')!);

		expect(await outcomeOf(modalContext)).toStrictEqual({
			submitted: {
				field: {
					id: field.id,
					kindId: TEXT,
					name: 'Full name',
					alias: 'fullName',
					label: null,
					category: 'Name',
					validations: [],
					configuration: { anything: true },
				},
			},
		});
		expect(field).toStrictEqual(given);
	});

	it('gives back the field it was given when nothing is changed', async () => {
		const field = textField();
		const { shadow, modalContext } = await openField({ field, formFields });

		click(shadow.querySelector('uui-button#submit')!);

		expect(await outcomeOf(modalContext)).toStrictEqual({ submitted: { field } });
	});

	it('gives back nothing when closed', async () => {
		const { shadow, element, modalContext } = await openField({ field: textField(), formFields });
		typeInto(shadow.querySelector('uui-input#label')!, 'Changed');
		await settle(element);

		click(shadow.querySelector('uui-button#close')!);

		expect(await outcomeOf(modalContext)).toBe('closed');
	});

	it('makes the alias from the name of a new field, as Umbraco does for a new property', async () => {
		const added = await openField({ field: newFormField({ kindId: TEXT }), formFields, isNew: true });
		expect((added.shadow.querySelector('umb-input-with-alias#name') as UmbInputWithAliasElement).autoGenerateAlias).toBe(true);
		document.body.replaceChildren();

		const edited = await openField({ field: textField(), formFields });
		expect(Boolean((edited.shadow.querySelector('umb-input-with-alias#name') as UmbInputWithAliasElement).autoGenerateAlias)).toBe(false);
	});

	it('says that the kind of a field is not installed, and keeps its settings as they are', async () => {
		const unknown = { ...textField(), kindId: UNKNOWN_KIND, configuration: { pen: 2 } };
		const { shadow, modalContext } = await openField({ field: unknown, formFields });

		expect(shadow.querySelector('#unknown-kind')?.textContent?.trim()).toBe('formulate_unknownFieldKind');
		expect(shadow.querySelector('formulate-kind-editor-slot')).toBeNull();
		expect(partsOf(shadow).name).toStrictEqual(['Name', 'name']);

		click(shadow.querySelector('uui-button#submit')!);
		expect(await outcomeOf(modalContext)).toStrictEqual({ submitted: { field: unknown } });
	});
});

describe('Formulate handler dialog', () => {
	function storeHandler(): FormulateFormHandlerModel {
		return { id: '1a6b4d2f-9c3e-4f70-8b8d-2e4f6a8c0d02', kindId: STORE_DATA, name: 'Store', alias: 'store', enabled: true };
	}

	function openHandler(data: FormulateEditHandlerModalData) {
		return openModal(FORMULATE_EDIT_HANDLER_MODAL, new FormulateEditHandlerModalElement(), data);
	}

	it("shows the handler's name and alias, whether it is enabled, and its kind's settings with the form's fields", async () => {
		const formFields = [toFormField({ id: 'f1', kindId: TEXT, name: 'Email', validations: [] })];
		const { shadow } = await openHandler({ handler: storeHandler(), formFields, formId: FORM_ID });
		const name = shadow.querySelector('umb-input-with-alias#name') as UmbInputWithAliasElement;
		const slot = shadow.querySelector('formulate-kind-editor-slot') as FormulateKindEditorSlotElement;

		expect([name.value, name.alias, (shadow.querySelector('uui-toggle#enabled') as HTMLInputElement).checked]).toStrictEqual([
			'Store',
			'store',
			true,
		]);
		expect([slot.type, slot.editorAlias, slot.value, slot.context]).toStrictEqual([
			'formulateHandlerEditor',
			'formulate-store-data-handler',
			undefined,
			{ formFields, formId: FORM_ID },
		]);
		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe('formulate_editHandler');
	});

	it('gives back the handler as it was edited', async () => {
		const handler = storeHandler();
		const { shadow, element, modalContext } = await openHandler({ handler, formFields: [] });

		const name = shadow.querySelector('umb-input-with-alias#name') as UmbInputWithAliasElement;
		name.value = 'Keep';
		name.alias = '';
		name.dispatchEvent(new UmbChangeEvent());
		const enabled = shadow.querySelector('uui-toggle#enabled') as HTMLInputElement;
		enabled.checked = false;
		enabled.dispatchEvent(new Event('change'));
		await settle(element);
		click(shadow.querySelector('uui-button#submit')!);

		expect(await outcomeOf(modalContext)).toStrictEqual({
			submitted: { handler: { ...handler, name: 'Keep', alias: null, enabled: false } },
		});
	});

	it('gives back nothing when closed', async () => {
		const { shadow, modalContext } = await openHandler({ handler: newFormHandler({ kindId: STORE_DATA }), formFields: [], isNew: true });

		expect(shadow.querySelector('umb-body-layout')?.getAttribute('headline')).toBe('formulate_addHandler');
		click(shadow.querySelector('uui-button#close')!);

		expect(await outcomeOf(modalContext)).toBe('closed');
	});
});
