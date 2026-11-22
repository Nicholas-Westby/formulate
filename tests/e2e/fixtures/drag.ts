import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Drags a row of a sortable list by its handle to the top of the list, as a hand does. Umbraco's sorter moves
 * the row while it is dragged, so the row is held over the top until it shows there. The pointer then moves
 * a little more before the drop: the browser accepts a drop only when the last drag event was a dragover
 * the sorter took, and the first event after the rows move under the pointer is a dragenter, which the
 * sorter leaves alone. (A hand never stops dead the moment the row moves; a test does.)
 * @param page The page.
 * @param row The row to drag, which has a .handle.
 * @param rows The list's rows.
 * @param readOrder Reads what shows the rows' order, such as their names.
 * @param expected What readOrder gives once the row shows at the top.
 */
export async function dragRowToTop(
	page: Page,
	row: Locator,
	rows: Locator,
	readOrder: () => Promise<Array<string | null>>,
	expected: Array<string | null>,
) {
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
			return readOrder();
		})
		.toEqual(expected);
	for (let nudge = 1; nudge <= 3; nudge++) {
		await page.waitForTimeout(50);
		await page.mouse.move(x + nudge, to + 2);
	}
	await page.waitForTimeout(50);
	await page.mouse.up();
}
