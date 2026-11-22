import { customElement, html, nothing } from '@umbraco-cms/backoffice/external/lit';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import type { FormFieldDefinitionModel } from '../../../api/index.js';
import type { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import { newFormField } from '../../form-items.js';
import { FORMULATE_EDIT_FIELD_MODAL } from '../../modals/edit-field/edit-field-modal.token.js';
import type { FormulateFormFieldModel } from '../../types.js';
import type { FormulateFormWorkspaceContext } from '../form-workspace.context.js';
import { FormulateFormItemsViewElement } from './form-items-view-base.js';

/**
 * The Fields view of the form workspace (Formulate.WorkspaceView.Form.Fields): the form's fields, in the order
 * the form shows them, each with its kind and how many validations it has. A field is added by picking its
 * kind, then filling in its dialog.
 */
@customElement('formulate-form-fields-workspace-view')
export class FormulateFormFieldsWorkspaceViewElement extends FormulateFormItemsViewElement<
	FormulateFormFieldModel,
	FormFieldDefinitionModel
> {
	constructor() {
		super({
			add: 'formulate_addField',
			deleteHeadline: 'formulate_deleteField',
			confirmDelete: 'formulate_confirmDeleteField',
			sorterIdentifier: 'Formulate.Sorter.FormFields',
			fallbackIcon: 'icon-autofill',
		});
	}

	protected override observeItems(workspace: FormulateFormWorkspaceContext) {
		return workspace.fields;
	}

	protected override observeKinds(definitions: FormulateDefinitionsContext) {
		return definitions.formFieldDefinitions;
	}

	protected override requestKinds(definitions: FormulateDefinitionsContext) {
		return definitions.getFormFieldDefinitions();
	}

	protected override newItem(kind: FormFieldDefinitionModel) {
		return newFormField(kind);
	}

	protected override async openItem(field: FormulateFormFieldModel, isNew: boolean) {
		const edited = await umbOpenModal(this, FORMULATE_EDIT_FIELD_MODAL, {
			data: { field, isNew, ...this.formOfItems() },
		}).catch(() => undefined);

		return edited?.field;
	}

	protected override addItem(field: FormulateFormFieldModel) {
		this._workspace?.addField(field);
	}

	protected override updateItem(field: FormulateFormFieldModel) {
		this._workspace?.updateField(field);
	}

	protected override removeItem(id: string) {
		this._workspace?.removeField(id);
	}

	protected override setItems(fields: ReadonlyArray<FormulateFormFieldModel>) {
		this._workspace?.setFields(fields);
	}

	protected override moveItem(id: string, index: number) {
		this._workspace?.moveField(id, index);
	}

	protected override renderTags(field: FormulateFormFieldModel) {
		const count = field.validations.length;

		return count
			? html`<uui-tag slot="tag" size="s" look="secondary">${this.localize.term('formulate_validationCount', count)}</uui-tag>`
			: nothing;
	}
}

export { FormulateFormFieldsWorkspaceViewElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-form-fields-workspace-view': FormulateFormFieldsWorkspaceViewElement;
	}
}
