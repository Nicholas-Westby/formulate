import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { readText } from '../../../core/kind-editor.js';
import { FormulateSortableRowsInputElement, type FormulateListRow } from '../../../core/sortable/sortable-rows-input.js';

/**
 * The recipients of an email, [{ email }], as the email handlers store them: an address in each row, which
 * can have a name (Sales <sales@example.com>) or list several addresses separated by commas. Recipients can
 * be added, changed, removed and put in order. Each input is named by its place, as an address can be blank.
 */
@customElement('formulate-email-recipients-input')
export class FormulateEmailRecipientsInputElement extends FormulateSortableRowsInputElement {
	constructor() {
		super('Formulate.Sorter.EmailRecipients');
	}

	protected override describeItem(_item: unknown, position: number) {
		return this.localize.term('formulate_recipientPosition', position);
	}

	protected override renderItem(row: FormulateListRow, position: number) {
		return html`<uui-input
			class="field email"
			label=${this.localize.term('formulate_recipientPosition', position)}
			.value=${readText(row.item, 'email')}
			?readonly=${this.readonly}
			@input=${(event: Event) => this.changeItem(row.key, { email: String((event.target as HTMLInputElement).value ?? '') })}></uui-input>`;
	}

	protected override renderAddButtons() {
		return html`<div id="buttons">
			<uui-button
				id="add"
				look="placeholder"
				label=${this.localize.term('formulate_addRecipient')}
				@click=${() => this.addItems([{ email: '' }])}></uui-button>
		</div>`;
	}
}

export { FormulateEmailRecipientsInputElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-email-recipients-input': FormulateEmailRecipientsInputElement;
	}
}
