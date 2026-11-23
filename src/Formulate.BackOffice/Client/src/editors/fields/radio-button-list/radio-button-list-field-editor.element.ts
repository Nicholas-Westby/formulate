import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';
import { renderDataValuesSetting, withDataValue } from '../data-value-list/data-values-setting.js';
import { ORIENTATION_SETTING_STYLES, renderOrientationSetting, withOrientation } from './orientation-setting.js';

/**
 * The editor of the Radio Button List field, { dataValue, orientation }: the data values item that holds the
 * choices, and whether the buttons are laid out across or down (none: as the form's template lays them out).
 */
@customElement('formulate-radio-button-list-field-editor')
export class FormulateRadioButtonListFieldEditorElement extends FormulateKindEditorElementBase {
	override render() {
		return html`
			${renderDataValuesSetting(this, this.value, this.readonly, (id) =>
				this.updateValue(withDataValue(readSettings(this.value), id)),
			)}
			${renderOrientationSetting(this, this.value, this.readonly, (orientation) =>
				this.updateValue(withOrientation(readSettings(this.value), orientation)),
			)}
		`;
	}

	static override styles = [UmbTextStyles, FORMULATE_SETTINGS_STYLES, ORIENTATION_SETTING_STYLES];
}

export { FormulateRadioButtonListFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-radio-button-list-field-editor': FormulateRadioButtonListFieldEditorElement;
	}
}
