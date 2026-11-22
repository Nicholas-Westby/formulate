import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';

/**
 * The editor of legacy data values, made by an older version of Formulate: they can no longer be changed
 * (the workspace is read-only), so it says what to do instead.
 */
@customElement('formulate-legacy-data-values-editor')
export class FormulateLegacyDataValuesEditorElement extends FormulateKindEditorElementBase {
	override render() {
		return html`<div id="notice" role="note">${this.localize.term('formulate_legacyDataValues')}</div>`;
	}

	static override styles = [
		UmbTextStyles,
		css`
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

export { FormulateLegacyDataValuesEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-legacy-data-values-editor': FormulateLegacyDataValuesEditorElement;
	}
}
