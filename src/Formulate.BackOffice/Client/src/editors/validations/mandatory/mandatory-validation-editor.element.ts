import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';

/**
 * The editor of the Mandatory validation, { message, clientSideOnly }: the message shown when the field is
 * left empty, and whether only the browser checks it.
 */
@customElement('formulate-mandatory-validation-editor')
export class FormulateMandatoryValidationEditorElement extends FormulateKindEditorElementBase {
	#change(settings: Record<string, unknown>) {
		this.updateValue({ ...readSettings(this.value), ...settings });
	}

	override render() {
		const settings = readSettings(this.value);

		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_errorMessage')}
				description=${this.localize.term('formulate_mandatoryMessageDescription')}>
				<uui-input
					slot="editor"
					id="message"
					label=${this.localize.term('formulate_errorMessage')}
					.value=${readText(settings, 'message')}
					?readonly=${this.readonly}
					@input=${(event: Event) => this.#change({ message: String((event.target as HTMLInputElement).value) })}></uui-input>
			</umb-property-layout>
			<umb-property-layout
				label=${this.localize.term('formulate_clientSideOnly')}
				description=${this.localize.term('formulate_clientSideOnlyDescription')}>
				<!-- Named for screen readers only: the label beside it says the same, as Umbraco's toggles do. -->
				<uui-toggle
					slot="editor"
					id="client-side-only"
					aria-label=${this.localize.term('formulate_clientSideOnly')}
					.checked=${settings.clientSideOnly === true}
					?readonly=${this.readonly}
					@change=${(event: Event) => this.#change({ clientSideOnly: (event.target as HTMLInputElement).checked })}></uui-toggle>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			/* Full width, as Umbraco's text box property editor. */
			uui-input {
				width: 100%;
			}
		`,
	];
}

export { FormulateMandatoryValidationEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-mandatory-validation-editor': FormulateMandatoryValidationEditorElement;
	}
}
