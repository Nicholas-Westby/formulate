import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { css, html, nothing, property, repeat, state, type PropertyValues, type TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import { UmbId } from '@umbraco-cms/backoffice/id';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { readSettings } from '../kind-editor.js';
import { FORMULATE_SORTABLE_STYLES, FormulateKeyboardSorter } from './keyboard-sorter.js';

/** An item of the list, as it is stored. */
export type FormulateListItem = Readonly<Record<string, unknown>>;

/** A row of the list: the stored item, with a key of its own. */
export interface FormulateListRow {
	key: string;
	item: FormulateListItem;
}

/**
 * The items of a list setting, as stored objects: none when the setting is not a list.
 * @param value The setting, such as a configuration's recipients.
 */
export function readItems(value: unknown): Array<FormulateListItem> {
	return Array.isArray(value) ? value.map((item) => readSettings(item)) : [];
}

/**
 * An input of an ordered list of objects, such as the recipients of an email: a row for each, with a drag
 * handle (a button for the keyboard too, see FormulateKeyboardSorter), the item's own inputs and a Remove
 * button, as Umbraco's multiple text string input has them. The value is the list, each item exactly as
 * stored; each change stores the whole list again, keeping what an item has that the input does not edit,
 * and dispatches an UmbChangeEvent.
 */
export abstract class FormulateSortableRowsInputElement extends UmbLitElement {
	/** The items, as they are stored. */
	@property({ attribute: false })
	value: ReadonlyArray<FormulateListItem> = [];

	/** Whether nothing may be changed. */
	@property({ type: Boolean, reflect: true })
	readonly = false;

	@state()
	protected _rows: Array<FormulateListRow> = [];

	/** The items the rows were last made from or stored as, so a stored change is not read back. */
	#rowsValue?: string;

	#sorter: UmbSorterController<FormulateListRow, HTMLElement>;

	#keyboard = new FormulateKeyboardSorter(this, {
		getKeys: () => this._rows.map((row) => row.key),
		move: (key, to) => {
			const rows = [...this._rows];
			rows.splice(to, 0, ...rows.splice(rows.findIndex((row) => row.key === key), 1));
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

		this.#sorter = new UmbSorterController<FormulateListRow, HTMLElement>(this, {
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

	/** The inputs of an item. */
	protected abstract renderItem(row: FormulateListRow, position: number): TemplateResult;

	/** What an item is called in the labels of its buttons, such as "Email address 2"; '' for "item 2". */
	protected abstract describeItem(item: FormulateListItem, position: number): string;

	/** The buttons that add items, under the rows. */
	protected abstract renderAddButtons(): TemplateResult;

	/** What shows under the rows when there are none, such as what that means. */
	protected renderEmpty(): TemplateResult | typeof nothing {
		return nothing;
	}

	/**
	 * Stores new values for fields of an item, keeping its other fields.
	 * @param key The item's row.
	 * @param fields The fields that change.
	 */
	protected changeItem(key: string, fields: Record<string, unknown>) {
		this.#store(this._rows.map((row) => (row.key === key ? { key, item: { ...row.item, ...fields } } : row)));
	}

	/** Stores new items after the others. */
	protected addItems(items: ReadonlyArray<FormulateListItem>) {
		if (items.length) {
			this.#store([...this._rows, ...items.map((item) => ({ key: UmbId.new(), item }))]);
		}
	}

	/** Stores the list with the items that pass, in their order. */
	protected keepItems(keep: (item: FormulateListItem) => boolean) {
		const rows = this._rows.filter((row) => keep(row.item));

		if (rows.length !== this._rows.length) {
			this.#store(rows);
		}
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
		const value = JSON.stringify(this.value ?? []);

		// The items this input stored come back to it: its rows, and so its focus, stay.
		if (value === this.#rowsValue) {
			return;
		}

		this.#rowsValue = value;
		this._rows = readItems(this.value).map((item) => ({ key: UmbId.new(), item }));
		this.#sorter.setModel(this._rows);
		this.#keyboard.putDown();
	}

	#store(rows: Array<FormulateListRow>) {
		const value = rows.map((row) => ({ ...row.item }));
		this._rows = rows;
		this.#rowsValue = JSON.stringify(value);
		this.#sorter.setModel(rows);
		this.#keyboard.putDownIfGone();
		this.value = value;
		this.dispatchEvent(new UmbChangeEvent());
	}

	override render() {
		return html`
			<div id="rows">${repeat(this._rows, (row) => row.key, (row, index) => this.#renderRow(row, index + 1))}</div>
			${this._rows.length ? nothing : this.renderEmpty()}
			${this.readonly ? nothing : html`${this.renderAddButtons()} ${this.#keyboard.renderStatus()}`}
		`;
	}

	#renderRow(row: FormulateListRow, position: number) {
		const name = this.describeItem(row.item, position);
		const pickedUp = this.#keyboard.pickedUp === row.key;

		return html`
			<div class="row" data-key=${row.key} ?data-readonly=${this.readonly} ?data-picked-up=${pickedUp}>
				${this.readonly ? nothing : this.#keyboard.renderHandle(row.key, this.localize.term('formulate_moveItem', name, position))}
				${this.renderItem(row, position)}
				${this.readonly
					? nothing
					: html`<uui-button
							class="remove"
							compact
							look="outline"
							label=${this.localize.term('formulate_removeItem', name, position)}
							@click=${() => this.#store(this._rows.filter((candidate) => candidate.key !== row.key))}>
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

			.row {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-3);
				margin-bottom: var(--uui-size-space-3);
			}

			.remove {
				flex: 0 0 var(--uui-size-11);
			}

			.field {
				flex: 1 1 0;
				min-width: 0;
			}

			uui-input.field {
				width: 100%;
			}

			#buttons {
				display: flex;
				gap: var(--uui-size-space-3);
			}

			#buttons > uui-button {
				flex: 1 1 0;
			}
		`,
	];
}
