import { css, customElement, html, nothing, property } from '@umbraco-cms/backoffice/external/lit';
import { isSameGuid } from '../../../core/guid.js';
import { readText } from '../../../core/kind-editor.js';
import {
	findField,
	FormulateFormFieldKinds,
	pickFormFields,
	type FormulatePickableField,
} from '../../../core/pickers/form-field-kinds.js';
import type { FormulatePickFieldsModalData } from '../../../core/pickers/pick-fields-modal.token.js';
import {
	FormulateSortableRowsInputElement,
	type FormulateListItem,
	type FormulateListRow,
} from '../../../core/sortable/sortable-rows-input.js';
import { isAddedByAddAll, sendsValue } from './send-data-fields.js';

/**
 * The name a field is sent with when it is added: its alias, or its name when it has none, as the server
 * sends a field whose mapping has no name.
 */
function defaultName(field: FormulatePickableField): string {
	return field.alias || field.name || '';
}

/**
 * The fields the Send Data handler sends, [{ id, name }] (FieldMapping): a row for each, in the order they
 * are sent, with the field (its name, its alias under it, its kind's icon) and the name it is sent with.
 * Choose picks fields that send a value in a dialog; Add all fields adds every field that sends a value and
 * is not sent yet. A field that is no longer on the form says so, with its ID, and can be removed. Mappings
 * can be put in order by dragging them or with the keyboard.
 */
@customElement('formulate-field-mappings-input')
export class FormulateFieldMappingsInputElement extends FormulateSortableRowsInputElement {
	/** The form's fields. */
	@property({ attribute: false })
	fields: ReadonlyArray<FormulatePickableField> = [];

	/** The headline of the dialog that picks the fields. */
	@property()
	headline = '';

	#kinds = new FormulateFormFieldKinds(this);

	constructor() {
		super('Formulate.Sorter.FieldMappings');
	}

	/**
	 * Lets the user pick in the dialog. Overridden by tests.
	 * @param data What the dialog shows.
	 * @param selection The IDs of the fields sent now.
	 * @returns The dialog's whole selection, or undefined when it was closed without one.
	 */
	protected pickIds(data: FormulatePickFieldsModalData, selection: Array<string>): Promise<Array<string> | undefined> {
		return pickFormFields(this, data, selection);
	}

	#fieldOf(item: FormulateListItem) {
		return findField(this.fields, readText(item, 'id'));
	}

	/** The fields Add all fields adds: those that send a value and are not sent yet, in the form's order. */
	#fieldsToAdd() {
		if (!this.#kinds.known) {
			return [];
		}

		return this.fields.filter(
			(field) =>
				isAddedByAddAll(field, this.#kinds.of(field)) && !this._rows.some((row) => isSameGuid(readText(row.item, 'id'), field.id)),
		);
	}

	/**
	 * The fields Choose offers: those that send a value, as Add all fields does, and those sent now, so they can
	 * be let go of. Every field until the kinds are known.
	 * @param selection The IDs of the fields sent now.
	 */
	#fieldsToOffer(selection: ReadonlyArray<string>) {
		if (!this.#kinds.known) {
			return this.fields;
		}

		return this.fields.filter((field) => sendsValue(field, this.#kinds.of(field)) || selection.includes(field.id));
	}

	async #choose() {
		// The dialog knows the fields by the form's own IDs, which may be written another way than the stored ones.
		const selection = [
			...new Set(this._rows.map((row) => this.#fieldOf(row.item)?.id).filter((id): id is string => id !== undefined)),
		];
		const picked = await this.pickIds(
			{ headline: this.headline, fields: this.#kinds.pickOptions(this.#fieldsToOffer(selection)) },
			selection,
		);

		if (!picked) {
			return;
		}

		// Those still picked keep their place and name, and a field that is gone stays until it is removed (the
		// dialog does not show it); those just picked follow, in the order they were picked.
		const added = picked
			.filter((id) => !this._rows.some((row) => isSameGuid(readText(row.item, 'id'), id)))
			.map((id) => findField(this.fields, id))
			.filter((field): field is FormulatePickableField => field !== undefined)
			.map((field) => ({ id: field.id, name: defaultName(field) }));

		this.updateItems((item) => {
			const field = this.#fieldOf(item);
			return !field || picked.some((id) => isSameGuid(id, field.id));
		}, added);
	}

	protected override describeItem(item: FormulateListItem) {
		const field = this.#fieldOf(item);
		return field ? this.#kinds.nameOf(field) : '';
	}

	protected override renderItem(row: FormulateListRow, position: number) {
		const field = this.#fieldOf(row.item);
		const name = field ? this.#kinds.nameOf(field) : this.localize.term('formulate_fieldNotFound');
		const icon = this.#kinds.iconOf(field);

		return html`
			<uui-ref-node
				class="field"
				name=${name}
				detail=${field ? (field.alias ?? '') : readText(row.item, 'id')}
				?error=${!field}
				readonly
				standalone>
				${icon ? html`<umb-icon slot="icon" name=${icon}></umb-icon>` : nothing}
			</uui-ref-node>
			<uui-input
				class="field name"
				label=${this.localize.term('formulate_fieldNameSent', field ? name : '', position)}
				.value=${readText(row.item, 'name')}
				?readonly=${this.readonly}
				@input=${(event: Event) => this.changeItem(row.key, { name: String((event.target as HTMLInputElement).value ?? '') })}></uui-input>
		`;
	}

	protected override renderEmpty() {
		return html`<p id="no-fields">${this.localize.term('formulate_noFieldsSent')}</p>`;
	}

	protected override renderAddButtons() {
		const toAdd = this.#fieldsToAdd();

		return html`<div id="buttons">
			<uui-button id="choose" look="placeholder" label=${this.localize.term('general_choose')} @click=${() => this.#choose()}></uui-button>
			<uui-button
				id="add-all"
				look="placeholder"
				label=${this.localize.term('formulate_addAllFields')}
				?disabled=${toAdd.length === 0}
				@click=${() => this.addItems(toAdd.map((field) => ({ id: field.id, name: defaultName(field) })))}></uui-button>
		</div>`;
	}

	static override styles = [
		...FormulateSortableRowsInputElement.styles,
		css`
			#no-fields {
				margin: 0 0 var(--uui-size-space-3);
				color: var(--uui-color-text-alt);
			}
		`,
	];
}

export { FormulateFieldMappingsInputElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-field-mappings-input': FormulateFieldMappingsInputElement;
	}
}
