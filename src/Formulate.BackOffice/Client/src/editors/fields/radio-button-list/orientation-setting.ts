import { css, html } from '@umbraco-cms/backoffice/external/lit';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { readSettings, readText } from '../../../core/kind-editor.js';

/** The orientations the server knows, as Formulate 4 stored them. */
const ORIENTATIONS = [
	{ value: 'Horizontal', key: 'formulate_horizontal' },
	{ value: 'Vertical', key: 'formulate_vertical' },
];

/**
 * The settings with an orientation, as the server's pre-values of a list of radio buttons store it:
 * { orientation } (a string), null for none (as the form's template lays the buttons out).
 * @param settings The settings.
 * @param orientation The orientation picked, or an empty string for none.
 * @returns The new settings.
 */
export function withOrientation(settings: Readonly<Record<string, unknown>>, orientation: string): Record<string, unknown> {
	return { ...settings, orientation: orientation || null };
}

/**
 * The orientation setting of a list of radio buttons, which the Radio Button List and Extended Radio Button List
 * editors share: whether the buttons are laid out across or down. Its select is styled by
 * ORIENTATION_SETTING_STYLES.
 * @param host The editor.
 * @param value The editor's value.
 * @param readonly Whether nothing may be changed.
 * @param onChange Told of the orientation picked, an empty string for none (see withOrientation).
 */
export function renderOrientationSetting(
	host: UmbLitElement,
	value: unknown,
	readonly: boolean,
	onChange: (orientation: string) => void,
) {
	const orientation = readText(readSettings(value), 'orientation');

	return html`
		<umb-property-layout
			label=${host.localize.term('formulate_orientation')}
			description=${host.localize.term('formulate_orientationDescription')}
			orientation="vertical">
			<uui-select
				slot="editor"
				id="orientation"
				label=${host.localize.term('formulate_orientation')}
				.options=${[
					{ name: host.localize.term('formulate_defaultOrientation'), value: '', selected: !orientation },
					...ORIENTATIONS.map(({ value, key }) => ({ name: host.localize.term(key), value, selected: value === orientation })),
				]}
				?readonly=${readonly}
				?disabled=${readonly}
				@change=${(event: Event) => onChange(String((event.target as HTMLInputElement).value ?? ''))}></uui-select>
		</umb-property-layout>
	`;
}

/** The styles of the orientation setting, for the editors that show it: its select is as wide as the setting. */
export const ORIENTATION_SETTING_STYLES = css`
	uui-select#orientation {
		width: 100%;
	}
`;
