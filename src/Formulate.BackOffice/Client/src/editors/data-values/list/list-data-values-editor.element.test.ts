import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFormulateEnglish } from '../../../test/localization.js';
import { click, press, typeInto, valuesOf } from '../../../test/ui.js';
import { FormulateListDataValuesEditorElement } from './list-data-values-editor.element.js';

/**
 * Shows the editor with a configuration, as the kind editor slot does, and records what it stores each
 * time it says it changed.
 */
async function render(value: unknown, readonly = false) {
	const element = new FormulateListDataValuesEditorElement();
	element.value = value;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? JSON.parse(JSON.stringify(element.value)) : 'not an UmbChangeEvent');
	});
	document.body.append(element);
	await element.updateComplete;

	const shadow = element.shadowRoot!;
	const rows = () => [...shadow.querySelectorAll('#rows > .row')];
	const values = () => valuesOf(shadow.querySelectorAll('#rows > .row uui-input.value'));

	return { element, changes, shadow, rows, values };
}

const COLORS = { items: [{ value: 'Red' }, { value: 'Green' }, { value: 'Blue' }] };

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate List data values editor', () => {
	it('shows each item as a row with its value, in order', async () => {
		const { values } = await render(COLORS);

		expect(values()).toStrictEqual(['Red', 'Green', 'Blue']);
	});

	it('adds an empty item at the end and stores the exact shape', async () => {
		const { element, shadow, changes, values } = await render(COLORS);

		click(shadow.querySelector('uui-button#add')!);
		await element.updateComplete;

		expect(values()).toStrictEqual(['Red', 'Green', 'Blue', '']);
		expect(changes).toStrictEqual([{ items: [{ value: 'Red' }, { value: 'Green' }, { value: 'Blue' }, { value: '' }] }]);
	});

	it("stores an item's new value as it is typed", async () => {
		const { shadow, changes } = await render(COLORS);

		typeInto(shadow.querySelectorAll('#rows > .row uui-input.value')[1], 'Lime');

		expect(changes).toStrictEqual([{ items: [{ value: 'Red' }, { value: 'Lime' }, { value: 'Blue' }] }]);
	});

	it('removes an item', async () => {
		const { element, shadow, changes, values } = await render(COLORS);

		click(shadow.querySelectorAll('#rows > .row uui-button.remove')[0]);
		await element.updateComplete;

		expect(values()).toStrictEqual(['Green', 'Blue']);
		expect(changes).toStrictEqual([{ items: [{ value: 'Green' }, { value: 'Blue' }] }]);
	});

	it('moves an item up and down with the arrow keys on its drag handle', async () => {
		const { element, rows, changes, values } = await render(COLORS);

		press(rows()[2].querySelector('.handle')!, 'ArrowUp');
		await element.updateComplete;
		expect(values()).toStrictEqual(['Red', 'Blue', 'Green']);

		press(rows()[0].querySelector('.handle')!, 'ArrowDown');
		await element.updateComplete;
		expect(values()).toStrictEqual(['Blue', 'Red', 'Green']);

		// Nothing moves past either end.
		press(rows()[0].querySelector('.handle')!, 'ArrowUp');
		press(rows()[2].querySelector('.handle')!, 'ArrowDown');
		await element.updateComplete;

		expect(changes).toStrictEqual([
			{ items: [{ value: 'Red' }, { value: 'Blue' }, { value: 'Green' }] },
			{ items: [{ value: 'Blue' }, { value: 'Red' }, { value: 'Green' }] },
		]);
	});

	it('picks an item up and puts it down with Enter or Space on its handle, and puts it back with Escape', async () => {
		loadFormulateEnglish();
		const { element, shadow, rows, changes, values } = await render(COLORS);
		const handle = (index: number) => rows()[index].querySelector('.handle') as HTMLElement;
		// Screen readers say what each keyboard move did, from a polite live region.
		const announcement = () => shadow.querySelector('#announcement[role="status"]')?.textContent?.trim();
		// A dialog the editor is in closes on Escape; while an item is picked up, Escape is the item's.
		const escapes: Array<string> = [];
		const listening = new AbortController();
		document.addEventListener('keydown', (event) => event.key === 'Escape' && escapes.push('escaped'), listening);

		press(handle(2), 'Enter');
		await element.updateComplete;
		expect(handle(2).getAttribute('aria-pressed')).toBe('true');
		expect(announcement()).toBe(
			'Picked up item 3 of 3. Press the up and down arrow keys to move it, Enter to put it down, or Escape to put it back.',
		);
		press(handle(2), 'ArrowUp');
		await expect.poll(() => announcement()).toBe('Moved to item 2 of 3.');
		press(handle(1), 'ArrowUp');
		await expect.poll(() => announcement()).toBe('Moved to item 1 of 3.');
		expect(values()).toStrictEqual(['Blue', 'Red', 'Green']);

		press(handle(0), 'Escape');
		await expect.poll(() => announcement()).toBe('Put back at item 3 of 3.');
		expect(values()).toStrictEqual(['Red', 'Green', 'Blue']);
		expect(handle(2).getAttribute('aria-pressed')).toBe('false');
		expect(escapes).toStrictEqual([]);

		press(handle(0), ' ');
		await element.updateComplete;
		press(handle(0), 'ArrowDown');
		await expect.poll(() => announcement()).toBe('Moved to item 2 of 3.');
		press(handle(1), ' ');
		await element.updateComplete;
		expect(values()).toStrictEqual(['Green', 'Red', 'Blue']);
		expect(announcement()).toBe('Put down at item 2 of 3.');
		expect(handle(1).getAttribute('aria-pressed')).toBe('false');

		// Escape with nothing picked up is left to the dialog.
		press(handle(1), 'Escape');
		listening.abort();
		expect(escapes).toStrictEqual(['escaped']);
		expect(changes).toStrictEqual([
			{ items: [{ value: 'Red' }, { value: 'Blue' }, { value: 'Green' }] },
			{ items: [{ value: 'Blue' }, { value: 'Red' }, { value: 'Green' }] },
			{ items: [{ value: 'Red' }, { value: 'Green' }, { value: 'Blue' }] },
			{ items: [{ value: 'Green' }, { value: 'Red' }, { value: 'Blue' }] },
		]);
	});

	it('picks an item up when its handle is clicked, as screen readers press buttons', async () => {
		const { element, rows } = await render(COLORS);
		const handle = rows()[1].querySelector('.handle') as HTMLElement;

		click(handle);
		await element.updateComplete;
		expect(handle.getAttribute('aria-pressed')).toBe('true');

		click(handle);
		await element.updateComplete;
		expect(handle.getAttribute('aria-pressed')).toBe('false');
	});

	it("names each item's controls after the item, in words a translation can order, also when it is empty", async () => {
		loadFormulateEnglish();
		const { element, shadow, rows } = await render({ items: [{ value: 'Red' }, { value: '' }] });
		await element.updateComplete;
		const handles = rows().map((row) => row.querySelector('.handle')!);

		expect(rows().map((row) => row.querySelector('uui-input.value')!.getAttribute('label'))).toStrictEqual([
			'Value of item 1',
			'Value of item 2',
		]);
		expect(rows().map((row) => row.querySelector('uui-button.remove')!.getAttribute('label'))).toStrictEqual([
			'Remove Red',
			'Remove item 2',
		]);
		expect(handles.map((handle) => handle.getAttribute('aria-label'))).toStrictEqual(['Move Red', 'Move item 2']);
		// The handle is a button, says which keys move it, and is described by the hint (not only its title).
		expect(handles.map((handle) => [handle.getAttribute('role'), handle.getAttribute('tabindex')])).toStrictEqual([
			['button', '0'],
			['button', '0'],
		]);
		expect(handles[0].getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown');
		const hint = shadow.getElementById(handles[0].getAttribute('aria-describedby')!);
		expect(hint?.textContent).toBe(
			'Drag to move it, or press the up and down arrow keys. Enter picks it up and puts it down, and Escape puts it back.',
		);
	});

	it('keeps typing in a moved item working on that item', async () => {
		const { element, shadow, rows, changes } = await render(COLORS);

		press(rows()[0].querySelector('.handle')!, 'ArrowDown');
		await element.updateComplete;
		typeInto(shadow.querySelectorAll('#rows > .row uui-input.value')[1], 'Crimson');

		expect(changes.at(-1)).toStrictEqual({ items: [{ value: 'Green' }, { value: 'Crimson' }, { value: 'Blue' }] });
	});

	it('starts from no configuration, and keeps settings and item fields it does not edit', async () => {
		const empty = await render(null);
		expect(empty.values()).toStrictEqual([]);
		click(empty.shadow.querySelector('uui-button#add')!);
		expect(empty.changes).toStrictEqual([{ items: [{ value: '' }] }]);

		const other = await render({ items: [{ value: 'Red', note: 'warm' }], sortOrder: 'manual' });
		typeInto(other.shadow.querySelector('#rows > .row uui-input.value')!, 'Rose');
		expect(other.changes).toStrictEqual([{ items: [{ value: 'Rose', note: 'warm' }], sortOrder: 'manual' }]);
	});

	it('shows a configuration set from outside, such as after a save', async () => {
		const { element, values } = await render(COLORS);

		element.value = { items: [{ value: 'Black' }] };
		await element.updateComplete;

		expect(values()).toStrictEqual(['Black']);
	});

	it('changes nothing when read-only', async () => {
		const { shadow, rows } = await render(COLORS, true);

		expect(shadow.querySelector('uui-button#add')).toBeNull();
		expect(shadow.querySelectorAll('uui-button.remove')).toHaveLength(0);
		expect(rows()[0].querySelector('.handle')).toBeNull();
		expect([...shadow.querySelectorAll('uui-input.value')].every((input) => input.hasAttribute('readonly'))).toBe(true);
	});
});
