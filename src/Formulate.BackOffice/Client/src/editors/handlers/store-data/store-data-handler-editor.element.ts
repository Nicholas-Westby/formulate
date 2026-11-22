import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';

/**
 * The editor of the Store Data handler, which has nothing to set: it says what the handler stores, and
 * leaves the configuration as it is.
 */
@customElement('formulate-store-data-handler-editor')
export class FormulateStoreDataHandlerEditorElement extends FormulateKindEditorElementBase {
	override render() {
		return html`<p id="description">${this.localize.term('formulate_storeDataDescription')}</p>`;
	}

	// As the slot's "No settings": the text alone, with no space of its own around it.
	static override styles = [
		UmbTextStyles,
		css`
			#description {
				margin: 0;
			}
		`,
	];
}

export { FormulateStoreDataHandlerEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-store-data-handler-editor': FormulateStoreDataHandlerEditorElement;
	}
}
