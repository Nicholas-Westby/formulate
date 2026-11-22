import { customElement } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';
import { renderDataValuesSetting } from './data-values-setting.js';

/**
 * The editor of the fields whose choices are a data values item, such as Drop Down and Checkbox List:
 * { dataValue }, the data values item that holds the choices.
 */
@customElement('formulate-data-value-list-field-editor')
export class FormulateDataValueListFieldEditorElement extends FormulateKindEditorElementBase {
	override render() {
		return renderDataValuesSetting(this, this.value, this.readonly, (settings) => this.updateValue(settings));
	}

	static override styles = [UmbTextStyles, FORMULATE_SETTINGS_STYLES];
}

export { FormulateDataValueListFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-data-value-list-field-editor': FormulateDataValueListFieldEditorElement;
	}
}
