import { customElement } from '@umbraco-cms/backoffice/external/lit';
import { FormulateTextSettingEditorElement } from '../text-setting-editor.js';

/** The editor of the Header field, { text }: the heading the form shows. */
@customElement('formulate-header-field-editor')
export class FormulateHeaderFieldEditorElement extends FormulateTextSettingEditorElement {
	constructor() {
		super({ multiline: false, descriptionKey: 'formulate_headerTextDescription' });
	}
}

export { FormulateHeaderFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-header-field-editor': FormulateHeaderFieldEditorElement;
	}
}
