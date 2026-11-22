import { isSameGuid } from '../../../core/guid.js';
import { readSettings } from '../../../core/kind-editor.js';

// The configuration of a Basic layout, as the server stores it (BasicLayoutConfiguration and its row, cell
// and field classes in Formulate.Core.Layouts.Basic), and the changes the designer makes to it:
//
//   { autoPopulate, rows: [{ isStep, cells: [{ columnSpan, fields: [{ id }] }] }] }
//
// Each function makes a new configuration and leaves the one it is given as it is. What else a layout,
// row, cell or field has stored (such as by a newer version) is kept, in its place.

/** The columns of a row. */
export const FORMULATE_LAYOUT_COLUMNS = 12;

/** A field placed in a cell: its ID, as it is stored. */
export type FormulateLayoutField = Readonly<{ id: string } & Record<string, unknown>>;

/** A cell of a row: how many of the row's 12 columns it spans, and its fields from top to bottom. */
export type FormulateLayoutCell = Readonly<{ columnSpan: number; fields: ReadonlyArray<FormulateLayoutField> } & Record<string, unknown>>;

/** A row of cells, or a step divider (isStep, with no cells), which starts a new step of the form. */
export type FormulateLayoutRow = Readonly<{ isStep: boolean; cells: ReadonlyArray<FormulateLayoutCell> } & Record<string, unknown>>;

/** A Basic layout: whether the form's fields are laid out by themselves, and the rows otherwise. */
export type FormulateBasicLayout = Readonly<{ autoPopulate: boolean; rows: ReadonlyArray<FormulateLayoutRow> } & Record<string, unknown>>;

/** The form a layout lays out: its fields, in their order. */
export interface FormulateLayoutForm<Field extends { id: string } = { id: string }> {
	readonly fields: ReadonlyArray<Field>;
}

/** A cell: its row and its place in the row, 0 for the first of each. */
export interface FormulateCellPlace {
	readonly row: number;
	readonly cell: number;
}

/** The fields of the form that are in no row. */
export const UNUSED = 'unused';

/** Where a field is: in a cell, or unused. */
export type FormulateFieldPlace = FormulateCellPlace | typeof UNUSED;

/** The split points of the row to add: none, so one cell of 12 columns. */
export function noSplitPoints(): Array<boolean> {
	return new Array<boolean>(FORMULATE_LAYOUT_COLUMNS).fill(false);
}

/**
 * The cells of a row whose cells start at the split points, as Formulate 3 and 4 made them: each cell spans
 * the columns up to the next split point. A cell cannot start before the first column, so the first column
 * is never a split point.
 * @param splitPoints For each of the 12 columns, whether a cell starts at it.
 * @returns The cells' widths, which add up to 12.
 */
export function splitPointsToCells(splitPoints: ReadonlyArray<boolean>): Array<{ columnSpan: number }> {
	const cells: Array<{ columnSpan: number }> = [];
	let columnSpan = 1;

	for (let column = 1; column < FORMULATE_LAYOUT_COLUMNS; column++) {
		if (splitPoints[column] === true) {
			cells.push({ columnSpan });
			columnSpan = 0;
		}

		columnSpan++;
	}

	cells.push({ columnSpan });

	return cells;
}

/**
 * Splits or joins the cells at a column.
 * @param splitPoints For each of the 12 columns, whether a cell starts at it.
 * @param column The column, 0 for the first, which cannot be a split point.
 * @returns The new split points.
 */
export function toggleSplitPoint(splitPoints: ReadonlyArray<boolean>, column: number): Array<boolean> {
	return noSplitPoints().map((_, each) => (each === column && column > 0 ? !splitPoints[each] : splitPoints[each] === true));
}

/**
 * The width a cell shows with: the columns it spans, or, when it has no width of 1 to 12 stored (such as some
 * of Formulate 3's), its share of the row's 12 columns, as Formulate 3 showed it.
 * @param row The cell's row.
 * @param cell The cell.
 */
export function cellColumnSpan(row: FormulateLayoutRow, cell: FormulateLayoutCell): number {
	const span = cell.columnSpan;

	if (Number.isInteger(span) && span >= 1 && span <= FORMULATE_LAYOUT_COLUMNS) {
		return span;
	}

	return Math.max(1, Math.floor(FORMULATE_LAYOUT_COLUMNS / Math.max(1, row.cells.length)));
}

/** A row of one empty cell of 12 columns. */
function emptyRow(): FormulateLayoutRow {
	return { isStep: false, cells: [{ columnSpan: FORMULATE_LAYOUT_COLUMNS, fields: [] }] };
}

function readField(value: unknown): FormulateLayoutField | undefined {
	return typeof readSettings(value).id === 'string' ? (value as FormulateLayoutField) : undefined;
}

function readCell(value: unknown): FormulateLayoutCell {
	const cell = readSettings(value);
	const fields = Array.isArray(cell.fields) ? cell.fields : [];

	return {
		...cell,
		columnSpan: typeof cell.columnSpan === 'number' ? cell.columnSpan : 0,
		fields: fields.map(readField).filter((field): field is FormulateLayoutField => field !== undefined),
	};
}

function readRow(value: unknown): FormulateLayoutRow {
	const row = readSettings(value);
	const cells = Array.isArray(row.cells) ? row.cells : [];

	return { ...row, isStep: row.isStep === true, cells: cells.map(readCell) };
}

/**
 * A layout as the designer shows it: its rows, with every field placed in them, also those no longer on
 * the form; and one empty row of 12 columns when it has none, so there is somewhere to put the fields.
 * @param data The configuration, as the API gives it.
 */
export function readLayout(data: unknown): FormulateBasicLayout {
	const layout = readSettings(data);
	const rows = Array.isArray(layout.rows) ? layout.rows.map(readRow) : [];

	return { ...layout, autoPopulate: layout.autoPopulate === true, rows: rows.length ? rows : [emptyRow()] };
}

/**
 * A layout to store: as the designer shows it ({@link readLayout}), without the fields that are no longer
 * on the form. A layout that has nothing to drop comes out as it went in.
 * @param data The configuration.
 * @param form The layout's form.
 */
export function normalize(data: unknown, form: FormulateLayoutForm): FormulateBasicLayout {
	const layout = readLayout(data);
	const isOnForm = (field: FormulateLayoutField) => form.fields.some((candidate) => isSameGuid(candidate.id, field.id));

	return {
		...layout,
		rows: layout.rows.map((row) => ({
			...row,
			cells: row.cells.map((cell) => ({ ...cell, fields: cell.fields.filter(isOnForm) })),
		})),
	};
}

/** Whether a row has cells (it is not a step divider). */
function hasCells(row: FormulateLayoutRow | undefined): row is FormulateLayoutRow {
	return row !== undefined && !row.isStep;
}

function withRows(layout: FormulateBasicLayout, rows: Array<FormulateLayoutRow>): FormulateBasicLayout {
	return { ...layout, rows };
}

/**
 * Adds a row at the end, with the cells of the split points and no fields.
 * @param layout The layout.
 * @param splitPoints For each of the 12 columns, whether a cell starts at it.
 */
export function addRow(layout: FormulateBasicLayout, splitPoints: ReadonlyArray<boolean>): FormulateBasicLayout {
	const cells = splitPointsToCells(splitPoints).map(({ columnSpan }) => ({ columnSpan, fields: [] }));

	return withRows(layout, [...layout.rows, { isStep: false, cells }]);
}

/**
 * Deletes a row; its fields go back to the unused fields. The only row of a layout is emptied instead, to
 * one cell of 12 columns, so the layout keeps a row to put fields in.
 * @param layout The layout.
 * @param index The row; a step or a row that is not there is not deleted.
 */
export function deleteRow(layout: FormulateBasicLayout, index: number): FormulateBasicLayout {
	if (!hasCells(layout.rows[index])) {
		return layout;
	}

	const isOnlyRow = layout.rows.filter(hasCells).length === 1;

	return withRows(
		layout,
		isOnlyRow ? layout.rows.map((row, each) => (each === index ? emptyRow() : row)) : layout.rows.filter((_, each) => each !== index),
	);
}

/**
 * Moves a row, or a step divider, to another place.
 * @param layout The layout.
 * @param from The row's place.
 * @param to The place it ends up at.
 */
export function moveRow(layout: FormulateBasicLayout, from: number, to: number): FormulateBasicLayout {
	const count = layout.rows.length;

	if (from === to || from < 0 || to < 0 || from >= count || to >= count) {
		return layout;
	}

	const rows = [...layout.rows];
	rows.splice(to, 0, ...rows.splice(from, 1));

	return withRows(layout, rows);
}

/**
 * Adds a step divider after a row: the rows after it are a new step of the form.
 * @param layout The layout.
 * @param index The row.
 */
export function addStepAfter(layout: FormulateBasicLayout, index: number): FormulateBasicLayout {
	if (index < 0 || index >= layout.rows.length) {
		return layout;
	}

	const rows = [...layout.rows];
	rows.splice(index + 1, 0, { isStep: true, cells: [] });

	return withRows(layout, rows);
}

/**
 * Deletes a step divider: its rows join the step before it.
 * @param layout The layout.
 * @param index The step divider; a row with cells is not deleted.
 */
export function deleteStep(layout: FormulateBasicLayout, index: number): FormulateBasicLayout {
	return layout.rows[index]?.isStep === true ? withRows(layout, layout.rows.filter((_, each) => each !== index)) : layout;
}

/**
 * The number of the step each step divider starts, as the site shows the steps: a divider starts a step when
 * a row comes before it and one after it (counting from the last divider that started one). The first step,
 * before any divider, is step 1, so the first divider starts step 2. The site ignores the other dividers.
 * @param rows The layout's rows.
 * @returns For each row, the number of the step it starts; null for rows with cells and ignored dividers.
 */
export function stepNumbers(rows: ReadonlyArray<{ readonly isStep: boolean }>): Array<number | null> {
	const rowAfter = rows.map((_, index) => rows.slice(index + 1).some((row) => !row.isStep));
	let step = 1;

	return rows.map((row, index) => {
		const startsStep = row.isStep && index > 0 && !rows[index - 1].isStep && rowAfter[index];
		return startsStep ? ++step : null;
	});
}

function isPlaced(rows: ReadonlyArray<FormulateLayoutRow>, id: string): boolean {
	return rows.some((row) => hasCells(row) && row.cells.some((cell) => cell.fields.some((field) => isSameGuid(field.id, id))));
}

function cellAt(layout: FormulateBasicLayout, place: FormulateCellPlace): FormulateLayoutCell | undefined {
	const row = layout.rows[place.row];
	return hasCells(row) ? row.cells[place.cell] : undefined;
}

function withCell(
	layout: FormulateBasicLayout,
	place: FormulateCellPlace,
	change: (fields: ReadonlyArray<FormulateLayoutField>) => ReadonlyArray<FormulateLayoutField>,
): FormulateBasicLayout {
	return withRows(
		layout,
		layout.rows.map((row, rowIndex) =>
			rowIndex === place.row
				? { ...row, cells: row.cells.map((cell, cellIndex) => (cellIndex === place.cell ? { ...cell, fields: change(cell.fields) } : cell)) }
				: row,
		),
	);
}

/**
 * Moves a field: from the unused fields or a cell, to a place in a cell or back to the unused fields.
 * @param layout The layout.
 * @param fieldId The field.
 * @param from Where the field is.
 * @param to Where it goes.
 * @param index Its place in the cell it goes to, 0 for the top; past the end puts it at the end.
 * @returns The new layout; the same layout when the field is not where it is said to be, when it goes to
 * a step or a cell that is not there, or when it would be in the layout twice.
 */
export function moveField(
	layout: FormulateBasicLayout,
	fieldId: string,
	from: FormulateFieldPlace,
	to: FormulateFieldPlace,
	index: number,
): FormulateBasicLayout {
	let field: FormulateLayoutField = { id: fieldId };
	let moved = layout;

	if (from === UNUSED) {
		if (to === UNUSED || isPlaced(layout.rows, fieldId)) {
			return layout;
		}
	} else {
		const fields = cellAt(layout, from)?.fields ?? [];
		const at = fields.findIndex((candidate) => isSameGuid(candidate.id, fieldId));

		if (at < 0) {
			return layout;
		}

		field = fields[at];
		moved = withCell(layout, from, (each) => each.filter((_, position) => position !== at));
	}

	if (to === UNUSED) {
		return moved;
	}

	if (!cellAt(moved, to)) {
		return layout;
	}

	return withCell(moved, to, (fields) => {
		const next = [...fields];
		next.splice(Math.max(0, Math.min(index, next.length)), 0, field);
		return next;
	});
}

/**
 * The fields of the form that are in no row, in the order of the form.
 * @param form The layout's form.
 * @param rows The layout's rows.
 */
export function unusedFields<Field extends { id: string }>(form: FormulateLayoutForm<Field>, rows: ReadonlyArray<FormulateLayoutRow>): Array<Field> {
	return form.fields.filter((field) => !isPlaced(rows, field.id));
}
