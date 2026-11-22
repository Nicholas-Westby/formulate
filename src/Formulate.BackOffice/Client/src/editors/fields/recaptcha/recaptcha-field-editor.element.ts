import { css, customElement, html, nothing, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../../core/definitions.context-token.js';
import { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';

/**
 * The editor of the reCAPTCHA field, which has nothing to set: its keys are the site's settings
 * (Formulate:Recaptcha:SiteKey and SecretKey), and the field stores no configuration. It says whether this site has
 * both keys set, as Formulate's configuration tells it, since until it has, the field rejects every submission. It
 * leaves the configuration as it is.
 */
@customElement('formulate-recaptcha-field-editor')
export class FormulateRecaptchaFieldEditorElement extends FormulateKindEditorElementBase {
	/** Whether this site has both reCAPTCHA keys set; undefined until Formulate's configuration has been read. */
	@state()
	private _configured?: boolean;

	constructor() {
		super();

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, (definitions) => {
			this.observe(definitions?.config, (config) => (this._configured = config?.recaptchaConfigured), '_observeConfig');
		});
	}

	#renderKeys() {
		if (this._configured === undefined) {
			return nothing;
		}

		return this._configured
			? html`<p id="status">${this.localize.term('formulate_recaptchaKeysSet')}</p>`
			: html`<div id="notice" role="note">${this.localize.term('formulate_recaptchaKeysNotSet')}</div>`;
	}

	override render() {
		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_recaptchaKeys')}
				description=${this.localize.term('formulate_recaptchaKeysDescription')}
				orientation="vertical">
				<div slot="editor">${this.#renderKeys()}</div>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SETTINGS_STYLES,
		css`
			#status {
				margin: 0;
			}

			/* As Umbraco's own warnings look, such as the language workspace's. */
			#notice {
				padding: var(--uui-size-space-4) var(--uui-size-space-5);
				border: 1px solid var(--uui-color-warning-standalone);
				border-radius: var(--uui-border-radius);
				background-color: var(--uui-color-warning);
				color: var(--uui-color-warning-contrast);
			}
		`,
	];
}

export { FormulateRecaptchaFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-recaptcha-field-editor': FormulateRecaptchaFieldEditorElement;
	}
}
