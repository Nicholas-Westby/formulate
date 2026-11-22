import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { customElement, property } from '@umbraco-cms/backoffice/external/lit';
import { FORMULATE_DATA_VALUES_ENTITY_TYPE, FORMULATE_DATA_VALUES_TREE_ALIAS } from '../../constants.js';
import { FormulateTreeItemPickerElement } from './tree-item-picker.element.js';

/** The ID the API gives for no data values (an empty GUID, as the server's configurations hold a Guid). */
const NO_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Picks one data values item, such as the choices of a drop down: the value is its ID, or undefined when
 * none is picked. The empty ID the API gives for none counts as none.
 */
@customElement('formulate-data-values-picker')
export class FormulateDataValuesPickerElement extends FormulateTreeItemPickerElement {
	/** The ID of the picked data values. */
	@property({ attribute: false })
	value?: string;

	constructor() {
		super({
			treeAlias: FORMULATE_DATA_VALUES_TREE_ALIAS,
			entityType: FORMULATE_DATA_VALUES_ENTITY_TYPE,
			multiple: false,
			icon: 'icon-bulleted-list',
			notFoundKey: 'formulate_dataValuesNotFound',
			kinds: (definitions) => definitions.dataValuesDefinitions,
			sorterIdentifier: 'Formulate.Sorter.DataValues',
		});
	}

	protected override getIds() {
		return this.value && this.value !== NO_ID ? [this.value] : [];
	}

	protected override setIds(ids: ReadonlyArray<string>) {
		this.value = ids[0];
		this.dispatchEvent(new UmbChangeEvent());
	}
}

export { FormulateDataValuesPickerElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-data-values-picker': FormulateDataValuesPickerElement;
	}
}
