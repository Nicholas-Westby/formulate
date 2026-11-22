import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFormulateEnglish } from '../../../test/localization.js';
import { click, press, typeInto, valuesOf } from '../../../test/ui.js';
import { FormulatePairListDataValuesEditorElement } from './pair-list-data-values-editor.element.js';

/**
 * Shows the editor with a configuration, as the kind editor slot does, and records what it stores each
 * time it says it changed.
 */
async function render(value: unknown, readonly = false) {
	const element = new FormulatePairListDataValuesEditorElement();
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
	const pairs = () =>
		rows().map((row) => valuesOf(row.querySelectorAll('uui-input.primary, uui-input.secondary')));

	return { element, changes, shadow, rows, pairs };
}

const SIZES = {
	items: [
		{ primary: 's', secondary: 'Small' },
		{ primary: 'm', secondary: 'Medium' },
		{ primary: 'l', secondary: 'Large' },
	],
};

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate Pair List data values editor', () => {
	it('shows each item as a row with its value and label, under the column headers Value and Label', async () => {
		const { shadow, pairs } = await render(SIZES);

		// Without the back office's translations loaded, a term shows as its key.
		expect([...shadow.querySelectorAll('#headers .header')].map((header) => header.textContent?.trim())).toStrictEqual([
			'general_value',
			'general_label',
		]);
		expect(pairs()).toStrictEqual([
			['s', 'Small'],
			['m', 'Medium'],
			['l', 'Large'],
		]);
	});

	it("names each item's inputs and buttons after the item, in words a translation can order", async () => {
		loadFormulateEnglish();
		const { element, rows } = await render({
			items: [
				{ primary: 's', secondary: 'Small' },
				{ primary: 'm', secondary: '' },
				{ primary: '', secondary: '' },
			],
		});
		await element.updateComplete;
		const labels = (selector: string, attribute = 'label') =>
			rows().map((row) => row.querySelector(selector)!.getAttribute(attribute));

		expect(labels('uui-input.primary')).toStrictEqual(['Value of item 1', 'Value of item 2', 'Value of item 3']);
		expect(labels('uui-input.secondary')).toStrictEqual(['Label of item 1', 'Label of item 2', 'Label of item 3']);
		// An item is named by its label, else its value; an empty one by its place.
		expect(labels('uui-button.remove')).toStrictEqual(['Remove Small', 'Remove m', 'Remove item 3']);
		expect(labels('.handle', 'aria-label')).toStrictEqual(['Move Small', 'Move m', 'Move item 3']);
	});

	it('adds an empty item at the end and stores the exact shape', async () => {
		const { element, shadow, changes, pairs } = await render(SIZES);

		click(shadow.querySelector('uui-button#add')!);
		await element.updateComplete;

		expect(pairs().at(-1)).toStrictEqual(['', '']);
		expect(changes).toStrictEqual([{ items: [...SIZES.items, { primary: '', secondary: '' }] }]);
	});

	it("stores an item's new value and label as they are typed", async () => {
		const { rows, changes } = await render(SIZES);

		typeInto(rows()[1].querySelector('uui-input.primary')!, 'med');
		typeInto(rows()[1].querySelector('uui-input.secondary')!, 'Medium size');

		expect(changes).toStrictEqual([
			{ items: [SIZES.items[0], { primary: 'med', secondary: 'Medium' }, SIZES.items[2]] },
			{ items: [SIZES.items[0], { primary: 'med', secondary: 'Medium size' }, SIZES.items[2]] },
		]);
	});

	it('removes an item', async () => {
		const { element, rows, changes, pairs } = await render(SIZES);

		click(rows()[1].querySelector('uui-button.remove')!);
		await element.updateComplete;

		expect(pairs()).toStrictEqual([
			['s', 'Small'],
			['l', 'Large'],
		]);
		expect(changes).toStrictEqual([{ items: [SIZES.items[0], SIZES.items[2]] }]);
	});

	it('moves an item up and down with the arrow keys on its drag handle', async () => {
		const { element, rows, changes } = await render(SIZES);

		press(rows()[0].querySelector('.handle')!, 'ArrowDown');
		await element.updateComplete;
		press(rows()[2].querySelector('.handle')!, 'ArrowUp');
		await element.updateComplete;

		expect(changes).toStrictEqual([
			{ items: [SIZES.items[1], SIZES.items[0], SIZES.items[2]] },
			{ items: [SIZES.items[1], SIZES.items[2], SIZES.items[0]] },
		]);
	});

	it('starts from no configuration, and keeps settings and item fields it does not edit', async () => {
		const empty = await render(undefined);
		expect(empty.pairs()).toStrictEqual([]);
		click(empty.shadow.querySelector('uui-button#add')!);
		expect(empty.changes).toStrictEqual([{ items: [{ primary: '', secondary: '' }] }]);

		const other = await render({ items: [{ primary: 'x', secondary: 'X', group: 'letters' }], version: 2 });
		typeInto(other.rows()[0].querySelector('uui-input.secondary')!, 'Ex');
		expect(other.changes).toStrictEqual([{ items: [{ primary: 'x', secondary: 'Ex', group: 'letters' }], version: 2 }]);
	});

	it('changes nothing when read-only', async () => {
		const { shadow } = await render(SIZES, true);

		expect(shadow.querySelector('uui-button#add')).toBeNull();
		expect(shadow.querySelectorAll('uui-button.remove')).toHaveLength(0);
		expect(shadow.querySelectorAll('.handle')).toHaveLength(0);
		expect([...shadow.querySelectorAll('uui-input')].every((input) => input.hasAttribute('readonly'))).toBe(true);
	});
});
