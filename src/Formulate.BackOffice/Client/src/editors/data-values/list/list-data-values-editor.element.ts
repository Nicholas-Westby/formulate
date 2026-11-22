import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { readText } from '../../../core/kind-editor.js';
import type { FormulateListRow } from '../../../core/sortable/sortable-rows-input.js';
import { FormulateSortableItemsEditorElement } from '../sortable-items-editor.js';

/**
 * The editor of List data values, { items: [{ value }] }: each item's value is both what is stored and
 * what visitors see. The items can be added, changed, removed and sorted.
 */
@customElement('formulate-list-data-values-editor')
export class FormulateListDataValuesEditorElement extends FormulateSortableItemsEditorElement {
	protected override readonly itemsDescriptionKey = 'formulate_listItemsDescription';

	constructor() {
		super('Formulate.Sorter.ListDataValues');
	}

	protected override newItem() {
		return { value: '' };
	}

	protected override describeItem(item: Readonly<Record<string, unknown>>) {
		return readText(item, 'value');
	}

	protected override renderItem(row: FormulateListRow, position: number) {
		return html`<uui-input
			class="field value"
			label=${this.localize.term('formulate_itemValue', position)}
			.value=${readText(row.item, 'value')}
			?readonly=${this.readonly}
			@input=${(event: Event) => this.changeItem(row.key, { value: String((event.target as HTMLInputElement).value) })}></uui-input>`;
	}
}

export { FormulateListDataValuesEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-list-data-values-editor': FormulateListDataValuesEditorElement;
	}
}
