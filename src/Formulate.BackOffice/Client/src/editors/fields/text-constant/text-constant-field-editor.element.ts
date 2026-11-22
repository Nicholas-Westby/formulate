import { customElement } from '@umbraco-cms/backoffice/external/lit';
import { FormulateTextSettingEditorElement } from '../text-setting-editor.js';

/** The editor of the Text Constant field, { text }: the value the server adds to each submission. Visitors do not see it, and their browsers do not send it. */
@customElement('formulate-text-constant-field-editor')
export class FormulateTextConstantFieldEditorElement extends FormulateTextSettingEditorElement {
	constructor() {
		super({ multiline: true, descriptionKey: 'formulate_textConstantDescription' });
	}
}

export { FormulateTextConstantFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-text-constant-field-editor': FormulateTextConstantFieldEditorElement;
	}
}
