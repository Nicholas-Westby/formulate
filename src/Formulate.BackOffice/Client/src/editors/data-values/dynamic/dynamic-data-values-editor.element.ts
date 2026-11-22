import { customElement, html, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase } from '../../../core/kind-editor.js';
import { isSameKind } from '../../../core/kind-id.js';
import { FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT } from '../../../core/kind-item/kind-item-workspace.context-token.js';

/** The kind of the states and territories of the United States. */
const US_STATES_KIND_ID = '6CFFC488670E4CC7B965A5F3676BA333';

/**
 * The editor of data values whose items their kind makes itself, such as the states and territories of the
 * United States: there is nothing to set, so it says what the items are. It knows them for Formulate's own
 * kinds; of another kind, it says only that the kind makes them, under the kind's name.
 */
@customElement('formulate-dynamic-data-values-editor')
export class FormulateDynamicDataValuesEditorElement extends FormulateKindEditorElementBase {
	/** The kind of the data values, from their workspace. */
	@state()
	private _kindId?: string;

	constructor() {
		super();

		this.consumeContext(FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT, (context) => {
			this.observe(context?.kindId, (kindId) => (this._kindId = kindId), '_observeKindId');
		});
	}

	override render() {
		const isUsStates = !!this._kindId && isSameKind(this._kindId, US_STATES_KIND_ID);
		const description = isUsStates ? 'formulate_usStatesDataValues' : 'formulate_dynamicDataValues';

		return html`<p id="description">${this.localize.term(description)}</p>`;
	}

	static override styles = [UmbTextStyles];
}

export { FormulateDynamicDataValuesEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-dynamic-data-values-editor': FormulateDynamicDataValuesEditorElement;
	}
}
