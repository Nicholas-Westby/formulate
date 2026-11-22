import { customElement, html, nothing } from '@umbraco-cms/backoffice/external/lit';
import { readText } from '../../../core/kind-editor.js';
import type { FormulateListRow } from '../../../core/sortable/sortable-rows-input.js';
import { FormulateSortableItemsEditorElement } from '../sortable-items-editor.js';

/**
 * The editor of Pair List data values, { items: [{ primary, secondary }] }: each item's value (primary) is
 * what is stored and its label (secondary) is what visitors see. The items can be added, changed, removed
 * and sorted.
 */
@customElement('formulate-pair-list-data-values-editor')
export class FormulatePairListDataValuesEditorElement extends FormulateSortableItemsEditorElement {
	protected override readonly itemsDescriptionKey = 'formulate_pairListItemsDescription';

	constructor() {
		super('Formulate.Sorter.PairListDataValues');
	}

	protected override newItem() {
		return { primary: '', secondary: '' };
	}

	protected override describeItem(item: Readonly<Record<string, unknown>>) {
		return readText(item, 'secondary') || readText(item, 'primary');
	}

	protected override renderHeaders() {
		return html`
			<div id="headers">
				${this.readonly ? nothing : html`<span class="handle-space"></span>`}
				<span class="header field">${this.localize.term('general_value')}</span>
				<span class="header field">${this.localize.term('general_label')}</span>
				${this.readonly ? nothing : html`<span class="remove-space"></span>`}
			</div>
		`;
	}

	protected override renderItem(row: FormulateListRow, position: number) {
		return html`
			<uui-input
				class="field primary"
				label=${this.localize.term('formulate_itemValue', position)}
				.value=${readText(row.item, 'primary')}
				?readonly=${this.readonly}
				@input=${(event: Event) => this.changeItem(row.key, { primary: String((event.target as HTMLInputElement).value) })}></uui-input>
			<uui-input
				class="field secondary"
				label=${this.localize.term('formulate_itemLabel', position)}
				.value=${readText(row.item, 'secondary')}
				?readonly=${this.readonly}
				@input=${(event: Event) =>
					this.changeItem(row.key, { secondary: String((event.target as HTMLInputElement).value) })}></uui-input>
		`;
	}
}

export { FormulatePairListDataValuesEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-pair-list-data-values-editor': FormulatePairListDataValuesEditorElement;
	}
}
