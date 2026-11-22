import type { Locator, Page } from '@playwright/test';
import { screenshotPath } from '../support/screenshots.ts';

/**
 * Takes a screenshot of the page with the whole of a dialog's settings in view: the window is made as tall as the
 * settings need for the screenshot, then given its size back.
 * @param page The page.
 * @param editor The settings, such as a field's or a handler's editor, at the end of the dialog.
 * @param name The screenshot's file name (see screenshotPath).
 */
export async function screenshotDialog(page: Page, editor: Locator, name: string) {
	const viewport = page.viewportSize()!;
	await page.setViewportSize({ width: viewport.width, height: 3000 });
	const box = (await editor.boundingBox())!;
	// Room under the settings for the end of their box and the dialog's buttons.
	await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, Math.ceil(box.y + box.height) + 140) });
	await page.screenshot({ path: screenshotPath(name), animations: 'disabled' });
	await page.setViewportSize(viewport);
}
