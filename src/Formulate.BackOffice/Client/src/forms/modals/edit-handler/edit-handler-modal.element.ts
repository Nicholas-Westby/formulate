import { customElement, html, state } from '@umbraco-cms/backoffice/external/lit';
import type { FormHandlerDefinitionModel } from '../../../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../../core/definitions.context-token.js';
import { FORMULATE_HANDLER_EDITOR_TYPE } from '../../../core/kind-editor.js';
import { isSameKind } from '../../../core/kind-id.js';
import type { FormulateFormHandlerModel } from '../../types.js';
import { FormulateEditItemModalBaseElement } from '../edit-item-modal-base.js';
import type { FormulateEditHandlerModalData, FormulateEditHandlerModalValue } from './edit-handler-modal.token.js';

/**
 * The dialog of a handler (Formulate.Modal.EditHandler): its name and alias, whether it is enabled, and its
 * kind's own settings, shown by the kind's handler editor, which is given the form's fields (such as for
 * the fields an email includes) and its ID.
 */
@customElement('formulate-edit-handler-modal')
export class FormulateEditHandlerModalElement extends FormulateEditItemModalBaseElement<
	FormulateFormHandlerModel,
	FormulateEditHandlerModalData,
	FormulateEditHandlerModalValue
> {
	/** The definition of the handler's kind: undefined while it is read, null when the kind is not installed. */
	@state()
	private _definition?: FormHandlerDefinitionModel | null;

	constructor() {
		super();

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, async (definitions) => {
			if (!definitions) {
				return;
			}

			const kinds = await definitions.getFormHandlerDefinitions();
			const kindId = this.data?.handler.kindId;
			this._definition = (kindId && kinds.find((kind) => isSameKind(kind.kindId, kindId))) || null;
		});
	}

	protected override readItem(data: FormulateEditHandlerModalData) {
		return data.handler;
	}

	protected override toValue(handler: FormulateFormHandlerModel) {
		return { handler };
	}

	override render() {
		const definition = this._definition;
		const headline = this.localize.term(this.data?.isNew ? 'formulate_addHandler' : 'formulate_editHandler', definition?.name ?? '');

		return html`
			<umb-body-layout headline=${headline}>
				<div id="main">
					<uui-box>
						${this.renderNameAndAlias()}
						<umb-property-layout
							label=${this.localize.term('formulate_enabled')}
							description=${this.localize.term('formulate_enabledDescription')}
							orientation="vertical">
							<!-- Named for screen readers only: the label beside it says the same, as Umbraco's toggles do. -->
							<uui-toggle
								slot="editor"
								id="enabled"
								aria-label=${this.localize.term('formulate_enabled')}
								.checked=${this._item?.enabled ?? true}
								@change=${(event: Event) => this.updateItem({ enabled: (event.target as HTMLInputElement).checked })}></uui-toggle>
						</umb-property-layout>
					</uui-box>
					${this.renderSettings(FORMULATE_HANDLER_EDITOR_TYPE, definition, 'formulate_unknownHandlerKind')}
				</div>
				${this.renderActions()}
			</umb-body-layout>
		`;
	}
}

export { FormulateEditHandlerModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-edit-handler-modal': FormulateEditHandlerModalElement;
	}
}
