import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { customElement, property } from '@umbraco-cms/backoffice/external/lit';
import { FORMULATE_VALIDATION_ENTITY_TYPE, FORMULATE_VALIDATIONS_TREE_ALIAS } from '../../constants.js';
import { FormulateTreeItemPickerElement } from './tree-item-picker.element.js';

/**
 * Picks the validations of a field in the Validation Library, in the order they are checked: the value is
 * the validations' IDs. Validations can be put in order by dragging them or with the keyboard.
 */
@customElement('formulate-validation-picker')
export class FormulateValidationPickerElement extends FormulateTreeItemPickerElement {
	/** The IDs of the picked validations, in the order they are checked. */
	@property({ attribute: false })
	value: ReadonlyArray<string> = [];

	constructor() {
		super({
			treeAlias: FORMULATE_VALIDATIONS_TREE_ALIAS,
			entityType: FORMULATE_VALIDATION_ENTITY_TYPE,
			multiple: true,
			icon: 'icon-check',
			notFoundKey: 'formulate_validationNotFound',
			kinds: (definitions) => definitions.validationDefinitions,
			sorterIdentifier: 'Formulate.Sorter.Validations',
		});
	}

	protected override getIds() {
		return this.value ?? [];
	}

	protected override setIds(ids: ReadonlyArray<string>) {
		this.value = [...ids];
		this.dispatchEvent(new UmbChangeEvent());
	}
}

export { FormulateValidationPickerElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-validation-picker': FormulateValidationPickerElement;
	}
}
