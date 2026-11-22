import { css, html, nothing, repeat, state, type PropertyValues, type TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import { UmbId } from '@umbraco-cms/backoffice/id';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings } from '../../core/kind-editor.js';
import { FORMULATE_SORTABLE_STYLES, FormulateKeyboardSorter } from '../../core/sortable/keyboard-sorter.js';

/** An item of the list as the editor shows it: the stored item, with a key of its own for the row. */
export interface FormulateItemRow {
	key: string;
	item: Readonly<Record<string, unknown>>;
}

/** The items of a configuration, as stored objects. */
function readItems(value: unknown): Array<Readonly<Record<string, unknown>>> {
	const items = readSettings(value).items;

	return Array.isArray(items) ? items.map((item) => readSettings(item)) : [];
}

/**
 * A kind editor for a configuration of the shape { items: [...] }: a sortable list of rows, each with a drag
 * handle, the item's inputs and a remove button, and an Add button, as Umbraco's multiple text string input
 * has them. Each change stores the whole configuration again, keeping the settings and item fields the
 * editor does not edit.
 *
 * The drag handle is a button for the keyboard too (see FormulateKeyboardSorter).
 */
export abstract class FormulateSortableItemsEditorElement extends FormulateKindEditorElementBase {
	@state()
	protected _rows: Array<FormulateItemRow> = [];

	/** The configuration the rows were last made from or stored as, so a stored change is not read back. */
	#rowsValue?: string;

	#sorter: UmbSorterController<FormulateItemRow, HTMLElement>;

	#keyboard = new FormulateKeyboardSorter(this, {
		getKeys: () => this._rows.map((row) => row.key),
		move: (key, to) => {
			const rows = [...this._rows];
			rows.splice(to, 0, ...rows.splice(this.#indexOf(key), 1));
			this.#store(rows);
		},
		getHandle: (key) => this.shadowRoot?.querySelector<HTMLElement>(`.row[data-key="${key}"] .handle`),
		isReadonly: () => this.readonly,
	});

	/**
	 * @param sorterIdentifier Only rows of lists with the same identifier can be dragged between them.
	 */
	constructor(sorterIdentifier: string) {
		super();

		this.#sorter = new UmbSorterController<FormulateItemRow, HTMLElement>(this, {
			getUniqueOfElement: (element) => element.dataset.key,
			getUniqueOfModel: (row) => row.key,
			identifier: sorterIdentifier,
			itemSelector: '.row',
			containerSelector: '#rows',
			handleSelector: '.handle',
			disabledItemSelector: '[data-readonly]',
			onChange: ({ model }) => {
				if (!this.readonly) {
					this.#store(model);
				}
			},
		});
	}

	/** A new, empty item, as Add makes it. */
	protected abstract newItem(): Record<string, unknown>;

	/** The inputs of an item. */
	protected abstract renderItem(row: FormulateItemRow, position: number): TemplateResult;

	/** What shows above the rows, such as column headers. */
	protected renderHeaders(): TemplateResult | typeof nothing {
		return nothing;
	}

	/** A short text for an item, for the labels of its buttons. */
	protected abstract describeItem(item: Readonly<Record<string, unknown>>): string;

	/** The localization key of the description of the items. */
	protected abstract readonly itemsDescriptionKey: string;

	/**
	 * Stores new values for fields of an item, keeping its other fields.
	 * @param key The item's row.
	 * @param fields The fields that change.
	 */
	protected changeItem(key: string, fields: Record<string, unknown>) {
		this.#store(this._rows.map((row) => (row.key === key ? { key, item: { ...row.item, ...fields } } : row)));
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed);

		if (changed.has('value')) {
			this.#readRows();
		}

		if (changed.has('readonly') && this.readonly) {
			this.#keyboard.putDown();
		}
	}

	#readRows() {
		const value = JSON.stringify(this.value ?? null);

		// The configuration this editor stored comes back to it: its rows, and so its focus, stay.
		if (value === this.#rowsValue) {
			return;
		}

		this.#rowsValue = value;
		this._rows = readItems(this.value).map((item) => ({ key: UmbId.new(), item }));
		this.#sorter.setModel(this._rows);
		this.#keyboard.putDown();
	}

	#store(rows: Array<FormulateItemRow>) {
		const value = { ...readSettings(this.value), items: rows.map((row) => ({ ...row.item })) };
		this._rows = rows;
		this.#rowsValue = JSON.stringify(value);
		this.#sorter.setModel(rows);
		this.#keyboard.putDownIfGone();
		this.updateValue(value);
	}

	#add() {
		this.#store([...this._rows, { key: UmbId.new(), item: this.newItem() }]);
	}

	#remove(key: string) {
		this.#store(this._rows.filter((row) => row.key !== key));
	}

	#indexOf(key: string) {
		return this._rows.findIndex((row) => row.key === key);
	}

	override render() {
		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_items')}
				description=${this.localize.term(this.itemsDescriptionKey)}>
				<div slot="editor">
					${this._rows.length ? this.renderHeaders() : nothing}
					<div id="rows">${repeat(this._rows, (row) => row.key, (row, index) => this.#renderRow(row, index + 1))}</div>
					${this.readonly
						? nothing
						: html`<uui-button
									id="add"
									look="placeholder"
									label=${this.localize.term('general_add')}
									@click=${this.#add}></uui-button>
								${this.#keyboard.renderStatus()}`}
				</div>
			</umb-property-layout>
		`;
	}

	#renderRow(row: FormulateItemRow, position: number) {
		const name = this.describeItem(row.item);
		const pickedUp = this.#keyboard.pickedUp === row.key;

		return html`
			<div class="row" data-key=${row.key} ?data-readonly=${this.readonly} ?data-picked-up=${pickedUp}>
				${this.readonly
					? nothing
					: this.#keyboard.renderHandle(row.key, this.localize.term('formulate_moveItem', name, position))}
				${this.renderItem(row, position)}
				${this.readonly
					? nothing
					: html`<uui-button
							class="remove"
							compact
							look="outline"
							label=${this.localize.term('formulate_removeItem', name, position)}
							@click=${() => this.#remove(row.key)}>
							<uui-icon name="icon-trash"></uui-icon>
						</uui-button>`}
			</div>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SORTABLE_STYLES,
		css`
			:host {
				display: block;
			}

			#headers,
			.row {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-3);
			}

			#headers {
				margin-bottom: var(--uui-size-space-2);
				font-weight: bold;
			}

			.row {
				margin-bottom: var(--uui-size-space-3);
			}

			.handle-space {
				flex: 0 0 var(--uui-size-6);
			}

			.remove,
			.remove-space {
				flex: 0 0 var(--uui-size-11);
			}

			.field {
				flex: 1 1 0;
				min-width: 0;
			}

			uui-input.field {
				width: 100%;
			}

			#add {
				display: block;
			}
		`,
	];
}
