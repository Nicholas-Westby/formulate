import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { afterEach, describe, expect, it } from 'vitest';
import { FormulateDefinitionsContext } from '../../core/definitions.context.js';
import { FORMULATE_FIELD_EDITOR_TYPE, type FormulateKindEditorElementBase } from '../../core/kind-editor.js';
import { FormulateKindEditorSlotElement } from '../../core/kind-editor-slot.element.js';
import { serveForms } from '../../test/forms.js';
import { SERVER_CONSTANTS } from '../../test/server-constants.js';
import { createTestHost } from '../../test/test-host.js';
import { typeInto } from '../../test/ui.js';
import { manifests as editorManifests } from '../manifests.js';
import { FormulateButtonFieldEditorElement } from './button/button-field-editor.element.js';
import { FormulateDataValueListFieldEditorElement } from './data-value-list/data-value-list-field-editor.element.js';
import { FormulateExtendedRadioButtonListFieldEditorElement } from './extended-radio-button-list/extended-radio-button-list-field-editor.element.js';
import { FormulateHeaderFieldEditorElement } from './header/header-field-editor.element.js';
import { FormulateHiddenFieldEditorElement } from './hidden/hidden-field-editor.element.js';
import { manifests as fieldEditorManifests } from './manifests.js';
import { FormulateRadioButtonListFieldEditorElement } from './radio-button-list/radio-button-list-field-editor.element.js';
import { FormulateTextConstantFieldEditorElement } from './text-constant/text-constant-field-editor.element.js';

const COLORS_ID = '9a6c2e85-1b7f-4d5d-8ac4-7f3b5d1a6e07';
const SIZES_ID = 'b18e4a07-3d9f-4c5b-8e2a-9f1c3e5a7b09';
const NO_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Shows an editor in a back office host that has the definitions and Formulate's configuration, and records
 * the values it stores.
 */
async function render<T extends FormulateKindEditorElementBase>(element: T, value: unknown, readonly = false) {
	serveForms();
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	element.value = value;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? JSON.parse(JSON.stringify(element.value)) : 'not an UmbChangeEvent');
	});
	host.append(element);
	await settle(element);

	return { element, changes, shadow: element.shadowRoot! };
}

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 3; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Picks an option of a uui-select as a user does. */
function choose(select: Element, value: string) {
	(select as HTMLInputElement).value = value;
	select.dispatchEvent(new Event('change'));
}

/** Picks data values in a data values picker, or removes the pick, as a user does. */
function pickDataValues(picker: Element, id: string | undefined) {
	(picker as HTMLInputElement).value = id as string;
	picker.dispatchEvent(new UmbChangeEvent());
}

/** The options of a uui-select: [name, value, selected]. */
function optionsOf(select: Element | null) {
	return ((select as (Element & { options: Array<{ name: string; value: string; selected?: boolean }> }) | null)?.options ?? []).map(
		(option) => [option.name, option.value, !!option.selected],
	);
}

afterEach(() => {
	document.body.replaceChildren();
});

// The server reads ButtonFieldConfiguration: { buttonKind } (a string), from Formulate:Buttons.
describe('Formulate Button field editor', () => {
	it("offers the button kinds of Formulate's configuration, with the field's picked", async () => {
		const { shadow, changes } = await render(new FormulateButtonFieldEditorElement(), { buttonKind: 'Submit' });

		expect(optionsOf(shadow.querySelector('uui-select#button-kind'))).toStrictEqual([
			['formulate_noButtonKind', '', false],
			['Next', 'Next', false],
			['Previous', 'Previous', false],
			['Submit', 'Submit', true],
		]);
		// Showing the editor stores nothing.
		expect(changes).toStrictEqual([]);
	});

	it('stores the picked kind, and none for no kind, keeping the settings it does not edit', async () => {
		const { shadow, changes } = await render(new FormulateButtonFieldEditorElement(), { buttonKind: null, color: 'blue' });
		const select = shadow.querySelector('uui-select#button-kind')!;

		choose(select, 'Next');
		choose(select, '');

		expect(changes).toStrictEqual([
			{ buttonKind: 'Next', color: 'blue' },
			{ buttonKind: null, color: 'blue' },
		]);
	});

	it('keeps a kind that is no longer in the configuration, so opening the field does not lose it', async () => {
		const { shadow } = await render(new FormulateButtonFieldEditorElement(), { buttonKind: 'Reset' });

		expect(optionsOf(shadow.querySelector('uui-select#button-kind'))).toContainEqual(['Reset', 'Reset', true]);
	});
});

// The server reads DropDownFieldPreValues and CheckboxListFieldPreValues: { dataValue } (a Guid). A
// missing dataValue reads as none; an explicit null is refused.
describe('Formulate data value list field editor (drop down, checkbox list)', () => {
	it('shows the picked data values', async () => {
		const { shadow, changes } = await render(new FormulateDataValueListFieldEditorElement(), { dataValue: COLORS_ID });

		expect((shadow.querySelector('formulate-data-values-picker#data-value') as HTMLInputElement).value).toBe(COLORS_ID);
		expect(changes).toStrictEqual([]);
	});

	it('stores the picked data values, and leaves the setting out when the pick is removed', async () => {
		const { shadow, changes } = await render(new FormulateDataValueListFieldEditorElement(), { dataValue: NO_ID, extra: 1 });
		const picker = shadow.querySelector('formulate-data-values-picker#data-value')!;

		pickDataValues(picker, SIZES_ID);
		pickDataValues(picker, undefined);

		expect(changes).toStrictEqual([{ dataValue: SIZES_ID, extra: 1 }, { extra: 1 }]);
	});

	it('shows nothing picked for the empty ID the API gives for none', async () => {
		const { shadow } = await render(new FormulateDataValueListFieldEditorElement(), { dataValue: NO_ID });

		expect((shadow.querySelector('formulate-data-values-picker#data-value') as HTMLInputElement).value).toBe(NO_ID);
		expect(shadow.querySelector('formulate-data-values-picker')!.shadowRoot!.querySelector('#btn-add')).not.toBeNull();
	});
});

// The server reads RadioButtonListFieldPreValues: { dataValue } (a Guid) and { orientation } (a string).
describe('Formulate Radio Button List field editor', () => {
	it('shows the picked data values and the orientation', async () => {
		const { shadow, changes } = await render(new FormulateRadioButtonListFieldEditorElement(), {
			dataValue: COLORS_ID,
			orientation: 'Vertical',
		});

		expect((shadow.querySelector('formulate-data-values-picker#data-value') as HTMLInputElement).value).toBe(COLORS_ID);
		expect(optionsOf(shadow.querySelector('uui-select#orientation'))).toStrictEqual([
			['formulate_defaultOrientation', '', false],
			['formulate_horizontal', 'Horizontal', false],
			['formulate_vertical', 'Vertical', true],
		]);
		expect(changes).toStrictEqual([]);
	});

	it('stores the picked data values and orientation, as Formulate 4 stored them', async () => {
		const { shadow, changes } = await render(new FormulateRadioButtonListFieldEditorElement(), { dataValue: NO_ID, orientation: null });

		pickDataValues(shadow.querySelector('formulate-data-values-picker#data-value')!, COLORS_ID);
		choose(shadow.querySelector('uui-select#orientation')!, 'Horizontal');
		choose(shadow.querySelector('uui-select#orientation')!, '');
		pickDataValues(shadow.querySelector('formulate-data-values-picker#data-value')!, undefined);

		expect(changes).toStrictEqual([
			{ dataValue: COLORS_ID, orientation: null },
			{ dataValue: COLORS_ID, orientation: 'Horizontal' },
			{ dataValue: COLORS_ID, orientation: null },
			{ orientation: null },
		]);
	});
});

// The server reads ExtendedRadioButtonListFieldPreValues: { dataValue } (a Guid) and { orientation } (a string). Each
// item's primary text is the choice, and its secondary text its description (ExtendedRadioButtonListFieldDefinition).
describe('Formulate Extended Radio Button List field editor', () => {
	it("is the editor of the server's Extended Radio Button List, by the editor alias its definition gives", () => {
		const manifest = fieldEditorManifests.find(({ alias }) => alias === 'Formulate.FieldEditor.ExtendedRadioButtonList') as
			| { meta: { editorAlias: string } }
			| undefined;

		expect(manifest?.meta.editorAlias).toBe(SERVER_CONSTANTS.extendedRadioButtonListField.EditorAlias);
	});

	it("shows the picked data values, says that each item's secondary text becomes its description, and shows the orientation", async () => {
		const { shadow, changes } = await render(new FormulateExtendedRadioButtonListFieldEditorElement(), {
			dataValue: COLORS_ID,
			orientation: 'Horizontal',
		});
		const [dataValues, orientation] = shadow.querySelectorAll('umb-property-layout');

		expect((shadow.querySelector('formulate-data-values-picker#data-value') as HTMLInputElement).value).toBe(COLORS_ID);
		expect([dataValues?.getAttribute('label'), dataValues?.getAttribute('description')]).toStrictEqual([
			'formulate_dataValues',
			'formulate_extendedRadioButtonListDataValuesDescription',
		]);
		// The Radio Button List's orientation setting.
		expect([orientation?.getAttribute('label'), orientation?.getAttribute('description')]).toStrictEqual([
			'formulate_orientation',
			'formulate_orientationDescription',
		]);
		expect(optionsOf(shadow.querySelector('uui-select#orientation'))).toStrictEqual([
			['formulate_defaultOrientation', '', false],
			['formulate_horizontal', 'Horizontal', true],
			['formulate_vertical', 'Vertical', false],
		]);
		expect(changes).toStrictEqual([]);
	});

	it('shows nothing picked and no orientation for the configuration the API gives a new field', async () => {
		// GetBackOfficeConfiguration gives the empty GUID and a null orientation for a field that has neither.
		const { shadow, changes } = await render(new FormulateExtendedRadioButtonListFieldEditorElement(), {
			dataValue: NO_ID,
			orientation: null,
		});

		expect(shadow.querySelector('formulate-data-values-picker')!.shadowRoot!.querySelector('#btn-add')).not.toBeNull();
		expect(optionsOf(shadow.querySelector('uui-select#orientation'))[0]).toStrictEqual(['formulate_defaultOrientation', '', true]);
		expect(changes).toStrictEqual([]);
	});

	it('stores the picked data values and orientation, keeping the settings it does not edit', async () => {
		const { element, shadow, changes } = await render(new FormulateExtendedRadioButtonListFieldEditorElement(), {
			dataValue: NO_ID,
			orientation: null,
			extra: 1,
		});

		choose(shadow.querySelector('uui-select#orientation')!, 'Vertical');
		await settle(element);
		pickDataValues(shadow.querySelector('formulate-data-values-picker#data-value')!, SIZES_ID);
		await settle(element);
		choose(shadow.querySelector('uui-select#orientation')!, '');
		await settle(element);
		pickDataValues(shadow.querySelector('formulate-data-values-picker#data-value')!, undefined);

		expect(changes).toStrictEqual([
			{ dataValue: NO_ID, orientation: 'Vertical', extra: 1 },
			{ dataValue: SIZES_ID, orientation: 'Vertical', extra: 1 },
			{ dataValue: SIZES_ID, orientation: null, extra: 1 },
			{ orientation: null, extra: 1 },
		]);
	});

	it('changes nothing while read-only', async () => {
		const { shadow, changes } = await render(
			new FormulateExtendedRadioButtonListFieldEditorElement(),
			{ dataValue: COLORS_ID, orientation: 'Vertical' },
			true,
		);
		const select = shadow.querySelector('uui-select#orientation') as HTMLElement & { disabled: boolean; readonly: boolean };
		const picker = shadow.querySelector('formulate-data-values-picker#data-value') as HTMLElement & { readonly: boolean };

		expect([select.disabled, select.readonly, picker.readonly]).toStrictEqual([true, true, true]);
		expect(changes).toStrictEqual([]);
	});
});

// The server reads HeaderFieldConfiguration, HiddenFieldConfiguration and TextConstantFieldConfiguration:
// { text } (a string).
describe('Formulate Header, Hidden and Text Constant field editors', () => {
	const editors = [
		{ name: 'Header', create: () => new FormulateHeaderFieldEditorElement(), input: 'uui-input#text', description: 'formulate_headerTextDescription' },
		{ name: 'Hidden', create: () => new FormulateHiddenFieldEditorElement(), input: 'uui-textarea#text', description: 'formulate_hiddenTextDescription' },
		{
			name: 'Text Constant',
			create: () => new FormulateTextConstantFieldEditorElement(),
			input: 'uui-textarea#text',
			description: 'formulate_textConstantDescription',
		},
	];

	for (const editor of editors) {
		it(`${editor.name}: shows the text, stores what is typed and keeps the settings it does not edit`, async () => {
			const { shadow, changes } = await render(editor.create(), { text: 'Contact us', size: 2 });
			const input = shadow.querySelector(editor.input) as HTMLInputElement;

			expect([input.value, shadow.querySelector('umb-property-layout')?.getAttribute('description')]).toStrictEqual([
				'Contact us',
				editor.description,
			]);
			expect(changes).toStrictEqual([]);

			typeInto(input, 'Get in touch');
			expect(changes).toStrictEqual([{ text: 'Get in touch', size: 2 }]);
		});

		it(`${editor.name}: starts from no text, and changes nothing while read-only`, async () => {
			const { shadow, changes } = await render(editor.create(), { text: null }, true);
			const input = shadow.querySelector(editor.input) as HTMLInputElement & { readonly: boolean };

			expect([input.value, input.readonly]).toStrictEqual(['', true]);
			expect(changes).toStrictEqual([]);
		});
	}
});

// CheckboxFieldDefinition and DateFieldDefinition store no configuration, so Formulate has no editor for them: the
// field's dialog shows its kind's editor slot, which says that the kind has no settings.
describe('Formulate Checkbox and Date fields', () => {
	const registered: Array<string> = [];

	afterEach(() => {
		umbExtensionsRegistry.unregisterMany(registered.splice(0));
	});

	const kinds = [
		{ name: 'Checkbox', editorAlias: SERVER_CONSTANTS.checkboxField.EditorAlias },
		{ name: 'Date', editorAlias: SERVER_CONSTANTS.dateField.EditorAlias },
	];

	for (const kind of kinds) {
		it(`${kind.name}: has no editor among Formulate's, so its dialog says that the kind has no settings`, async () => {
			// Every editor of Formulate's own kinds, as the back office registers them.
			const editors = editorManifests.filter(({ alias }) => !umbExtensionsRegistry.isRegistered(alias));
			umbExtensionsRegistry.registerMany(editors);
			registered.push(...editors.map(({ alias }) => alias));
			const slot = new FormulateKindEditorSlotElement();
			Object.assign(slot, { type: FORMULATE_FIELD_EDITOR_TYPE, editorAlias: kind.editorAlias, value: null });
			createTestHost().append(slot);

			expect(kind.editorAlias).toMatch(/^formulate-[a-z-]+-field$/);
			// Without the back office's translations loaded, a term shows as its key.
			await expect.poll(() => slot.shadowRoot?.querySelector('#no-settings')?.textContent?.trim()).toBe('formulate_noSettings');
			expect(slot.shadowRoot!.querySelector('#not-available')).toBeNull();
			expect(slot.value).toBeNull();
		});
	}
});
