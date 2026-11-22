import { css, html, nothing, repeat, state, type PropertyValues, type TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import { UmbId } from '@umbraco-cms/backoffice/id';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings } from '../../core/kind-editor.js';

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
 * The drag handle is a button for the keyboard too: the up and down arrow keys move its row, and Enter or
 * Space picks the row up and puts it down, as in other keyboard sortable lists; while it is picked up,
 * Escape puts it back where it was. Each keyboard move is announced to screen readers.
 */
export abstract class FormulateSortableItemsEditorElement extends FormulateKindEditorElementBase {
	@state()
	protected _rows: Array<FormulateItemRow> = [];

	/** The row picked up with the keyboard, if any. */
	@state()
	private _pickedUp?: string;

	/** What the last keyboard move did, for screen readers. */
	@state()
	private _announcement = '';

	/** Where the picked up row was when it was picked up, so Escape can put it back. */
	#pickedUpFrom?: number;

	/** Whether a row is being moved, which takes its handle out of the page for a moment. */
	#moving = false;

	/** The configuration the rows were last made from or stored as, so a stored change is not read back. */
	#rowsValue?: string;

	#sorter: UmbSorterController<FormulateItemRow, HTMLElement>;

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
			this.#putDown();
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
		this.#putDown();
	}

	#store(rows: Array<FormulateItemRow>) {
		const value = { ...readSettings(this.value), items: rows.map((row) => ({ ...row.item })) };
		this._rows = rows;
		this.#rowsValue = JSON.stringify(value);
		this.#sorter.setModel(rows);

		if (this._pickedUp && this.#indexOf(this._pickedUp) < 0) {
			this.#putDown();
		}

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

	/**
	 * Moves a row to another place, keeping the focus on its handle.
	 * @returns Whether the row moved.
	 */
	async #moveTo(key: string, to: number): Promise<boolean> {
		const from = this.#indexOf(key);

		if (from < 0 || to < 0 || to >= this._rows.length || to === from) {
			return false;
		}

		const rows = [...this._rows];
		rows.splice(to, 0, ...rows.splice(from, 1));
		this.#moving = true;

		try {
			this.#store(rows);
			// Moving the row takes it out of the page for a moment, which loses the focus.
			await this.updateComplete;
			(this.shadowRoot?.querySelector(`.row[data-key="${key}"] .handle`) as HTMLElement | null)?.focus();
		} finally {
			this.#moving = false;
		}

		return true;
	}

	async #move(key: string, offset: number) {
		const to = this.#indexOf(key) + offset;

		if (await this.#moveTo(key, to)) {
			this.#announce('formulate_itemMoved', to);
		}
	}

	#pickUpOrPutDown(key: string) {
		const index = this.#indexOf(key);

		if (this.readonly || index < 0) {
			return;
		}

		if (this._pickedUp === key) {
			this.#putDown();
			this.#announce('formulate_itemPutDown', index);
		} else {
			this._pickedUp = key;
			this.#pickedUpFrom = index;
			this.#announce('formulate_itemPickedUp', index);
		}
	}

	#putDown() {
		this._pickedUp = undefined;
		this.#pickedUpFrom = undefined;
	}

	async #putBack(key: string) {
		const to = this.#pickedUpFrom ?? this.#indexOf(key);
		this.#putDown();
		await this.#moveTo(key, to);
		this.#announce('formulate_itemPutBack', to);
	}

	/** Says what a keyboard move did, with the row's place (1 for the first) and the number of rows. */
	#announce(key: string, index: number) {
		this._announcement = this.localize.term(key, index + 1, this._rows.length);
	}

	#onHandleKeydown(event: KeyboardEvent, key: string) {
		switch (event.key) {
			case 'ArrowUp':
			case 'ArrowDown':
				event.preventDefault();
				void this.#move(key, event.key === 'ArrowUp' ? -1 : 1);
				break;
			case 'Enter':
			case ' ':
				// The handle is a button, so these press it.
				event.preventDefault();
				this.#pickUpOrPutDown(key);
				break;
			case 'Escape':
				if (this._pickedUp === key) {
					// It cancels the move only, not a dialog the editor is in.
					event.preventDefault();
					event.stopPropagation();
					void this.#putBack(key);
				}
				break;
		}
	}

	#onHandleFocusOut(key: string) {
		// A row being moved takes its handle out of the page for a moment, which is not leaving it.
		if (!this.#moving && this._pickedUp === key) {
			this.#putDown();
		}
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
								<span id="move-hint" hidden>${this.localize.term('formulate_moveHint')}</span>
								<div id="announcement" role="status">${this._announcement}</div>`}
				</div>
			</umb-property-layout>
		`;
	}

	#renderRow(row: FormulateItemRow, position: number) {
		const name = this.describeItem(row.item);
		const pickedUp = this._pickedUp === row.key;

		return html`
			<div class="row" data-key=${row.key} ?data-readonly=${this.readonly} ?data-picked-up=${pickedUp}>
				${this.readonly
					? nothing
					: html`<span
							class="handle"
							role="button"
							tabindex="0"
							aria-label=${this.localize.term('formulate_moveItem', name, position)}
							aria-describedby="move-hint"
							aria-keyshortcuts="ArrowUp ArrowDown"
							aria-pressed=${pickedUp ? 'true' : 'false'}
							title=${this.localize.term('formulate_moveHint')}
							@click=${() => this.#pickUpOrPutDown(row.key)}
							@keydown=${(event: KeyboardEvent) => this.#onHandleKeydown(event, row.key)}
							@focusout=${() => this.#onHandleFocusOut(row.key)}>
							<uui-icon name="icon-grip"></uui-icon>
						</span>`}
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

			.handle,
			.handle-space {
				flex: 0 0 var(--uui-size-6);
			}

			.handle {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				align-self: stretch;
				border-radius: var(--uui-border-radius);
				cursor: grab;
			}

			.handle:active {
				cursor: grabbing;
			}

			.handle:focus-visible {
				outline: 2px solid var(--uui-color-focus);
			}

			/* A row picked up with the keyboard, as a selected item looks. */
			.row[data-picked-up] .handle {
				background-color: var(--uui-color-selected);
				color: var(--uui-color-selected-contrast);
			}

			/* For screen readers only. */
			#announcement {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
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

			/* Where a dragged row goes, as Umbraco's sortable lists show it. */
			.row[drag-placeholder] {
				position: relative;
			}

			.row[drag-placeholder] > * {
				visibility: hidden;
			}

			.row[drag-placeholder]::after {
				content: '';
				position: absolute;
				inset: 0;
				border-radius: var(--uui-border-radius);
				border: 1px dashed var(--uui-color-divider-emphasis);
			}
		`,
	];
}
