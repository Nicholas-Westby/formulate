import { css, customElement, html, nothing, state, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { UmbId } from '@umbraco-cms/backoffice/id';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type { FormFieldModel } from '../../../api/index.js';
import { FormulateKindEditorElementBase, readSettings } from '../../../core/kind-editor.js';
import { findField, FormulateFormFieldKinds } from '../../../core/pickers/form-field-kinds.js';
import { FormulateKeyboardSorter, FORMULATE_SORTABLE_STYLES } from '../../../core/sortable/keyboard-sorter.js';
import './basic-layout-cell.element.js';
import type {
	FormulateBasicLayoutDesigner,
	FormulateLayoutCellView,
	FormulateLayoutFieldView,
	FormulateLayoutRowView,
} from './basic-layout-designer.js';
import './basic-layout-rows.element.js';
import {
	addRow,
	addStepAfter,
	cellColumnSpan,
	deleteRow,
	deleteStep,
	moveField,
	moveRow,
	noSplitPoints,
	normalize,
	readLayout,
	splitPointsToCells,
	stepNumbers,
	toggleSplitPoint,
	unusedFields,
	UNUSED,
	type FormulateBasicLayout,
	type FormulateFieldPlace,
} from './basic-layout.model.js';

/** Where a field is in the designer, by its key. */
interface FormulateFieldWhere {
	id: string;
	place: FormulateFieldPlace;
	/** Its place in its cell, 0 for the first. */
	index: number;
}

/** The layout as the designer shows it. */
interface FormulateLayoutView {
	rows: Array<FormulateLayoutRowView>;
	unused: Array<FormulateLayoutFieldView>;
	/** Where each field is, by its key. */
	places: Map<string, FormulateFieldWhere>;
	/**
	 * The fields from the top of the designer to the bottom, as the keyboard moves them: each cell's marker,
	 * then its fields, and at the end the marker of the unused fields, then those fields.
	 */
	order: Array<string>;
}

/** The marker of the unused fields in a view's order. */
const UNUSED_MARKER = 'unused';

function cellMarker(row: number, cell: number) {
	return `cell:${row}:${cell}`;
}

/** The place a marker of a view's order stands for; undefined for a field's key. */
function placeOfMarker(key: string): FormulateFieldPlace | undefined {
	if (key === UNUSED_MARKER) {
		return UNUSED;
	}

	const match = /^cell:(\d+):(\d+)$/.exec(key);
	return match ? { row: Number(match[1]), cell: Number(match[2]) } : undefined;
}

/**
 * The editor of the Basic layout kind (formulate-layout-basic), the grid designer of Formulate 3 and 4. It
 * edits BasicLayoutConfiguration: { autoPopulate, rows: [{ isStep, cells: [{ columnSpan, fields: [{ id }] }] }] }.
 *
 * - Auto Populate on lays out the form's fields by themselves; the designer is hidden, and its rows stay.
 * - Otherwise the designer shows the rows, each cell as wide as its columns, with its fields; the step
 *   dividers, numbered as the site shows the steps; a row to add, whose cells are made by splitting its 12
 *   columns; and the form's fields that are in no row (the unused fields).
 * - Fields are dragged between the cells and the unused fields, rows up and down, and both are moved with
 *   the keyboard too.
 * - A field placed in the layout that is no longer on the form shows as not found, and can be removed.
 *
 * The layout is stored as it is until the user changes it: showing it stores nothing, and a layout without
 * rows shows one empty row of 12 columns without storing it. Each change stores the layout without the
 * fields that are no longer on the form, keeping whatever else it has. Without the form's fields (its
 * context), nothing is shown that could drop them.
 */
@customElement('formulate-basic-layout-editor')
export class FormulateBasicLayoutEditorElement extends FormulateKindEditorElementBase {
	/** The layout as it is shown, with the fields that are no longer on the form. */
	@state()
	private _layout: FormulateBasicLayout = readLayout(undefined);

	/** Where the cells of the row to add start. */
	@state()
	private _splitPoints: Array<boolean> = noSplitPoints();

	/** A key for each of the shown layout's rows, which stays with the row as it moves. */
	#rowKeys: Array<string> = [];

	/** The value the layout was shown from, as JSON: the editor's own value comes back to it unchanged. */
	#valueJson?: string;

	#kinds = new FormulateFormFieldKinds(this);

	#rowKeyboard = new FormulateKeyboardSorter(this, {
		getKeys: () => this.#rowKeys,
		move: (key, to) => this.#moveRow(this.#rowKeys.indexOf(key), to),
		getHandle: (key) => this.#rowsElement()?.shadowRoot?.querySelector<HTMLElement>(`#rows > .row[data-key="${key}"] > .handle`),
		isReadonly: () => this.readonly,
	});

	#fieldKeyboard = new FormulateKeyboardSorter(this, {
		getKeys: () => this.#view().order,
		move: (key, to) => this.#moveFieldInOrder(key, to),
		getHandle: (key) => this.#fieldHandle(key),
		isReadonly: () => this.readonly,
		describePlace: (key) => this.#describePlace(key),
	});

	#designer: FormulateBasicLayoutDesigner = {
		moveRow: (from, to) => this.#moveRow(from, to),
		deleteRow: (index) => this.#changeRows(deleteRow(this._layout, index), index, -1),
		addStepAfter: (index) => this.#changeRows(addStepAfter(this._layout, index), index + 1, 1),
		deleteStep: (index) => this.#changeRows(deleteStep(this._layout, index), index, -1),
		moveField: (key, to, index) => this.#moveField(key, to, index),
		removeField: (key) => this.#moveField(key, UNUSED, 0),
		renderRowHandle: (key, label) => this.#rowKeyboard.renderHandle(key, label),
		renderRowStatus: () => this.#rowKeyboard.renderStatus(),
		renderFieldHandle: (key, label) => this.#fieldKeyboard.renderHandle(key, label),
	};

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed);

		if (changed.has('value') || this.#valueJson === undefined) {
			this.#readValue();
		}

		if (changed.has('readonly') && this.readonly) {
			this.#rowKeyboard.putDown();
			this.#fieldKeyboard.putDown();
		}
	}

	/** Done once the rows and cells have shown the layout too, so the keyboard can keep the focus on what moved. */
	protected override async getUpdateComplete(): Promise<boolean> {
		const result = await super.getUpdateComplete();
		const parts = [this.#rowsElement(), ...(this.shadowRoot?.querySelectorAll('formulate-basic-layout-cell') ?? [])];
		await Promise.all(parts.map((part) => part?.updateComplete));

		return result;
	}

	#readValue() {
		const json = JSON.stringify(this.value ?? null);

		// The layout this editor stored comes back to it: its rows keep their keys, and so their focus.
		if (json === this.#valueJson) {
			return;
		}

		this.#valueJson = json;
		this._layout = readLayout(this.value);
		this.#rowKeys = this._layout.rows.map(() => UmbId.new());
		this.#rowKeyboard.putDown();
		this.#fieldKeyboard.putDown();
	}

	/** The form's fields, or undefined when the editor was not given them. */
	#formFields(): ReadonlyArray<FormFieldModel> | undefined {
		return this.context?.formFields;
	}

	#rowsElement() {
		return this.shadowRoot?.querySelector('formulate-basic-layout-rows');
	}

	/**
	 * Stores a changed layout, without the fields that are no longer on the form. A change that leaves the
	 * layout as it was stores nothing.
	 * @param layout The changed layout.
	 * @param rowKeys The keys of its rows.
	 */
	#change(layout: FormulateBasicLayout, rowKeys: Array<string>) {
		this.#rowKeys = rowKeys;

		if (JSON.stringify(layout) === JSON.stringify(this._layout)) {
			// Such as two empty rows swapping places: the rows show in their new places all the same.
			this.requestUpdate();
			return;
		}

		const value = normalize(layout, { fields: this.#formFields() ?? [] });
		this._layout = value;
		this.#valueJson = JSON.stringify(value);
		this.#rowKeyboard.putDownIfGone();
		this.#fieldKeyboard.putDownIfGone();
		this.updateValue(value);
	}

	/**
	 * Stores a layout with a row more or less, or the same number of rows (such as the only row, emptied).
	 * @param layout The changed layout.
	 * @param index Where the row was added or deleted.
	 * @param added 1 for a row added, -1 for a row deleted.
	 */
	#changeRows(layout: FormulateBasicLayout, index: number, added: 1 | -1) {
		const keys = [...this.#rowKeys];

		if (layout.rows.length === keys.length + added) {
			if (added === 1) {
				keys.splice(index, 0, UmbId.new());
			} else {
				keys.splice(index, 1);
			}
		}

		this.#change(layout, keys);
	}

	#moveRow(from: number, to: number) {
		const layout = moveRow(this._layout, from, to);

		if (layout === this._layout) {
			return false;
		}

		const keys = [...this.#rowKeys];
		keys.splice(to, 0, ...keys.splice(from, 1));
		this.#change(layout, keys);
		return true;
	}

	#moveField(key: string, to: FormulateFieldPlace, index: number) {
		const where = this.#view().places.get(key);

		if (where) {
			this.#change(moveField(this._layout, where.id, where.place, to, index), this.#rowKeys);
		}
	}

	/**
	 * Moves a field with the keyboard to a place in the designer's order of fields: into the cell whose marker
	 * comes before that place. The unused fields keep the order of the form, so up from any of them goes to
	 * the end of the last cell, and down goes nowhere. A place above the unused fields, such as where Escape
	 * puts a field back, is kept.
	 * @returns False when the field cannot go there, such as above the first cell.
	 */
	#moveFieldInOrder(key: string, to: number): boolean {
		const { order, places } = this.#view();
		const where = places.get(key);

		if (!where) {
			return false;
		}

		const rest = order.filter((each) => each !== key);
		let at = to;

		if (where.place === UNUSED) {
			if (to > order.indexOf(key)) {
				return false;
			}

			if (to >= order.indexOf(UNUSED_MARKER)) {
				at = rest.indexOf(UNUSED_MARKER);
			}
		}

		let markerAt = at - 1;
		while (markerAt >= 0 && placeOfMarker(rest[markerAt]) === undefined) {
			markerAt--;
		}

		const place = markerAt >= 0 ? placeOfMarker(rest[markerAt]) : undefined;

		if (!place || (place === UNUSED && where.place === UNUSED)) {
			return false;
		}

		this.#moveField(key, place, at - markerAt - 1);
		return true;
	}

	/** Where a field is, as the keyboard announces it, such as "row 2, cell 1, place 1 of 3". */
	#describePlace(key: string): string {
		const view = this.#view();
		const where = view.places.get(key);
		const row = where && where.place !== UNUSED ? view.rows[where.place.row] : undefined;

		if (!where || where.place === UNUSED || row?.kind !== 'row') {
			return this.localize.term('formulate_unusedFieldsPlace');
		}

		const cell = row.cells[where.place.cell];

		return this.localize.term('formulate_layoutCellPlace', row.position, where.place.cell + 1, where.index + 1, cell?.fields.length ?? 0);
	}

	#fieldHandle(key: string): HTMLElement | undefined {
		const cells = [
			...(this.shadowRoot?.querySelectorAll('formulate-basic-layout-cell') ?? []),
			...(this.#rowsElement()?.shadowRoot?.querySelectorAll('formulate-basic-layout-cell') ?? []),
		];

		for (const cell of cells) {
			const handle = cell.shadowRoot?.querySelector<HTMLElement>(`.field[data-key="${key}"] .handle`);

			if (handle) {
				return handle;
			}
		}

		return undefined;
	}

	/** The layout as the designer shows it, with a key for each field that no other field of it has. */
	#view(): FormulateLayoutView {
		const fields = this.#formFields() ?? [];
		const steps = stepNumbers(this._layout.rows);
		const counts = new Map<string, number>();
		const places = new Map<string, FormulateFieldWhere>();
		const order: Array<string> = [];
		let position = 0;

		const keyOf = (id: string) => {
			const digits = id.replace(/[{}()-]/g, '').toLowerCase();
			const count = (counts.get(digits) ?? 0) + 1;
			counts.set(digits, count);
			return count === 1 ? digits : `${digits}~${count}`;
		};

		const rows = this._layout.rows.map((row, index): FormulateLayoutRowView => {
			const key = this.#rowKeys[index] ?? `row-${index}`;

			if (row.isStep) {
				return { kind: 'step', key, index, step: steps[index] };
			}

			position++;

			const cells = row.cells.map((cell, cellIndex): FormulateLayoutCellView => {
				const place = { row: index, cell: cellIndex };
				order.push(cellMarker(index, cellIndex));

				return {
					place,
					columns: cellColumnSpan(row, cell),
					fields: cell.fields.map((entry, fieldIndex) => {
						const fieldKey = keyOf(entry.id);
						places.set(fieldKey, { id: entry.id, place, index: fieldIndex });
						order.push(fieldKey);
						return this.#fieldView(fieldKey, entry.id, findField(fields, entry.id));
					}),
				};
			});

			return { kind: 'row', key, index, position, cells };
		});

		order.push(UNUSED_MARKER);

		const unused = unusedFields({ fields }, this._layout.rows).map((field, index) => {
			const fieldKey = keyOf(field.id);
			places.set(fieldKey, { id: field.id, place: UNUSED, index });
			order.push(fieldKey);
			return this.#fieldView(fieldKey, field.id, field);
		});

		return { rows, unused, places, order };
	}

	#fieldView(key: string, id: string, field: FormFieldModel | undefined): FormulateLayoutFieldView {
		return field
			? { key, id, name: this.#kinds.nameOf(field), alias: field.alias ?? '', icon: this.#kinds.iconOf(field), missing: false }
			: { key, id, name: this.localize.term('formulate_fieldNotFound'), alias: '', icon: this.#kinds.iconOf(undefined), missing: true };
	}

	/** Turns Auto Populate on or off, keeping the rows as they are stored, or storing no rows when there are none. */
	#setAutoPopulate(autoPopulate: boolean) {
		if (this.readonly || autoPopulate === this._layout.autoPopulate) {
			return;
		}

		const settings = readSettings(this.value);
		const value = { ...settings, autoPopulate, ...(Array.isArray(settings.rows) ? {} : { rows: [] }) };
		this._layout = readLayout(value);
		this.#valueJson = JSON.stringify(value);
		this.updateValue(value);
	}

	override render() {
		if (!this.#formFields()) {
			return html`<p id="fields-unknown">${this.localize.term('formulate_layoutFieldsUnknown')}</p>`;
		}

		return html`
			<umb-property-layout label=${this.localize.term('formulate_autoPopulate')} description=${this.localize.term('formulate_autoPopulateDescription')}>
				<!-- Named for screen readers only: the label beside it says the same, as Umbraco's toggles do. -->
				<uui-toggle
					slot="editor"
					id="auto-populate"
					aria-label=${this.localize.term('formulate_autoPopulate')}
					.checked=${this._layout.autoPopulate}
					?readonly=${this.readonly}
					@change=${(event: Event) => this.#setAutoPopulate((event.target as HTMLInputElement).checked)}></uui-toggle>
			</umb-property-layout>
			${this._layout.autoPopulate ? this.#renderAutoPopulated() : this.#renderDesigner()}
		`;
	}

	#renderAutoPopulated() {
		return html`
			<div id="auto-populated" class="uui-text">
				<h4>${this.localize.term('formulate_autoPopulated')}</h4>
				<p>${this.localize.term('formulate_autoPopulatedDescription')}</p>
			</div>
		`;
	}

	#renderDesigner() {
		const view = this.#view();

		return html`
			<section id="rows-section">
				${this.#renderHeading('formulate_layoutRows', 'formulate_layoutRowsDescription')}
				<formulate-basic-layout-rows
					.designer=${this.#designer}
					.rows=${view.rows}
					.pickedUpRow=${this.#rowKeyboard.pickedUp}
					.pickedUpField=${this.#fieldKeyboard.pickedUp}
					?readonly=${this.readonly}></formulate-basic-layout-rows>
			</section>
			<section id="unused-section">
				${this.#renderHeading('formulate_unusedFields', 'formulate_unusedFieldsDescription')}
				<formulate-basic-layout-cell
					id="unused"
					unused
					aria-label=${this.localize.term('formulate_unusedFields')}
					.designer=${this.#designer}
					.place=${UNUSED}
					.fields=${view.unused}
					.pickedUp=${this.#fieldKeyboard.pickedUp}
					.empty=${this.localize.term('formulate_allFieldsUsed')}
					?readonly=${this.readonly}></formulate-basic-layout-cell>
			</section>
			${this.readonly ? nothing : this.#renderAddRow()}
			${this.readonly ? nothing : this.#fieldKeyboard.renderStatus()}
		`;
	}

	#renderHeading(headline: string, description: string) {
		return html`
			<h4 class="headline">${this.localize.term(headline)}</h4>
			<p class="description">${this.localize.term(description)}</p>
		`;
	}

	#renderAddRow() {
		const widths = splitPointsToCells(this._splitPoints).map((cell) => cell.columnSpan);
		const starts = this._splitPoints.map((split, column) => column === 0 || split);

		return html`
			<section id="add-row-section">
				${this.#renderHeading('formulate_addRowHeadline', 'formulate_addRowDescription')}
				<div id="split-points" role="group" aria-label=${this.localize.term('formulate_addRowHeadline')}>
					${this._splitPoints.map(
						(_, column) => html`
							<button
								type="button"
								class="column"
								?data-start=${starts[column]}
								?data-end=${column === starts.length - 1 || starts[column + 1]}
								aria-pressed=${starts[column] ? 'true' : 'false'}
								aria-label=${this.localize.term('formulate_splitAtColumn', column + 1)}
								?disabled=${column === 0}
								@click=${() => (this._splitPoints = toggleSplitPoint(this._splitPoints, column))}>
								${column + 1}
							</button>
						`,
					)}
				</div>
				<p id="new-row-cells" aria-live="polite">${this.localize.term('formulate_newRowCells', widths)}</p>
				<uui-button
					id="add-row"
					look="placeholder"
					label=${this.localize.term('formulate_addRow')}
					@click=${() => this.#changeRows(addRow(this._layout, this._splitPoints), this._layout.rows.length, 1)}></uui-button>
			</section>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SORTABLE_STYLES,
		css`
			:host {
				display: block;
			}

			section {
				margin-top: var(--uui-size-layout-1);
			}

			.headline {
				margin: 0 0 var(--uui-size-space-1);
			}

			.description {
				margin: 0 0 var(--uui-size-space-4);
				color: var(--uui-color-text-alt);
			}

			#auto-populated {
				margin-top: var(--uui-size-layout-1);
				padding: var(--uui-size-layout-1);
				border: 1px dashed var(--uui-color-border-emphasis);
				border-radius: var(--uui-border-radius);
				text-align: center;
			}

			#auto-populated h4 {
				margin-top: 0;
			}

			#auto-populated p {
				margin-bottom: 0;
				color: var(--uui-color-text-alt);
			}

			#split-points {
				display: grid;
				grid-template-columns: repeat(12, minmax(0, 1fr));
			}

			.column {
				min-height: var(--uui-size-10);
				margin: 0;
				border: 1px solid var(--uui-color-border-emphasis);
				border-inline-width: 0;
				background-color: var(--uui-color-surface-alt);
				color: var(--uui-color-text-alt);
				font: inherit;
				font-size: var(--uui-type-small-size);
				cursor: pointer;
			}

			.column:not([disabled]):hover {
				background-color: var(--uui-color-surface-emphasis);
				color: var(--uui-color-interactive-emphasis);
			}

			.column[disabled] {
				cursor: default;
			}

			.column:focus-visible {
				position: relative;
				outline: 2px solid var(--uui-color-focus);
			}

			/* Each cell of the row to add is one block, with a gap where the next one starts. */
			.column[data-start] {
				border-inline-start-width: 1px;
				border-start-start-radius: var(--uui-border-radius);
				border-end-start-radius: var(--uui-border-radius);
			}

			.column[data-start]:not(:first-child) {
				margin-inline-start: var(--uui-size-space-2);
			}

			.column[data-end] {
				border-inline-end-width: 1px;
				border-start-end-radius: var(--uui-border-radius);
				border-end-end-radius: var(--uui-border-radius);
			}

			#new-row-cells {
				margin: var(--uui-size-space-3) 0;
				color: var(--uui-color-text-alt);
			}

			#add-row {
				display: block;
			}
		`,
	];
}

export { FormulateBasicLayoutEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-basic-layout-editor': FormulateBasicLayoutEditorElement;
	}
}
