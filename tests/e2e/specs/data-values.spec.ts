import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { KINDS, createFolder, createKindItem, emptyTree, storeLegacyDataValues } from '../fixtures/formulate-api.ts';
import {
	WORKSPACE_URL,
	editUrl,
	idInUrl,
	kindItemWorkspace,
	valuesOf,
	waitForNameFocus,
} from '../fixtures/kind-item-workspace.ts';
import { expect, test } from '../fixtures/login.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { runEntityAction, sidebar, treeItem } from '../fixtures/tree.ts';

const SCREENSHOTS = join(import.meta.dirname, '..', 'screenshots');

/** Opens the create dialog of the top of the Data Values tree and picks a kind. */
async function createAtTheTop(page: Page, kindName: string) {
	await page.goto('/umbraco/section/formulate');
	await runEntityAction(treeItem(sidebar(page), 'Data Values'), 'Create');
	await page.locator('formulate-create-options-modal').locator(`umb-ref-item[name="${kindName}..."]`).click();
}

/**
 * Drags a row of a list editor by its handle to the top of the list, as a hand does. Umbraco's sorter moves
 * the row while it is dragged, so the row is held over the top until it shows there. The pointer then moves
 * a little more before the drop: the browser accepts a drop only when the last drag event was a dragover
 * the sorter took, and the first event after the rows move under the pointer is a dragenter, which the
 * sorter leaves alone. (A hand never stops dead the moment the row moves; a test does.)
 * @param page The page.
 * @param row The row to drag.
 * @param rows The list's rows.
 * @param values The inputs whose values show the order.
 * @param expected The values in the order the drag leaves them.
 */
async function dragRowToTop(page: Page, row: Locator, rows: Locator, values: Locator, expected: Array<string>) {
	const handle = (await row.locator('.handle').boundingBox())!;
	const top = (await rows.first().boundingBox())!;
	const x = handle.x + handle.width / 2;
	const from = handle.y + handle.height / 2;
	const to = top.y + 4;

	await page.mouse.move(x, from);
	await page.mouse.down();
	for (let step = 1; step <= 10; step++) {
		await page.mouse.move(x, from + ((to - from) * step) / 10);
		await page.waitForTimeout(20);
	}
	// Stay over the top row, a pixel this way or that, until the row shows there.
	let wiggle = 0;
	await expect
		.poll(async () => {
			await page.mouse.move(x, to + (wiggle++ % 2));
			return valuesOf(values);
		})
		.toEqual(expected);
	for (let nudge = 1; nudge <= 3; nudge++) {
		await page.waitForTimeout(50);
		await page.mouse.move(x + nudge, to + 2);
	}
	await page.waitForTimeout(50);
	await page.mouse.up();
}

test.afterEach(async ({ page }) => {
	await emptyTree(page, 'data-values');
});

test('a List is created from the create dialog, sorted, and keeps its items after a reload', async ({ page }) => {
	await createAtTheTop(page, 'List');

	await expect(page).toHaveURL(
		`${WORKSPACE_URL}/formulate-data-values/create/parent/formulate-data-values-root/null/${KINDS.list}`,
	);
	const { name, alias, box, save } = kindItemWorkspace(page);
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	const editor = box.locator('formulate-list-data-values-editor');
	const rows = editor.locator('#rows > .row');
	const values = rows.locator('uui-input.value input');
	await expect(box).toHaveAttribute('headline', 'List');
	await expect(rows).toHaveCount(0);

	await name.fill('Colors');
	await expect(alias).toHaveValue('colors');
	for (const color of ['Red', 'Green', 'Blue', 'Yellow']) {
		await editor.locator('uui-button#add').click();
		await values.last().fill(color);
	}
	await expect.poll(() => valuesOf(values)).toEqual(['Red', 'Green', 'Blue', 'Yellow']);

	// Sort with the keyboard: the up arrow on a row's handle moves it up.
	await rows.nth(2).locator('.handle').press('ArrowUp');
	await expect.poll(() => valuesOf(values)).toEqual(['Red', 'Blue', 'Green', 'Yellow']);
	// Sort by dragging the handle, with Umbraco's sorter.
	await dragRowToTop(page, rows.nth(3), rows, values, ['Yellow', 'Red', 'Blue', 'Green']);
	await expect.poll(() => valuesOf(values)).toEqual(['Yellow', 'Red', 'Blue', 'Green']);
	// Remove one.
	await editor.locator('uui-button.remove[label="Remove Green"]').click();
	await expect.poll(() => valuesOf(values)).toEqual(['Yellow', 'Red', 'Blue']);
	await save.click();

	// Saved: the edit URL, the item at the top of the tree, and the items in the order shown.
	await expect(page).toHaveURL(editUrl('formulate-data-values'));
	const id = idInUrl(page, 'formulate-data-values');
	await expect(treeItem(treeItem(sidebar(page), 'Data Values'), 'Colors')).toBeVisible();
	expect(await callManagementApi(page, 'GET', `/formulate/data-values/${id}`)).toMatchObject({
		name: 'Colors',
		kindId: KINDS.list,
		isLegacy: false,
		configuration: { items: [{ value: 'Yellow' }, { value: 'Red' }, { value: 'Blue' }] },
	});

	await page.reload();
	await expect(name).toHaveValue('Colors');
	await expect.poll(() => valuesOf(values)).toEqual(['Yellow', 'Red', 'Blue']);
	await page.screenshot({ path: join(SCREENSHOTS, 'data-values-list.png'), animations: 'disabled' });
});

test('a Pair List is created with a value and a label per item, and keeps them after a reload', async ({ page }) => {
	await createAtTheTop(page, 'Pair List');

	await expect(page).toHaveURL(
		`${WORKSPACE_URL}/formulate-data-values/create/parent/formulate-data-values-root/null/${KINDS.pairList}`,
	);
	const { name, box, save } = kindItemWorkspace(page);
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	const editor = box.locator('formulate-pair-list-data-values-editor');
	const rows = editor.locator('#rows > .row');
	await name.fill('Sizes');
	for (const [value, label] of [
		['s', 'Small'],
		['m', 'Medium'],
		['l', 'Large'],
	]) {
		await editor.locator('uui-button#add').click();
		await rows.last().locator('uui-input.primary input').fill(value);
		await rows.last().locator('uui-input.secondary input').fill(label);
	}
	// Each column says what it holds: the value is stored, the label is what visitors see.
	await expect(editor.locator('#headers .header')).toHaveText(['Value', 'Label']);
	await editor.locator('uui-button.remove[label="Remove Medium"]').click();
	await save.click();

	await expect(page).toHaveURL(editUrl('formulate-data-values'));
	const id = idInUrl(page, 'formulate-data-values');
	await expect(treeItem(treeItem(sidebar(page), 'Data Values'), 'Sizes')).toBeVisible();
	expect(await callManagementApi(page, 'GET', `/formulate/data-values/${id}`)).toMatchObject({
		name: 'Sizes',
		kindId: KINDS.pairList,
		configuration: {
			items: [
				{ primary: 's', secondary: 'Small' },
				{ primary: 'l', secondary: 'Large' },
			],
		},
	});

	await page.reload();
	await expect.poll(() => valuesOf(rows.locator('uui-input.primary input'))).toEqual(['s', 'l']);
	await expect.poll(() => valuesOf(rows.locator('uui-input.secondary input'))).toEqual(['Small', 'Large']);

	// Saved again with a changed label: the API keeps the change.
	await waitForNameFocus(page, name);
	await rows.nth(1).locator('uui-input.secondary input').fill('Extra large');
	await save.click();
	await expect
		.poll(async () => (await callManagementApi<{ configuration?: unknown }>(page, 'GET', `/formulate/data-values/${id}`)).configuration)
		.toEqual({
			items: [
				{ primary: 's', secondary: 'Small' },
				{ primary: 'l', secondary: 'Extra large' },
			],
		});
	await page.reload();
	await expect.poll(() => valuesOf(rows.locator('uui-input.secondary input'))).toEqual(['Small', 'Extra large']);
});

test('the US states are created with nothing to set, and stay that way after a reload', async ({ page }) => {
	await createAtTheTop(page, 'List of States and Territories in the United States');

	await expect(page).toHaveURL(
		`${WORKSPACE_URL}/formulate-data-values/create/parent/formulate-data-values-root/null/${KINDS.usStates}`,
	);
	const { name, box, save } = kindItemWorkspace(page);
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	const description = box.locator('formulate-dynamic-data-values-editor #description');
	await expect(box).toHaveAttribute('headline', 'List of States and Territories in the United States');
	// It says what the items are, as there is nothing to set.
	await expect(description).toHaveText(
		'The 50 states, Washington, D.C., American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands, in alphabetical order. Visitors see each name, such as Alabama; its two-letter postal code, such as AL, is what is stored. Formulate makes these items itself, so there is nothing to set here.',
	);
	await name.fill('States');
	await save.click();

	await expect(page).toHaveURL(editUrl('formulate-data-values'));
	const id = idInUrl(page, 'formulate-data-values');
	await expect(treeItem(treeItem(sidebar(page), 'Data Values'), 'States')).toBeVisible();
	const stored = await callManagementApi<{ name: string; kindId: string; configuration?: unknown }>(
		page,
		'GET',
		`/formulate/data-values/${id}`,
	);
	expect([stored.name, stored.kindId, stored.configuration ?? null]).toEqual(['States', KINDS.usStates, null]);

	await page.reload();
	await expect(name).toHaveValue('States');
	await expect(description).toBeVisible();

	// Saved again under a new name: still nothing to set, and the tree shows the new name.
	await name.fill('US states');
	await save.click();
	await expect(treeItem(treeItem(sidebar(page), 'Data Values'), 'US states')).toBeVisible();
	const saved = await callManagementApi<{ name: string; configuration?: unknown }>(page, 'GET', `/formulate/data-values/${id}`);
	expect([saved.name, saved.configuration ?? null]).toEqual(['US states', null]);
});

test('legacy data values open read-only', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const id = await storeLegacyDataValues(page, 'Old colors');

	await page.goto(`${WORKSPACE_URL}/formulate-data-values/edit/${id}`);

	const { name, box, save } = kindItemWorkspace(page);
	await expect(name).toHaveValue('Old colors');
	await expect(name).not.toBeEditable();
	await expect(box).toHaveAttribute('headline', 'Legacy');
	await expect(box.locator('formulate-legacy-data-values-editor #notice')).toHaveText(
		'These data values were made by an older version of Formulate and can no longer be changed. Create new data values to use instead.',
	);
	await expect(save).toHaveAttribute('disabled');
	await expect(treeItem(treeItem(sidebar(page), 'Data Values'), 'Old colors')).toHaveAttribute('active');
});

test('data values deleted elsewhere, opened by their URL, say they are gone and leave the workspace', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const id = await createKindItem(page, 'data-values', { name: 'Old sizes', kindId: KINDS.list });
	// Someone else deletes them; this link still leads to them.
	await callManagementApi(page, 'DELETE', `/formulate/data-values/${id}`);

	await page.goto(`${WORKSPACE_URL}/formulate-data-values/edit/${id}`);

	await expect(
		page.locator('uui-toast-notification').getByText('This item no longer exists. Someone may have deleted it.'),
	).toBeVisible();
	await expect(page).toHaveURL('/umbraco/section/formulate');
});

test('data values in a folder opened by their URL show where they are, in the tree and the breadcrumb', async ({
	page,
}) => {
	await page.goto('/umbraco/section/formulate');
	const outerId = await createFolder(page, 'data-values', 'Outer');
	const innerId = await createFolder(page, 'data-values', 'Inner', outerId);
	const id = await createKindItem(page, 'data-values', {
		name: 'Colors',
		kindId: KINDS.list,
		parentId: innerId,
		configuration: { items: [{ value: 'Red' }] },
	});

	await page.goto(`${WORKSPACE_URL}/formulate-data-values/edit/${id}`);

	// The tree opens down to the item and highlights it.
	const item = treeItem(treeItem(treeItem(treeItem(sidebar(page), 'Data Values'), 'Outer'), 'Inner'), 'Colors');
	await expect(item).toBeVisible();
	await expect(item).toHaveAttribute('active');
	// The footer's breadcrumb shows the path to it.
	await expect(kindItemWorkspace(page).breadcrumb).toHaveText(['Data Values', 'Outer', 'Inner', 'Colors']);
});
