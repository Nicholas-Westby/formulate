import { customElement, html, nothing, state } from '@umbraco-cms/backoffice/external/lit';
import type { FieldCategoryModel, FormFieldDefinitionModel } from '../../../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../../core/definitions.context-token.js';
import { FORMULATE_FIELD_EDITOR_TYPE } from '../../../core/kind-editor.js';
import { isSameKind } from '../../../core/kind-id.js';
import '../../../core/pickers/validation-picker.element.js';
import type { FormulateValidationPickerElement } from '../../../core/pickers/validation-picker.element.js';
import type { FormulateFormFieldModel } from '../../types.js';
import { FormulateEditItemModalBaseElement } from '../edit-item-modal-base.js';
import type { FormulateEditFieldModalData, FormulateEditFieldModalValue } from './edit-field-modal.token.js';

/** An option of the category select. */
interface CategoryOption {
	name: string;
	value: string;
	group?: string;
	selected: boolean;
}

/**
 * The dialog of a field (Formulate.Modal.EditField): its name and alias; its label, category and validations
 * when its kind has them; and its kind's own settings, shown by the kind's field editor, which is given the
 * form's fields and ID. The category is one of the field categories set up in Formulate's configuration
 * (Formulate:Fields:Categories), so there is none to pick when none are set up.
 */
@customElement('formulate-edit-field-modal')
export class FormulateEditFieldModalElement extends FormulateEditItemModalBaseElement<
	FormulateFormFieldModel,
	FormulateEditFieldModalData,
	FormulateEditFieldModalValue
> {
	/** The definition of the field's kind: undefined while it is read, null when the kind is not installed. */
	@state()
	private _definition?: FormFieldDefinitionModel | null;

	@state()
	private _categories: ReadonlyArray<FieldCategoryModel> = [];

	constructor() {
		super();

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, async (definitions) => {
			if (!definitions) {
				return;
			}

			const [kinds, config] = await Promise.all([definitions.getFormFieldDefinitions(), definitions.getConfig()]);
			const kindId = this.data?.field.kindId;
			this._categories = config?.fieldCategories ?? [];
			this._definition = (kindId && kinds.find((kind) => isSameKind(kind.kindId, kindId))) || null;
		});
	}

	protected override readItem(data: FormulateEditFieldModalData) {
		return data.field;
	}

	protected override toValue(field: FormulateFormFieldModel) {
		return { field };
	}

	override render() {
		const definition = this._definition;
		const headline = this.localize.term(this.data?.isNew ? 'formulate_addField' : 'formulate_editField', definition?.name ?? '');

		return html`
			<umb-body-layout headline=${headline}>
				<div id="main">
					<uui-box>
						${this.renderNameAndAlias()} ${definition?.supportsLabel ? this.#renderLabel() : nothing}
						${definition?.supportsCategory ? this.#renderCategory() : nothing}
					</uui-box>
					${definition?.supportsValidation ? this.#renderValidations() : nothing}
					${this.renderSettings(FORMULATE_FIELD_EDITOR_TYPE, definition, 'formulate_unknownFieldKind')}
				</div>
				${this.renderActions()}
			</umb-body-layout>
		`;
	}

	#renderLabel() {
		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_label')}
				description=${this.localize.term('formulate_labelDescription')}
				orientation="vertical">
				<uui-input
					slot="editor"
					id="label"
					label=${this.localize.term('formulate_label')}
					.value=${this._item?.label ?? ''}
					@input=${(event: Event) => this.updateItem({ label: String((event.target as HTMLInputElement).value ?? '') || null })}></uui-input>
			</umb-property-layout>
		`;
	}

	/** The categories set up, grouped as the configuration groups them; the field's own one too, if it is gone. */
	#categoryOptions(): Array<CategoryOption> {
		const category = this._item?.category ?? null;
		const options: Array<CategoryOption> = [
			{ name: this.localize.term('formulate_noCategory'), value: '', selected: !category },
		];

		if (category && !this._categories.some((candidate) => candidate.kind === category)) {
			options.push({ name: category, value: category, selected: true });
		}

		for (const { group, kind } of this._categories) {
			options.push({ name: kind, value: kind, group: group || undefined, selected: kind === category });
		}

		return options;
	}

	#renderCategory() {
		if (!this._categories.length && !this._item?.category) {
			return nothing;
		}

		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_category')}
				description=${this.localize.term('formulate_categoryDescription')}
				orientation="vertical">
				<uui-select
					slot="editor"
					id="category"
					label=${this.localize.term('formulate_category')}
					.options=${this.#categoryOptions()}
					@change=${(event: Event) =>
						this.updateItem({ category: String((event.target as HTMLInputElement).value ?? '') || null })}></uui-select>
			</umb-property-layout>
		`;
	}

	#renderValidations() {
		return html`
			<uui-box headline=${this.localize.term('validation_validation')}>
				<umb-property-layout
					label=${this.localize.term('formulate_validations')}
					description=${this.localize.term('formulate_validationsDescription')}
					orientation="vertical">
					<formulate-validation-picker
						slot="editor"
						id="validations"
						.value=${this._item?.validations ?? []}
						@change=${(event: Event) =>
							this.updateItem({
								validations: [...(event.target as FormulateValidationPickerElement).value],
							})}></formulate-validation-picker>
				</umb-property-layout>
			</uui-box>
		`;
	}
}

export { FormulateEditFieldModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-edit-field-modal': FormulateEditFieldModalElement;
	}
}
