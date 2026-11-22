import { css, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../core/settings-styles.js';

/** How the text of a field is edited. */
export interface FormulateTextSettingArgs {
	/** Whether the text can have several lines. */
	multiline: boolean;
	/** The localization key of what the text is for. */
	descriptionKey: string;
}

/**
 * The editor of a field whose one setting is a text, { text }, such as Header: the text, in a text box or,
 * for text of several lines, a text area. It keeps the settings it does not edit.
 */
export abstract class FormulateTextSettingEditorElement extends FormulateKindEditorElementBase {
	#args: FormulateTextSettingArgs;

	constructor(args: FormulateTextSettingArgs) {
		super();
		this.#args = args;
	}

	#onInput(event: Event) {
		this.updateValue({ ...readSettings(this.value), text: String((event.target as HTMLInputElement).value ?? '') });
	}

	override render() {
		const text = readText(readSettings(this.value), 'text');
		const label = this.localize.term('formulate_text');

		return html`
			<umb-property-layout label=${label} description=${this.localize.term(this.#args.descriptionKey)} orientation="vertical">
				${this.#args.multiline
					? html`<uui-textarea
							slot="editor"
							id="text"
							label=${label}
							rows="4"
							auto-height
							.value=${text}
							?readonly=${this.readonly}
							@input=${this.#onInput}></uui-textarea>`
					: html`<uui-input
							slot="editor"
							id="text"
							label=${label}
							.value=${text}
							?readonly=${this.readonly}
							@input=${this.#onInput}></uui-input>`}
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SETTINGS_STYLES,
		css`
			uui-input,
			uui-textarea {
				width: 100%;
			}
		`,
	];
}
