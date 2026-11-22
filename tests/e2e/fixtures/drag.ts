import { isDeepStrictEqual } from 'node:util';
import { expect, type Locator, type Page } from '@playwright/test';

/** A point on the page, in CSS pixels from its top left corner. */
export interface Point {
	x: number;
	y: number;
}

/**
 * Drags an item of one of Umbraco's sortable lists by its handle, as a hand does. Umbraco's sorter moves the
 * item while it is dragged, so the pointer goes to the target and stays there, a pixel this way or that,
 * until the item shows where it should. The item is then dropped over its own handle, where it now shows:
 * there the sorter moves nothing, and no list inside the item (such as the cells of a layout's row) takes
 * the drop. The pointer gets there with a few small moves: the browser accepts a drop only when the last
 * drag event was a dragover the sorter took, and the first event after the items move under the pointer is
 * a dragenter, which the sorter leaves alone. (A hand never stops dead the moment the item moves; a test
 * does.)
 * @param page The page.
 * @param handle The handle of the item to drag.
 * @param target Where the pointer takes the item.
 * @param isDone Whether the item shows where it should.
 */
export async function drag(page: Page, handle: Locator, target: Point, isDone: () => Promise<boolean>) {
	const box = (await handle.boundingBox())!;
	const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	// The item the sorter drags, which it marks as the drag starts.
	const placeholder = page.locator('[drag-placeholder]');

	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	let grip: Point | undefined;
	for (let step = 1; step <= 10; step++) {
		await page.mouse.move(from.x + ((target.x - from.x) * step) / 10, from.y + ((target.y - from.y) * step) / 10);
		if (!grip) {
			// Where the handle is in the item, before anything moves.
			await expect(placeholder).toHaveCount(1);
			const item = (await placeholder.boundingBox())!;
			grip = { x: from.x - item.x, y: from.y - item.y };
		}
		await page.waitForTimeout(20);
	}
	let wiggle = 0;
	await expect
		.poll(async () => {
			if (await isDone()) {
				return true;
			}
			await page.mouse.move(target.x + (wiggle++ % 2), target.y);
			return isDone();
		})
		.toBe(true);
	const shown = (await placeholder.boundingBox())!;
	for (let nudge = 0; nudge < 3; nudge++) {
		await page.waitForTimeout(50);
		await page.mouse.move(shown.x + grip!.x + nudge, shown.y + grip!.y);
	}
	await page.waitForTimeout(50);
	await page.mouse.up();
	await expect(placeholder).toHaveCount(0);
}

/**
 * Drags a row of a sortable list by its handle to the top of the list (see {@link drag}).
 * @param page The page.
 * @param handle The handle of the row to drag.
 * @param rows The list's rows.
 * @param readOrder Reads what shows the rows' order, such as their names.
 * @param expected What readOrder gives once the row shows at the top.
 */
export async function dragRowToTop<T>(page: Page, handle: Locator, rows: Locator, readOrder: () => Promise<T>, expected: T) {
	const from = (await handle.boundingBox())!;
	const top = (await rows.first().boundingBox())!;

	await drag(page, handle, { x: from.x + from.width / 2, y: top.y + 4 }, async () => isDeepStrictEqual(await readOrder(), expected));
	await expect.poll(readOrder).toEqual(expected);
}
