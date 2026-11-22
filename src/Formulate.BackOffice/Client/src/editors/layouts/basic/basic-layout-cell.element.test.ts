import { html } from '@umbraco-cms/backoffice/external/lit';
import type { UmbSorterConfig } from '@umbraco-cms/backoffice/sorter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestHost } from '../../../test/test-host.js';
import { FormulateBasicLayoutCellElement } from './basic-layout-cell.element.js';
import type { FormulateBasicLayoutDesigner, FormulateLayoutFieldView } from './basic-layout-designer.js';
import type { FormulateFieldPlace } from './basic-layout.model.js';

/** The settings each of Umbraco's sorters was made with, by the element it sorts for. */
const sorterConfigs = vi.hoisted(() => new Map<unknown, unknown>());

// Umbraco's own sorter, which also keeps the settings it is made with, so a test can do what the sorter does
// when a field is dropped: call them.
vi.mock('@umbraco-cms/backoffice/sorter', async (importOriginal) => {
	const sorter = await importOriginal<typeof import('@umbraco-cms/backoffice/sorter')>();

	class FormulateRecordingSorterController<T, E extends HTMLElement> extends sorter.UmbSorterController<T, E> {
		constructor(...args: ConstructorParameters<typeof sorter.UmbSorterController<T, E>>) {
			super(...args);
			sorterConfigs.set(args[0], args[1]);
		}
	}

	return { ...sorter, UmbSorterController: FormulateRecordingSorterController };
});

function fieldView(key: string): FormulateLayoutFieldView {
	return { key, id: key, name: key, alias: key, missing: false };
}

/** Shows a cell with fields, for a designer that records the moves it is asked for. */
async function renderCell(place: FormulateFieldPlace, fields: Array<FormulateLayoutFieldView>) {
	const moves: Array<[string, FormulateFieldPlace, number]> = [];
	const none = () => undefined;
	const designer: FormulateBasicLayoutDesigner = {
		moveRow: none,
		deleteRow: none,
		addStepAfter: none,
		deleteStep: none,
		moveField: (key, to, index) => moves.push([key, to, index]),
		removeField: none,
		renderRowHandle: () => html``,
		renderRowStatus: () => html``,
		renderFieldHandle: (_, label) => html`<button type="button" class="handle" aria-label=${label}></button>`,
	};
	const cell = new FormulateBasicLayoutCellElement();
	cell.designer = designer;
	cell.place = place;
	cell.fields = fields;
	createTestHost().append(cell);
	await cell.updateComplete;

	return { moves, sorter: sorterConfigs.get(cell) as UmbSorterConfig<FormulateLayoutFieldView, HTMLElement> };
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate Basic layout cell, dragging', () => {
	it("puts a field dropped below the cell at the cell's end, from another cell and from its own", async () => {
		const place = { row: 0, cell: 1 };
		const { moves, sorter } = await renderCell(place, [fieldView('name'), fieldView('email')]);

		// Umbraco's sorter gives the place -1 for a field dragged below the cell (sorter.controller.js, #moveElementTo(-1)).
		await sorter.performItemInsert!({ item: fieldView('state'), newIndex: -1 });
		await sorter.performItemMove!({ item: fieldView('name'), newIndex: -1, oldIndex: 0 });

		expect(moves).toStrictEqual([
			['state', place, 2],
			['name', place, 2],
		]);
	});

	it('puts a field dropped in the cell at the place it ends up at', async () => {
		const place = { row: 1, cell: 0 };
		const { moves, sorter } = await renderCell(place, [fieldView('name'), fieldView('email')]);

		await sorter.performItemInsert!({ item: fieldView('state'), newIndex: 1 });
		// Within its own cell, the sorter gives the place before the field leaves its own.
		await sorter.performItemMove!({ item: fieldView('name'), newIndex: 2, oldIndex: 0 });
		await sorter.performItemMove!({ item: fieldView('email'), newIndex: 0, oldIndex: 1 });

		expect(moves).toStrictEqual([
			['state', place, 1],
			['name', place, 1],
			['email', place, 0],
		]);
	});
});
