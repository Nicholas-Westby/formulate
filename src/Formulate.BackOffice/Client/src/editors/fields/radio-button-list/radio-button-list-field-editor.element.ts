import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';
import { renderDataValuesSetting } from '../data-value-list/data-values-setting.js';

/** The orientations the server knows, as Formulate 4 stored them. */
const ORIENTATIONS = [
	{ value: 'Horizontal', key: 'formulate_horizontal' },
	{ value: 'Vertical', key: 'formulate_vertical' },
];

/**
 * The editor of the Radio Button List field, { dataValue, orientation }: the data values item that holds the
 * choices, and whether the buttons are laid out across or down (none: as the form's template lays them out).
 */
@customElement('formulate-radio-button-list-field-editor')
export class FormulateRadioButtonListFieldEditorElement extends FormulateKindEditorElementBase {
	override render() {
		const orientation = readText(readSettings(this.value), 'orientation');

		return html`
			${renderDataValuesSetting(this, this.value, this.readonly, (settings) => this.updateValue(settings))}
			<umb-property-layout
				label=${this.localize.term('formulate_orientation')}
				description=${this.localize.term('formulate_orientationDescription')}
				orientation="vertical">
				<uui-select
					slot="editor"
					id="orientation"
					label=${this.localize.term('formulate_orientation')}
					.options=${[
						{ name: this.localize.term('formulate_defaultOrientation'), value: '', selected: !orientation },
						...ORIENTATIONS.map(({ value, key }) => ({ name: this.localize.term(key), value, selected: value === orientation })),
					]}
					?readonly=${this.readonly}
					?disabled=${this.readonly}
					@change=${(event: Event) =>
						this.updateValue({
							...readSettings(this.value),
							orientation: String((event.target as HTMLInputElement).value ?? '') || null,
						})}></uui-select>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SETTINGS_STYLES,
		css`
			uui-select {
				width: 100%;
			}
		`,
	];
}

export { FormulateRadioButtonListFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-radio-button-list-field-editor': FormulateRadioButtonListFieldEditorElement;
	}
}
