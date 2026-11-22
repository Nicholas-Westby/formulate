import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import type { FormHandlerDefinitionModel } from '../../../api/index.js';
import type { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import { newFormHandler } from '../../form-items.js';
import { FORMULATE_EDIT_HANDLER_MODAL } from '../../modals/edit-handler/edit-handler-modal.token.js';
import type { FormulateFormHandlerModel } from '../../types.js';
import type { FormulateFormWorkspaceContext } from '../form-workspace.context.js';
import { FormulateFormItemsViewElement } from './form-items-view-base.js';

/**
 * The Handlers view of the form workspace (Formulate.WorkspaceView.Form.Handlers): what is done with each
 * submission of the form, such as storing it, in the order the handlers run. Each row switches its handler
 * on and off.
 */
@customElement('formulate-form-handlers-workspace-view')
export class FormulateFormHandlersWorkspaceViewElement extends FormulateFormItemsViewElement<
	FormulateFormHandlerModel,
	FormHandlerDefinitionModel
> {
	constructor() {
		super({
			add: 'formulate_addHandler',
			deleteHeadline: 'formulate_deleteHandler',
			confirmDelete: 'formulate_confirmDeleteHandler',
			sorterIdentifier: 'Formulate.Sorter.FormHandlers',
			fallbackIcon: 'icon-lightning',
		});
	}

	protected override observeItems(workspace: FormulateFormWorkspaceContext) {
		return workspace.handlers;
	}

	protected override observeKinds(definitions: FormulateDefinitionsContext) {
		return definitions.formHandlerDefinitions;
	}

	protected override requestKinds(definitions: FormulateDefinitionsContext) {
		return definitions.getFormHandlerDefinitions();
	}

	protected override newItem(kind: FormHandlerDefinitionModel) {
		return newFormHandler(kind);
	}

	protected override async openItem(handler: FormulateFormHandlerModel, isNew: boolean) {
		const edited = await umbOpenModal(this, FORMULATE_EDIT_HANDLER_MODAL, {
			data: { handler, isNew, ...this.formOfItems() },
		}).catch(() => undefined);

		return edited?.handler;
	}

	protected override addItem(handler: FormulateFormHandlerModel) {
		this._workspace?.addHandler(handler);
	}

	protected override updateItem(handler: FormulateFormHandlerModel) {
		this._workspace?.updateHandler(handler);
	}

	protected override removeItem(id: string) {
		this._workspace?.removeHandler(id);
	}

	protected override setItems(handlers: ReadonlyArray<FormulateFormHandlerModel>) {
		this._workspace?.setHandlers(handlers);
	}

	protected override moveItem(id: string, index: number) {
		this._workspace?.moveHandler(id, index);
	}

	protected override renderRowContent(handler: FormulateFormHandlerModel, position: number) {
		// Shows Enabled; a screen reader hears which handler it is for.
		return html`<uui-toggle
			class="enabled"
			label=${this.localize.term('formulate_enabled')}
			aria-label=${this.localize.term('formulate_enabledItem', handler.name ?? '', position)}
			.checked=${handler.enabled}
			@change=${(event: Event) => this._workspace?.setHandlerEnabled(handler.id, (event.target as HTMLInputElement).checked)}></uui-toggle>`;
	}

	static override styles = [
		...FormulateFormItemsViewElement.styles,
		css`
			.enabled {
				margin-right: var(--uui-size-space-4);
			}
		`,
	];
}

export { FormulateFormHandlersWorkspaceViewElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-form-handlers-workspace-view': FormulateFormHandlersWorkspaceViewElement;
	}
}
