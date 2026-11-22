import { describe, expect, it } from 'vitest';
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
} from './basic-layout.model.js';

// The fields of a form, as the form API gives them (System.Text.Json writes GUIDs in lower case).
const NAME = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const EMAIL = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
const STATE = '5e1a7c3b-2d4f-4a6e-8c0b-3f5d7e9a1c03';
const INTRO = '7a3c5e1d-4b6f-4c8a-9e2d-5b7f9a1c3e04';
const SUBMIT = '9c5e7a3f-6d8b-4e0c-a1f4-7d9b1c3e5a05';
// A field that was deleted from the form after it was placed in the layout.
const GONE = 'b1d3f5a7-8e0c-4a2e-b3f6-9e1d3f5a7c06';

const form = { fields: [NAME, EMAIL, STATE, INTRO, SUBMIT].map((id) => ({ id })) };

/** A row of cells of the given widths and fields. */
function row(...cells: Array<[number, ...Array<string>]>) {
	return { isStep: false, cells: cells.map(([columnSpan, ...ids]) => ({ columnSpan, fields: ids.map((id) => ({ id })) })) };
}

const step = { isStep: true, cells: [] };

/** A layout as the API gives it: not auto populated, with the given rows. */
function layout(...rows: Array<FormulateBasicLayout['rows'][number]>): FormulateBasicLayout {
	return { autoPopulate: false, rows };
}

/** Split points that start a cell at each of the given columns (0 is the first). */
function splitAt(...columns: Array<number>) {
	return noSplitPoints().map((_, column) => columns.includes(column));
}

describe('Basic layout split points', () => {
	it('make one cell of 12 columns when there are none', () => {
		expect(splitPointsToCells(noSplitPoints())).toStrictEqual([{ columnSpan: 12 }]);
	});

	it('make twelve cells of one column when every column is one', () => {
		expect(splitPointsToCells(new Array(12).fill(true))).toStrictEqual(new Array(12).fill({ columnSpan: 1 }));
	});

	it('start a cell at each split point, as Formulate 3 and 4 did', () => {
		expect(splitPointsToCells(splitAt(6))).toStrictEqual([{ columnSpan: 6 }, { columnSpan: 6 }]);
		expect(splitPointsToCells(splitAt(4, 8))).toStrictEqual([{ columnSpan: 4 }, { columnSpan: 4 }, { columnSpan: 4 }]);
		expect(splitPointsToCells(splitAt(3, 9))).toStrictEqual([{ columnSpan: 3 }, { columnSpan: 6 }, { columnSpan: 3 }]);
		expect(splitPointsToCells(splitAt(11))).toStrictEqual([{ columnSpan: 11 }, { columnSpan: 1 }]);
	});

	it('never start a cell before the first column', () => {
		expect(splitPointsToCells(splitAt(0))).toStrictEqual([{ columnSpan: 12 }]);
		expect(splitPointsToCells(splitAt(0, 6))).toStrictEqual([{ columnSpan: 6 }, { columnSpan: 6 }]);
	});

	it('read the 12 columns only, whatever the length of the list', () => {
		expect(splitPointsToCells([false, false, true])).toStrictEqual([{ columnSpan: 2 }, { columnSpan: 10 }]);
		expect(splitPointsToCells([...splitAt(6), true, true])).toStrictEqual([{ columnSpan: 6 }, { columnSpan: 6 }]);
	});

	it('are toggled one column at a time, in a new list', () => {
		const none = noSplitPoints();
		const one = toggleSplitPoint(none, 6);

		expect(one).toStrictEqual(splitAt(6));
		expect(toggleSplitPoint(one, 6)).toStrictEqual(none);
		expect(none).toStrictEqual(new Array(12).fill(false));
	});

	it('cannot be put before the first column or outside the 12', () => {
		expect(toggleSplitPoint(splitAt(6), 0)).toStrictEqual(splitAt(6));
		expect(toggleSplitPoint(splitAt(6), 12)).toStrictEqual(splitAt(6));
		expect(toggleSplitPoint(splitAt(6), -1)).toStrictEqual(splitAt(6));
	});
});

describe('Basic layout rows', () => {
	it('are added at the end with the cells of the split points, each with no fields', () => {
		expect(addRow(layout(row([12, NAME])), splitAt(6))).toStrictEqual(layout(row([12, NAME]), row([6], [6])));
	});

	it('are deleted, and their fields go back to the unused fields', () => {
		const deleted = deleteRow(layout(row([6, NAME], [6, EMAIL]), row([12, STATE])), 0);

		expect(deleted).toStrictEqual(layout(row([12, STATE])));
		expect(unusedFields(form, deleted.rows).map((field) => field.id)).toStrictEqual([NAME, EMAIL, INTRO, SUBMIT]);
	});

	it('leave one empty row of 12 columns when the only row is deleted', () => {
		expect(deleteRow(layout(row([6, NAME], [6, EMAIL])), 0)).toStrictEqual(layout(row([12])));
		// Steps stay where they are; the row is emptied in its place.
		expect(deleteRow(layout(row([4, NAME], [8]), step), 0)).toStrictEqual(layout(row([12]), step));
	});

	it('are not deleted by deleting a step or a row that is not there', () => {
		const rows = layout(row([12, NAME]), step, row([12, EMAIL]));

		expect(deleteRow(rows, 1)).toBe(rows);
		expect(deleteRow(rows, 3)).toBe(rows);
	});

	it('move up and down, steps too', () => {
		const rows = layout(row([12, NAME]), step, row([12, EMAIL]));

		expect(moveRow(rows, 2, 0)).toStrictEqual(layout(row([12, EMAIL]), row([12, NAME]), step));
		expect(moveRow(rows, 1, 2)).toStrictEqual(layout(row([12, NAME]), row([12, EMAIL]), step));
		expect(moveRow(rows, 0, 0)).toBe(rows);
		expect(moveRow(rows, 0, 3)).toBe(rows);
	});
});

describe('Basic layout steps', () => {
	it('are added after a row', () => {
		expect(addStepAfter(layout(row([12, NAME]), row([12, EMAIL])), 0)).toStrictEqual(
			layout(row([12, NAME]), step, row([12, EMAIL])),
		);
		expect(addStepAfter(layout(row([12, NAME])), 0)).toStrictEqual(layout(row([12, NAME]), step));
		expect(addStepAfter(layout(row([12, NAME])), 1)).toStrictEqual(layout(row([12, NAME])));
	});

	it('are deleted, leaving the rows', () => {
		const rows = layout(row([12, NAME]), step, row([12, EMAIL]));

		expect(deleteStep(rows, 1)).toStrictEqual(layout(row([12, NAME]), row([12, EMAIL])));
		expect(deleteStep(rows, 0)).toBe(rows);
	});

	it('are numbered from 2 where the form starts a new step, as the site shows them', () => {
		expect(stepNumbers([row([12]), step, row([12]), step, row([12])])).toStrictEqual([null, 2, null, 3, null]);
	});

	it('are not numbered where the site starts no step: no row before them, or none after them', () => {
		// The site ignores a divider with no rows before it in its step, and shows no empty step at the end.
		expect(stepNumbers([step, row([12]), step, step, row([12]), step])).toStrictEqual([null, null, 2, null, null, null]);
		expect(stepNumbers([])).toStrictEqual([]);
	});
});

describe('Basic layout fields', () => {
	it('move from the unused fields into a cell', () => {
		const moved = moveField(layout(row([6, NAME], [6])), EMAIL, UNUSED, { row: 0, cell: 1 }, 0);

		expect(moved).toStrictEqual(layout(row([6, NAME], [6, EMAIL])));
		expect(moveField(moved, STATE, UNUSED, { row: 0, cell: 0 }, 0)).toStrictEqual(layout(row([6, STATE, NAME], [6, EMAIL])));
	});

	it('move between cells and rows, to the place given', () => {
		const rows = layout(row([6, NAME, EMAIL], [6, STATE]), row([12, INTRO]));

		expect(moveField(rows, EMAIL, { row: 0, cell: 0 }, { row: 0, cell: 1 }, 0)).toStrictEqual(
			layout(row([6, NAME], [6, EMAIL, STATE]), row([12, INTRO])),
		);
		expect(moveField(rows, NAME, { row: 0, cell: 0 }, { row: 1, cell: 0 }, 1)).toStrictEqual(
			layout(row([6, EMAIL], [6, STATE]), row([12, INTRO, NAME])),
		);
	});

	it('move within a cell, to the place they end up at', () => {
		const rows = layout(row([12, NAME, EMAIL, STATE]));

		expect(moveField(rows, NAME, { row: 0, cell: 0 }, { row: 0, cell: 0 }, 2)).toStrictEqual(layout(row([12, EMAIL, STATE, NAME])));
		expect(moveField(rows, STATE, { row: 0, cell: 0 }, { row: 0, cell: 0 }, 0)).toStrictEqual(layout(row([12, STATE, NAME, EMAIL])));
		expect(moveField(rows, STATE, { row: 0, cell: 0 }, { row: 0, cell: 0 }, 9)).toStrictEqual(rows);
	});

	it('go back to the unused fields', () => {
		const moved = moveField(layout(row([6, NAME], [6, EMAIL])), NAME, { row: 0, cell: 0 }, UNUSED, 0);

		expect(moved).toStrictEqual(layout(row([6], [6, EMAIL])));
		expect(unusedFields(form, moved.rows).map((field) => field.id)).toStrictEqual([NAME, STATE, INTRO, SUBMIT]);
	});

	it('keep what else is stored with them, and the way their ID is written', () => {
		const stored = layout({ isStep: false, cells: [{ columnSpan: 12, fields: [{ id: NAME.toUpperCase(), note: 'kept' }] }, { columnSpan: 0, fields: [] }] });

		expect(moveField(stored, NAME, { row: 0, cell: 0 }, { row: 0, cell: 1 }, 0)).toStrictEqual(
			layout({ isStep: false, cells: [{ columnSpan: 12, fields: [] }, { columnSpan: 0, fields: [{ id: NAME.toUpperCase(), note: 'kept' }] }] }),
		);
	});

	it('are not moved from where they are not, into a step or a cell that is not there, or into the layout twice', () => {
		const rows = layout(row([12, NAME]), step);

		expect(moveField(rows, EMAIL, { row: 0, cell: 0 }, UNUSED, 0)).toBe(rows);
		expect(moveField(rows, EMAIL, UNUSED, { row: 1, cell: 0 }, 0)).toBe(rows);
		expect(moveField(rows, EMAIL, UNUSED, { row: 0, cell: 1 }, 0)).toBe(rows);
		expect(moveField(rows, NAME, UNUSED, { row: 0, cell: 0 }, 0)).toBe(rows);
		expect(moveField(rows, EMAIL, UNUSED, UNUSED, 0)).toBe(rows);
	});

	it('that are unused are the fields of the form not in a row, in the order of the form', () => {
		const rows = layout(row([6, STATE.toUpperCase().replace(/-/g, '')], [6, NAME]), step, row([12, GONE])).rows;

		expect(unusedFields(form, rows).map((field) => field.id)).toStrictEqual([EMAIL, INTRO, SUBMIT]);
		expect(unusedFields(form, []).map((field) => field.id)).toStrictEqual([NAME, EMAIL, STATE, INTRO, SUBMIT]);
	});
});

describe('Basic layout configuration', () => {
	it('is read as the designer shows it, with fields no longer on the form', () => {
		const stored = layout(row([6, NAME, GONE], [6]), step);

		expect(readLayout(stored)).toStrictEqual(stored);
	});

	it('is read with one empty row of 12 columns when it has no rows', () => {
		for (const stored of [{ autoPopulate: true, rows: [] }, { autoPopulate: true }, { autoPopulate: true, rows: 'none' }]) {
			expect(readLayout(stored)).toStrictEqual({ autoPopulate: true, rows: [row([12])] });
		}

		expect(readLayout(null)).toStrictEqual(layout(row([12])));
		expect(readLayout(undefined)).toStrictEqual(layout(row([12])));
		expect(readLayout(['not', 'a', 'layout'])).toStrictEqual(layout(row([12])));
	});

	it('is normalized by dropping the fields that are no longer on the form', () => {
		expect(normalize(layout(row([6, NAME, GONE], [6, GONE.toUpperCase()]), step), form)).toStrictEqual(
			layout(row([6, NAME], [6]), step),
		);
	});

	it('is normalized with one empty row of 12 columns when it has no rows, keeping Auto Populate', () => {
		expect(normalize({ autoPopulate: true, rows: [] }, form)).toStrictEqual({ autoPopulate: true, rows: [row([12])] });
		expect(normalize({ autoPopulate: false, rows: [] }, form)).toStrictEqual(layout(row([12])));
		expect(normalize(null, form)).toStrictEqual(layout(row([12])));
	});

	it('is normalized without changing a layout that has nothing to drop', () => {
		// One ID written without dashes in upper case. The API gives every ID with dashes, so this is for robustness only.
		const stored = {
			autoPopulate: false,
			rows: [
				{ isStep: false, cells: [{ columnSpan: 6, fields: [{ id: NAME.replace(/-/g, '').toUpperCase() }] }, { columnSpan: 6, fields: [] }] },
				{ isStep: true, cells: [] },
				{ isStep: false, cells: [{ columnSpan: 12, fields: [{ id: EMAIL }, { id: STATE }] }] },
			],
		};

		expect(JSON.stringify(normalize(stored, form))).toBe(JSON.stringify(stored));
	});

	it('keeps what else is stored, at every level, in its order', () => {
		const stored = {
			version: 3,
			rows: [{ cells: [{ fields: [{ id: NAME, extra: 1 }], columnSpan: 12, width: 'wide' }], isStep: false, label: 'First' }],
			autoPopulate: false,
		};

		expect(JSON.stringify(normalize(stored, form))).toBe(JSON.stringify(stored));
	});

	it('drops fields that have no ID, and reads anything else that is not a layout as none', () => {
		expect(
			normalize({ autoPopulate: 'yes', rows: [{ isStep: 'no', cells: [{ columnSpan: '6', fields: [{}, { id: 7 }, 'x', { id: NAME }] }] }] }, form),
		).toStrictEqual({ autoPopulate: false, rows: [{ isStep: false, cells: [{ columnSpan: 0, fields: [{ id: NAME }] }] }] });
	});

	it("shows a cell whose width was not stored as its share of the row's 12 columns, as Formulate 3 did", () => {
		const stored = readLayout(layout(row([0], [0], [0]), row([4], [8]), row([13])));

		expect(stored.rows.map((each) => each.cells.map((cell) => cellColumnSpan(each, cell)))).toStrictEqual([[4, 4, 4], [4, 8], [12]]);
	});
});
