import { html } from '@umbraco-cms/backoffice/external/lit';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import '../../../core/pickers/data-values-picker.element.js';
import type { FormulateDataValuesPickerElement } from '../../../core/pickers/data-values-picker.element.js';
import { readSettings, readText } from '../../../core/kind-editor.js';

/**
 * The settings with the data values item picked, as the server's pre-values store it: { dataValue } (a
 * Guid). With none picked, dataValue is left out, as Formulate 4 left it: the server reads a missing one as
 * none, but refuses an explicit null.
 * @param settings The settings.
 * @param id The picked data values, or undefined for none.
 * @returns The new settings.
 */
export function withDataValue(settings: Readonly<Record<string, unknown>>, id: string | undefined): Record<string, unknown> {
	const { dataValue: _removed, ...others } = settings;

	return id ? { ...settings, dataValue: id } : others;
}

/**
 * The data values setting of a field: its label, description and picker.
 * @param host The editor.
 * @param value The editor's value.
 * @param readonly Whether nothing may be changed.
 * @param onChange Told of the settings with the new pick.
 * @param descriptionKey The term that describes the setting, for a kind that shows the data values its own way.
 */
export function renderDataValuesSetting(
	host: UmbLitElement,
	value: unknown,
	readonly: boolean,
	onChange: (settings: Record<string, unknown>) => void,
	descriptionKey = 'formulate_dataValuesDescription',
) {
	const settings = readSettings(value);

	return html`
		<umb-property-layout
			label=${host.localize.term('formulate_dataValues')}
			description=${host.localize.term(descriptionKey)}
			orientation="vertical">
			<formulate-data-values-picker
				slot="editor"
				id="data-value"
				.value=${readText(settings, 'dataValue') || undefined}
				?readonly=${readonly}
				@change=${(event: Event) =>
					onChange(withDataValue(readSettings(value), (event.target as FormulateDataValuesPickerElement).value))}></formulate-data-values-picker>
		</umb-property-layout>
	`;
}
