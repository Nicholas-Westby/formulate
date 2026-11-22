import { css, customElement, html, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../../core/definitions.context-token.js';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';

/**
 * The editor of the Button field, { buttonKind }: what kind of button it is, from the button kinds set up in
 * Formulate's configuration (Formulate:Buttons; Next, Previous and Submit unless set up otherwise). A kind
 * that is no longer set up stays picked, so opening the field does not lose it.
 */
@customElement('formulate-button-field-editor')
export class FormulateButtonFieldEditorElement extends FormulateKindEditorElementBase {
	@state()
	private _buttonKinds: ReadonlyArray<string> = [];

	constructor() {
		super();

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, (definitions) => {
			this.observe(definitions?.config, (config) => (this._buttonKinds = config?.buttonKinds ?? []), '_observeConfig');
		});
	}

	#options() {
		const picked = readText(readSettings(this.value), 'buttonKind');
		const kinds = picked && !this._buttonKinds.includes(picked) ? [picked, ...this._buttonKinds] : this._buttonKinds;

		return [
			{ name: this.localize.term('formulate_noButtonKind'), value: '', selected: !picked },
			...kinds.map((kind) => ({ name: kind, value: kind, selected: kind === picked })),
		];
	}

	override render() {
		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_buttonKind')}
				description=${this.localize.term('formulate_buttonKindDescription')}
				orientation="vertical">
				<uui-select
					slot="editor"
					id="button-kind"
					label=${this.localize.term('formulate_buttonKind')}
					.options=${this.#options()}
					?readonly=${this.readonly}
					?disabled=${this.readonly}
					@change=${(event: Event) =>
						this.updateValue({
							...readSettings(this.value),
							buttonKind: String((event.target as HTMLInputElement).value ?? '') || null,
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

export { FormulateButtonFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-button-field-editor': FormulateButtonFieldEditorElement;
	}
}
