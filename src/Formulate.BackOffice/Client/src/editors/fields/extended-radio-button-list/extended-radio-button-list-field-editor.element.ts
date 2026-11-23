import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';
import { renderDataValuesSetting, withDataValue } from '../data-value-list/data-values-setting.js';
import { ORIENTATION_SETTING_STYLES, renderOrientationSetting, withOrientation } from '../radio-button-list/orientation-setting.js';

/**
 * The editor of the Extended Radio Button List field, { dataValue, orientation }, as the Radio Button List's: the
 * data values item that holds the choices, and whether the buttons are laid out across or down. Each choice shows
 * its item's primary text, with its secondary text (such as a Pair List item's label) as its description.
 */
@customElement('formulate-extended-radio-button-list-field-editor')
export class FormulateExtendedRadioButtonListFieldEditorElement extends FormulateKindEditorElementBase {
	override render() {
		return html`
			${renderDataValuesSetting(
				this,
				this.value,
				this.readonly,
				(id) => this.updateValue(withDataValue(readSettings(this.value), id)),
				'formulate_extendedRadioButtonListDataValuesDescription',
			)}
			${renderOrientationSetting(this, this.value, this.readonly, (orientation) =>
				this.updateValue(withOrientation(readSettings(this.value), orientation)),
			)}
		`;
	}

	static override styles = [UmbTextStyles, FORMULATE_SETTINGS_STYLES, ORIENTATION_SETTING_STYLES];
}

export { FormulateExtendedRadioButtonListFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-extended-radio-button-list-field-editor': FormulateExtendedRadioButtonListFieldEditorElement;
	}
}
