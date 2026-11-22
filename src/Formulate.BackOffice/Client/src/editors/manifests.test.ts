import { describe, expect, it } from 'vitest';
import { manifests } from './manifests.js';

interface EditorManifest {
	type: string;
	alias: string;
	meta: { editorAlias: string };
	element: () => Promise<{ element?: CustomElementConstructor; default?: CustomElementConstructor }>;
}

describe('Formulate built-in kind editors', () => {
	it("are found by the editor alias each server definition gives (its EditorAlias constant)", () => {
		expect((manifests as Array<EditorManifest>).map(({ type, alias, meta }) => [type, meta.editorAlias, alias])).toStrictEqual([
			['formulateValidationEditor', 'formulate-mandatory-validation', 'Formulate.ValidationEditor.Mandatory'],
			['formulateValidationEditor', 'formulate-regex-validation', 'Formulate.ValidationEditor.Regex'],
			['formulateDataValuesEditor', 'formulate-list-data-values', 'Formulate.DataValuesEditor.List'],
			['formulateDataValuesEditor', 'formulate-data-value-pair-list', 'Formulate.DataValuesEditor.PairList'],
			['formulateDataValuesEditor', 'formulate-dynamic-data-values', 'Formulate.DataValuesEditor.Dynamic'],
			['formulateDataValuesEditor', 'formulate-legacy-data-value', 'Formulate.DataValuesEditor.Legacy'],
			['formulateFieldEditor', 'formulate-button-field', 'Formulate.FieldEditor.Button'],
			['formulateFieldEditor', 'formulate-checkbox-list-field', 'Formulate.FieldEditor.CheckboxList'],
			['formulateFieldEditor', 'formulate-drop-down-field', 'Formulate.FieldEditor.DropDown'],
			['formulateFieldEditor', 'formulate-radio-button-list-field', 'Formulate.FieldEditor.RadioButtonList'],
			['formulateFieldEditor', 'formulate-header-field', 'Formulate.FieldEditor.Header'],
			['formulateFieldEditor', 'formulate-hidden-field', 'Formulate.FieldEditor.Hidden'],
			['formulateFieldEditor', 'formulate-rich-text-field', 'Formulate.FieldEditor.RichText'],
			['formulateFieldEditor', 'formulate-text-constant-field', 'Formulate.FieldEditor.TextConstant'],
			['formulateHandlerEditor', 'formulate-store-data-handler', 'Formulate.HandlerEditor.StoreData'],
			['formulateHandlerEditor', 'formulate-send-email-handler', 'Formulate.HandlerEditor.SendEmail'],
			['formulateHandlerEditor', 'formulate-designed-email-handler', 'Formulate.HandlerEditor.DesignedEmail'],
		]);
	});

	it('each load an element that takes a value, a context and a read-only state', async () => {
		for (const manifest of manifests as Array<EditorManifest>) {
			const module = await manifest.element();
			const Element = module.element ?? module.default;
			const editor = new Element!() as HTMLElement & Record<string, unknown>;

			expect(['value', 'context', 'readonly'].every((property) => property in editor), manifest.alias).toBe(true);
		}
	});
});
