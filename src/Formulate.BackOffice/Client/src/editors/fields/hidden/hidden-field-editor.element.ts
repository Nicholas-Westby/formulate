import { customElement } from '@umbraco-cms/backoffice/external/lit';
import { FormulateTextSettingEditorElement } from '../text-setting-editor.js';

/** The editor of the Hidden field, { text }: the value the form sends with each submission, without showing it. */
@customElement('formulate-hidden-field-editor')
export class FormulateHiddenFieldEditorElement extends FormulateTextSettingEditorElement {
	constructor() {
		super({ multiline: true, descriptionKey: 'formulate_hiddenTextDescription' });
	}
}

export { FormulateHiddenFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-hidden-field-editor': FormulateHiddenFieldEditorElement;
	}
}
