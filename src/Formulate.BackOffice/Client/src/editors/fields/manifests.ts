import { FORMULATE_FIELD_EDITOR_TYPE } from '../../core/kind-editor.js';

/** A field editor of one of Formulate's own field kinds, found by its server definition's EditorAlias. */
function fieldEditor(alias: string, name: string, editorAlias: string, element: () => Promise<unknown>): UmbExtensionManifest {
	return {
		type: FORMULATE_FIELD_EDITOR_TYPE,
		alias: `Formulate.FieldEditor.${alias}`,
		name: `Formulate ${name} Field Editor`,
		element,
		meta: { editorAlias },
	} as UmbExtensionManifest;
}

const dataValueList = () => import('./data-value-list/data-value-list-field-editor.element.js');

export const manifests: Array<UmbExtensionManifest> = [
	fieldEditor('Button', 'Button', 'formulate-button-field', () => import('./button/button-field-editor.element.js')),
	// Both keep their choices in a data values item, so they share an editor.
	fieldEditor('CheckboxList', 'Checkbox List', 'formulate-checkbox-list-field', dataValueList),
	fieldEditor('DropDown', 'Drop Down', 'formulate-drop-down-field', dataValueList),
	fieldEditor(
		'RadioButtonList',
		'Radio Button List',
		'formulate-radio-button-list-field',
		() => import('./radio-button-list/radio-button-list-field-editor.element.js'),
	),
	fieldEditor('Header', 'Header', 'formulate-header-field', () => import('./header/header-field-editor.element.js')),
	fieldEditor('Hidden', 'Hidden', 'formulate-hidden-field', () => import('./hidden/hidden-field-editor.element.js')),
	fieldEditor('RichText', 'Rich Text', 'formulate-rich-text-field', () => import('./rich-text/rich-text-field-editor.element.js')),
	fieldEditor(
		'TextConstant',
		'Text Constant',
		'formulate-text-constant-field',
		() => import('./text-constant/text-constant-field-editor.element.js'),
	),
];
