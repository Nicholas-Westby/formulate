import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';
import { readItems } from '../../../core/sortable/sortable-rows-input.js';
import type { FormulateFieldMappingsInputElement } from './field-mappings-input.element.js';
import './field-mappings-input.element.js';
import { FORMULATE_TRANSMISSION_FORMATS } from './transmission-formats.js';

/** The HTTP methods offered, as Formulate 3 offered them; a stored method of another kind stays shown. */
const METHODS = ['GET', 'POST'];

/**
 * The editor of the Send Data handler (SendDataConfiguration): the URL the data is sent to, the HTTP method,
 * the transmission format, and the fields that are sent and the name each is sent with. A method or format
 * left blank shows as the one the server sends with (GET and Query String, as in Formulate 3). Formulate 3's
 * result handler is not shown: Formulate 5 does not use it, and the editor keeps it as it is.
 */
@customElement('formulate-send-data-handler-editor')
export class FormulateSendDataHandlerEditorElement extends FormulateKindEditorElementBase {
	#change(settings: Record<string, unknown>) {
		this.updateValue({ ...readSettings(this.value), ...settings });
	}

	#methodOptions(stored: unknown) {
		// The server sends the method in upper case, and GET when there is none.
		const method = (typeof stored === 'string' ? stored.trim().toUpperCase() : '') || 'GET';
		const methods = METHODS.includes(method) ? METHODS : [...METHODS, method];

		return methods.map((candidate) => ({ name: candidate, value: candidate, selected: candidate === method }));
	}

	#formatOptions(stored: unknown) {
		// The server reads the format ignoring case, and sends with Query String when there is none.
		const format = typeof stored === 'string' ? stored.trim() : '';
		const formats: Array<string> = Object.values(FORMULATE_TRANSMISSION_FORMATS);
		const known = format ? formats.find((candidate) => candidate.toLowerCase() === format.toLowerCase()) : FORMULATE_TRANSMISSION_FORMATS.QueryString;
		const options = formats.map((candidate) => ({ name: candidate, value: candidate, selected: candidate === known }));

		// A format the server does not know sends nothing; it stays shown, as it is stored.
		return known
			? options
			: [...options, { name: this.localize.term('formulate_unknownTransmissionFormat', format), value: format, selected: true }];
	}

	override render() {
		const settings = readSettings(this.value);
		const urlLabel = this.localize.term('formulate_sendDataUrl');
		const methodLabel = this.localize.term('formulate_httpMethod');
		const formatLabel = this.localize.term('formulate_transmissionFormat');
		const fieldsLabel = this.localize.term('formulate_fieldsToSend');

		return html`
			<umb-property-layout label=${urlLabel} description=${this.localize.term('formulate_sendDataUrlDescription')} orientation="vertical">
				<uui-input
					slot="editor"
					id="url"
					type="url"
					label=${urlLabel}
					.value=${readText(settings, 'url')}
					?readonly=${this.readonly}
					@input=${(event: Event) => this.#change({ url: String((event.target as HTMLInputElement).value ?? '') })}></uui-input>
			</umb-property-layout>
			<umb-property-layout label=${methodLabel} description=${this.localize.term('formulate_httpMethodDescription')} orientation="vertical">
				<uui-select
					slot="editor"
					id="method"
					label=${methodLabel}
					.options=${this.#methodOptions(settings.method)}
					?readonly=${this.readonly}
					?disabled=${this.readonly}
					@change=${(event: Event) => this.#change({ method: String((event.target as HTMLInputElement).value ?? '') })}></uui-select>
			</umb-property-layout>
			<umb-property-layout
				label=${formatLabel}
				description=${this.localize.term('formulate_transmissionFormatDescription')}
				orientation="vertical">
				<uui-select
					slot="editor"
					id="transmission-format"
					label=${formatLabel}
					.options=${this.#formatOptions(settings.transmissionFormat)}
					?readonly=${this.readonly}
					?disabled=${this.readonly}
					@change=${(event: Event) =>
						this.#change({ transmissionFormat: String((event.target as HTMLInputElement).value ?? '') })}></uui-select>
			</umb-property-layout>
			<umb-property-layout label=${fieldsLabel} description=${this.localize.term('formulate_fieldsToSendDescription')} orientation="vertical">
				<formulate-field-mappings-input
					slot="editor"
					id="fields"
					headline=${fieldsLabel}
					.fields=${this.context?.formFields ?? []}
					.value=${readItems(settings.fields)}
					?readonly=${this.readonly}
					@change=${(event: Event) =>
						this.#change({ fields: (event.target as FormulateFieldMappingsInputElement).value })}></formulate-field-mappings-input>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SETTINGS_STYLES,
		css`
			uui-input,
			uui-select {
				width: 100%;
			}
		`,
	];
}

export { FormulateSendDataHandlerEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-send-data-handler-editor': FormulateSendDataHandlerEditorElement;
	}
}
