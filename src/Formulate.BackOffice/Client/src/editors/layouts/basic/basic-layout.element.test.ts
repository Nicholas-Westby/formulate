import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import type { FormulateKindEditorContext } from '../../../core/kind-editor.js';
import type { FormulateFormFieldModel } from '../../../forms/types.js';
import { BUTTON, DROP_DOWN, FORM_ID, HEADER, TEXT } from '../../../test/forms.js';
import { provideIcons } from '../../../test/icons.js';
import { serveLayouts } from '../../../test/layouts.js';
import { loadFormulateEnglish } from '../../../test/localization.js';
import { createTestHost } from '../../../test/test-host.js';
import { click, press } from '../../../test/ui.js';
import { FormulateBasicLayoutEditorElement } from './basic-layout.element.js';

const NAME = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const EMAIL = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
const STATE = '5e1a7c3b-2d4f-4a6e-8c0b-3f5d7e9a1c03';
const INTRO = '7a3c5e1d-4b6f-4c8a-9e2d-5b7f9a1c3e04';
const SUBMIT = '9c5e7a3f-6d8b-4e0c-a1f4-7d9b1c3e5a05';
// A field that was deleted from the form after it was placed in the layout.
const GONE = 'b1d3f5a7-8e0c-4a2e-b3f6-9e1d3f5a7c06';

function field(id: string, kindId: string, name: string, alias: string): FormulateFormFieldModel {
	return { id, kindId, name, alias, label: null, category: null, validations: [], configuration: null };
}

/** The fields of the form, as the layout workspace reads them. */
const FIELDS = [
	field(NAME, TEXT, 'Name', 'name'),
	field(EMAIL, TEXT, 'Email', 'email'),
	field(STATE, DROP_DOWN, 'State', 'state'),
	field(INTRO, HEADER, 'Intro', 'intro'),
	field(SUBMIT, BUTTON, 'Submit', 'submit'),
];

const CONTEXT: FormulateKindEditorContext = { formFields: FIELDS, formId: FORM_ID };

/** A row of cells of the given widths and fields. */
function row(...cells: Array<[number, ...Array<string>]>) {
	return { isStep: false, cells: cells.map(([columnSpan, ...ids]) => ({ columnSpan, fields: ids.map((id) => ({ id })) })) };
}

const step = { isStep: true, cells: [] };

async function settle(editor: FormulateBasicLayoutEditorElement) {
	for (let i = 0; i < 4; i++) {
		await editor.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Shows the editor with a configuration, in a back office host, and records the configurations it stores. */
async function render(value: unknown, { readonly = false, context = CONTEXT }: { readonly?: boolean; context?: FormulateKindEditorContext } = {}) {
	serveLayouts();
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	provideIcons(host);
	const editor = new FormulateBasicLayoutEditorElement();
	editor.value = value;
	editor.context = context;
	editor.readonly = readonly;
	const changes: Array<unknown> = [];
	editor.addEventListener('change', (event) => {
		if (event.composedPath()[0] === editor) {
			changes.push(JSON.parse(JSON.stringify(editor.value)));
		}
	});
	host.append(editor);
	await settle(editor);
	const shadow = editor.shadowRoot!;

	const rowsElement = () => shadow.querySelector('formulate-basic-layout-rows');
	const rowElements = () => [...(rowsElement()?.shadowRoot?.querySelectorAll<HTMLElement>('#rows > .row') ?? [])];
	const cellsOf = (element: Element) => [...element.querySelectorAll<HTMLElement & { columns: number }>('formulate-basic-layout-cell')];
	const namesIn = (cell: Element | null | undefined) => [...(cell?.shadowRoot?.querySelectorAll('.field .name') ?? [])].map((name) => name.textContent?.trim());
	const pool = () => shadow.querySelector('formulate-basic-layout-cell#unused');

	return {
		editor,
		changes,
		shadow,
		rowsElement,
		pool,
		/** The rows as the designer shows them: each cell's width and fields, and each step's label. */
		shownRows: () =>
			rowElements().map((element) =>
				element.classList.contains('step')
					? element.querySelector('.step-label')?.textContent?.trim()
					: cellsOf(element).map((cell) => [cell.columns, ...namesIn(cell)]),
			),
		unused: () => namesIn(pool()),
		/** A button of a row, by its accessible name. */
		rowButton: (label: string) => rowsElement()?.shadowRoot?.querySelector<HTMLElement>(`uui-button[label="${label}"]`) ?? null,
		/** The handle of a field, by its key, in whichever cell it is. */
		fieldHandle: (key: string) => {
			const cells = [pool(), ...rowElements().flatMap(cellsOf)];
			return cells.map((cell) => cell?.shadowRoot?.querySelector<HTMLElement>(`.field[data-key="${key}"] .handle`)).find(Boolean) ?? null;
		},
		announcement: () => shadow.querySelector('#announcement')?.textContent?.trim(),
	};
}

/** A field's key in the designer: its ID's digits. */
function keyOf(id: string) {
	return id.replace(/-/g, '');
}

beforeAll(loadFormulateEnglish);

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate Basic layout designer, Auto Populate', () => {
	it('explains that the fields are laid out by themselves, hides the designer, and stores nothing', async () => {
		const { shadow, rowsElement, changes } = await render({ autoPopulate: true, rows: [] });

		expect((shadow.querySelector('uui-toggle#auto-populate') as HTMLInputElement | null)?.checked).toBe(true);
		expect(shadow.querySelector('#auto-populated')?.textContent).toContain('one under another');
		expect([rowsElement(), shadow.querySelector('#unused')]).toStrictEqual([null, null]);
		expect(changes).toStrictEqual([]);
	});

	it('turned off, shows one row of 12 columns and every field unused, and stores only the switch', async () => {
		const { editor, shadow, shownRows, unused, changes } = await render({ autoPopulate: true, rows: [] });
		const toggle = shadow.querySelector('uui-toggle#auto-populate') as HTMLInputElement;

		toggle.checked = false;
		toggle.dispatchEvent(new Event('change'));
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [] }]);
		expect(shownRows()).toStrictEqual([[[12]]]);
		expect(unused()).toStrictEqual(['Name', 'Email', 'State', 'Intro', 'Submit']);
	});

	it('turned on again, keeps the rows', async () => {
		const stored = { autoPopulate: false, rows: [row([12, NAME])] };
		const { editor, shadow, changes } = await render(stored);
		const toggle = shadow.querySelector('uui-toggle#auto-populate') as HTMLInputElement;

		toggle.checked = true;
		toggle.dispatchEvent(new Event('change'));
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: true, rows: [row([12, NAME])] }]);
	});

	it('turned on or off for a configuration without rows, stores no rows with it', async () => {
		const stored: Array<unknown> = [];

		for (const [value, autoPopulate] of [
			[null, true],
			['not a layout', true],
			[{ autoPopulate: true, kept: 'by hand' }, false],
			[{ autoPopulate: false, rows: 'not rows' }, true],
		] as const) {
			const { editor, shadow, changes } = await render(value);
			const toggle = shadow.querySelector('uui-toggle#auto-populate') as HTMLInputElement;

			toggle.checked = autoPopulate;
			toggle.dispatchEvent(new Event('change'));
			await settle(editor);
			stored.push(...changes);
			document.body.replaceChildren();
		}

		expect(stored).toStrictEqual([
			{ autoPopulate: true, rows: [] },
			{ autoPopulate: true, rows: [] },
			{ autoPopulate: false, rows: [], kept: 'by hand' },
			{ autoPopulate: true, rows: [] },
		]);
	});
});

describe('Formulate Basic layout designer, rows', () => {
	it('shows the stored rows: their cells, as wide as their columns, with their fields; and the steps as the site shows them', async () => {
		const { shownRows, unused, changes } = await render({ autoPopulate: false, rows: [row([6, NAME], [6, EMAIL]), step, row([12, STATE])] });

		expect(shownRows()).toStrictEqual([[[6, 'Name'], [6, 'Email']], 'Step 2', [[12, 'State']]]);
		expect(unused()).toStrictEqual(['Intro', 'Submit']);
		// Showing a layout never stores it.
		expect(changes).toStrictEqual([]);
	});

	it('adds a row with the cells the split columns make', async () => {
		const { editor, shadow, changes } = await render({ autoPopulate: false, rows: [] });
		const columns = [...shadow.querySelectorAll<HTMLElement>('#split-points .column')];

		expect(columns.map((column) => column.hasAttribute('disabled'))).toStrictEqual([true, ...new Array(11).fill(false)]);
		click(columns[6]);
		await settle(editor);
		// The new widths are read out too, as the cells change.
		const cells = shadow.querySelector('#new-row-cells');
		expect([columns[6].getAttribute('aria-pressed'), cells?.textContent?.trim(), cells?.getAttribute('aria-live')]).toStrictEqual([
			'true',
			'Cells of 6 and 6 columns',
			'polite',
		]);

		click(shadow.querySelector('uui-button#add-row')!);
		await settle(editor);

		// The row of 12 columns shown for a layout without rows is stored with it.
		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [row([12]), row([6], [6])] }]);
	});

	it('deletes a row, and its fields go back to the unused fields', async () => {
		const { editor, rowButton, shownRows, unused, changes } = await render({ autoPopulate: false, rows: [row([6, NAME], [6, EMAIL]), row([12, STATE])] });

		click(rowButton('Delete row 1')!);
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [row([12, STATE])] }]);
		expect([shownRows(), unused()]).toStrictEqual([[[[12, 'State']]], ['Name', 'Email', 'Intro', 'Submit']]);
	});

	it('moves a row with the keyboard, keeping the focus on its handle', async () => {
		const { editor, rowsElement, changes } = await render({ autoPopulate: false, rows: [row([12, NAME]), row([12, EMAIL])] });
		const handle = () => rowsElement()!.shadowRoot!.querySelector<HTMLElement>('#rows > .row:first-child > .handle')!;

		expect(handle().getAttribute('aria-label')).toBe('Move row 1');
		const first = handle();
		first.focus();
		press(first, 'ArrowDown');
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [row([12, EMAIL]), row([12, NAME])] }]);
		expect(rowsElement()!.shadowRoot!.activeElement).toBe(first);
		await expect.poll(() => rowsElement()!.shadowRoot!.querySelector('#announcement')?.textContent?.trim()).toBe('Moved to item 2 of 2.');
	});
});

describe('Formulate Basic layout designer, steps', () => {
	it('adds a step after a row, and deletes it', async () => {
		const { editor, rowButton, shownRows, changes } = await render({ autoPopulate: false, rows: [row([12, NAME]), row([12, EMAIL])] });

		click(rowButton('Add step after row 1')!);
		await settle(editor);
		expect(shownRows()).toStrictEqual([[[12, 'Name']], 'Step 2', [[12, 'Email']]]);

		click(rowButton('Delete step 2')!);
		await settle(editor);

		expect(changes).toStrictEqual([
			{ autoPopulate: false, rows: [row([12, NAME]), step, row([12, EMAIL])] },
			{ autoPopulate: false, rows: [row([12, NAME]), row([12, EMAIL])] },
		]);
	});

	it('shows a step that the site would skip as empty', async () => {
		const { shownRows, rowButton } = await render({ autoPopulate: false, rows: [row([12, NAME]), step] });

		expect(shownRows()).toStrictEqual([[[12, 'Name']], 'Empty step']);
		expect(rowButton('Delete empty step')).not.toBeNull();
	});
});

describe('Formulate Basic layout designer, fields', () => {
	it('moves a field with the keyboard: up from the unused fields into the last cell, and on through the cells', async () => {
		const { editor, shadow, fieldHandle, shownRows, unused, changes, announcement, pool } = await render({
			autoPopulate: false,
			rows: [row([6, NAME], [6]), row([12, EMAIL])],
		});
		const handle = fieldHandle(keyOf(STATE))!;

		expect(handle.getAttribute('aria-label')).toBe('Move State');
		handle.focus();
		press(handle, 'Enter');
		await settle(editor);
		// The live region says each move on the next frame.
		await expect.poll(() => announcement()).toContain('Picked up, in the unused fields.');

		press(handle, 'ArrowUp');
		await settle(editor);
		expect(shownRows()).toStrictEqual([[[6, 'Name'], [6]], [[12, 'Email', 'State']]]);
		await expect.poll(() => announcement()).toBe('Moved to row 2, cell 1, place 2 of 2.');

		press(fieldHandle(keyOf(STATE))!, 'ArrowUp');
		press(fieldHandle(keyOf(STATE))!, 'ArrowUp');
		await settle(editor);
		expect(shownRows()).toStrictEqual([[[6, 'Name'], [6, 'State']], [[12, 'Email']]]);

		press(fieldHandle(keyOf(STATE))!, 'ArrowUp');
		await settle(editor);

		expect(shownRows()).toStrictEqual([[[6, 'Name', 'State'], [6]], [[12, 'Email']]]);
		expect(unused()).toStrictEqual(['Intro', 'Submit']);
		expect(changes.at(-1)).toStrictEqual({ autoPopulate: false, rows: [row([6, NAME, STATE], [6]), row([12, EMAIL])] });
		// The handle keeps the focus as the field moves from cell to cell.
		const cell = fieldHandle(keyOf(STATE))!.getRootNode() as ShadowRoot;
		expect(cell.activeElement).toBe(fieldHandle(keyOf(STATE)));
		expect(pool()).not.toBeNull();
		expect(shadow.querySelector('#announcement')).not.toBeNull();
	});

	it('moves a field with the keyboard back down to the unused fields, and no further', async () => {
		const { editor, fieldHandle, unused, changes, announcement } = await render({ autoPopulate: false, rows: [row([12, NAME])] });

		press(fieldHandle(keyOf(NAME))!, 'ArrowDown');
		await settle(editor);
		expect(unused()).toStrictEqual(['Name', 'Email', 'State', 'Intro', 'Submit']);
		await expect.poll(() => announcement()).toBe('Moved to the unused fields.');

		press(fieldHandle(keyOf(NAME))!, 'ArrowDown');
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [row([12])] }]);
	});

	it('puts a field back where it was picked up, after moving it with the keyboard down into the unused fields', async () => {
		const rows = [row([6, NAME], [6]), row([12, EMAIL])];
		const { editor, fieldHandle, shownRows, unused, changes, announcement } = await render({ autoPopulate: false, rows });

		press(fieldHandle(keyOf(NAME))!, 'Enter');
		for (let i = 0; i < 4; i++) {
			press(fieldHandle(keyOf(NAME))!, 'ArrowDown');
			await settle(editor);
		}
		expect([shownRows(), unused()]).toStrictEqual([[[[6], [6]], [[12, 'Email']]], ['Name', 'State', 'Intro', 'Submit']]);

		press(fieldHandle(keyOf(NAME))!, 'Escape');
		await settle(editor);

		expect(shownRows()).toStrictEqual([[[6, 'Name'], [6]], [[12, 'Email']]]);
		await expect.poll(() => announcement()).toBe('Put back in row 1, cell 1, place 1 of 1.');
		expect(changes.at(-1)).toStrictEqual({ autoPopulate: false, rows });
	});

	it('shows a field that is no longer on the form as not found, which can be removed; storing any change drops it', async () => {
		const { editor, rowsElement, shownRows, changes } = await render({ autoPopulate: false, rows: [row([6, NAME, GONE], [6, EMAIL])] });
		const cell = rowsElement()!.shadowRoot!.querySelector('formulate-basic-layout-cell')!;
		const missing = cell.shadowRoot!.querySelector(`.field[data-key="${keyOf(GONE)}"]`)!;

		expect(shownRows()).toStrictEqual([[[6, 'Name', 'Field not found'], [6, 'Email']]]);
		expect([missing.querySelector('.alias')?.textContent?.trim(), missing.querySelector('.handle')]).toStrictEqual([GONE, null]);

		click(missing.querySelector('uui-button[label="Remove missing field 2"]')!);
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [row([6, NAME], [6, EMAIL])] }]);
	});

	it('keeps what else the configuration has when it stores a change', async () => {
		const { editor, rowButton, changes } = await render({ autoPopulate: false, rows: [row([12, NAME]), row([12])], kept: { by: 'a newer version' } });

		click(rowButton('Delete row 2')!);
		await settle(editor);

		expect(changes).toStrictEqual([{ autoPopulate: false, rows: [row([12, NAME])], kept: { by: 'a newer version' } }]);
	});

	it('keeps an empty cell, and the unused fields when all are used, for the sorter to find', async () => {
		const errors: Array<unknown> = [];
		const onError = (event: ErrorEvent) => errors.push(event.error);
		window.addEventListener('error', onError);

		try {
			const { rowsElement, pool } = await render({ autoPopulate: false, rows: [row([6, NAME, EMAIL, STATE], [6, INTRO, SUBMIT]), row([12])] });
			await new Promise((resolve) => requestAnimationFrame(resolve));
			await new Promise((resolve) => requestAnimationFrame(resolve));

			const cells = [...rowsElement()!.shadowRoot!.querySelectorAll('formulate-basic-layout-cell'), pool()!];
			expect(cells.map((cell) => cell.shadowRoot!.querySelector('#fields') !== null)).toStrictEqual([true, true, true, true]);
			expect(pool()!.shadowRoot!.querySelector('.empty')?.textContent?.trim()).toBe('Every field of the form is in the layout.');
			expect(errors).toStrictEqual([]);
		} finally {
			window.removeEventListener('error', onError);
		}
	});
});

describe('Formulate Basic layout designer, a layout that shows no fields', () => {
	it('says so while no field of the form is in a cell, and stores nothing for it', async () => {
		// The site shows nothing for a field that is no longer on the form either.
		const { editor, shadow, fieldHandle, changes } = await render({ autoPopulate: false, rows: [row([6, GONE], [6]), step, row([12])] });
		const notice = () => shadow.querySelector('#no-fields-shown');

		expect([notice()?.textContent?.trim(), notice()?.getAttribute('role'), changes]).toStrictEqual([
			'The form shows no fields until you drag them into the cells, or turn on Auto Populate.',
			'note',
			[],
		]);
		// Below the unused fields: it goes as the first field is dragged into a cell, which moves nothing above it.
		expect(notice()?.previousElementSibling?.id).toBe('unused-section');

		press(fieldHandle(keyOf(NAME))!, 'ArrowUp');
		await settle(editor);
		expect(notice()).toBeNull();

		press(fieldHandle(keyOf(NAME))!, 'ArrowDown');
		await settle(editor);
		expect(notice()).not.toBeNull();
	});

	it('for a form without fields, says it has none yet and where they are added', async () => {
		const { shadow, pool } = await render({ autoPopulate: false, rows: [row([12])] }, { context: { formFields: [], formId: FORM_ID } });

		expect(shadow.querySelector('#no-fields-shown')?.textContent?.trim()).toBe(
			"The form has no fields yet. Add them in the form's Fields view, then drag them into the cells here, or turn on Auto Populate.",
		);
		// Not "Every field of the form is in the layout".
		expect(pool()!.shadowRoot!.querySelector('.empty')?.textContent?.trim()).toBe('No fields yet.');
	});

	it('says nothing with Auto Populate on, or with a field in a cell', async () => {
		const notices: Array<Element | null> = [];

		for (const value of [{ autoPopulate: true, rows: [] }, { autoPopulate: false, rows: [row([6]), row([6], [6, STATE])] }]) {
			const { shadow } = await render(value);
			notices.push(shadow.querySelector('#no-fields-shown'));
			document.body.replaceChildren();
		}

		expect(notices).toStrictEqual([null, null]);
	});
});

describe('Formulate Basic layout designer, read-only and without the form', () => {
	it('read-only, shows the layout with nothing to change', async () => {
		const { shadow, rowsElement, fieldHandle } = await render({ autoPopulate: false, rows: [row([12, NAME]), step, row([12])] }, { readonly: true });

		expect([
			fieldHandle(keyOf(NAME)),
			rowsElement()!.shadowRoot!.querySelectorAll('.handle, uui-button').length,
			shadow.querySelector('#add-row-section'),
			(shadow.querySelector('uui-toggle#auto-populate') as HTMLElement & { readonly: boolean }).readonly,
		]).toStrictEqual([null, 0, null, true]);
	});

	it("without the form's fields, says so and shows no designer that could drop them", async () => {
		const { shadow, rowsElement, changes } = await render({ autoPopulate: false, rows: [row([12, NAME])] }, { context: { formId: FORM_ID } });

		expect(shadow.querySelector('#fields-unknown')?.textContent?.trim()).toBe(
			"The fields of this layout's form are not known, so they cannot be laid out here.",
		);
		expect([rowsElement(), changes]).toStrictEqual([null, []]);
	});
});
