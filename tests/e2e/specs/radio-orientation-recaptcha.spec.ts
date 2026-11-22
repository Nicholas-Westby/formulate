import type { Locator } from '@playwright/test';
import { KINDS, createKindItem } from '../fixtures/formulate-api.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { expect, test } from '../fixtures/seeded-page.ts';
import {
	cleanUp,
	createForm,
	createPage,
	fieldKind,
	findKinds,
	formField,
	openBackOffice,
	waitForPage,
	watchPage,
} from '../fixtures/site-forms.ts';
import { screenshotPath } from '../support/screenshots.ts';

test.use({ actionTimeout: 15_000 });

/** The top and left of each label of a list's items, in page pixels. */
async function itemBoxes(list: Locator) {
	const labels = list.locator('label');
	await expect(labels).toHaveCount(3);
	const boxes: Array<{ top: number; left: number }> = [];
	for (const label of await labels.all()) {
		const box = await label.boundingBox();
		expect(box, 'the item is laid out').not.toBeNull();
		boxes.push({ top: Math.round(box!.y), left: Math.round(box!.x) });
	}

	return boxes;
}

test('radio button lists are laid out in the orientation chosen, with the Basic theme', async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	await openBackOffice(page);
	const kinds = await findKinds(page);
	const items = await createKindItem(page, 'data-values', {
		name: 'Orientation sizes',
		kindId: KINDS.list,
		configuration: { items: [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }] },
	});
	const radio = fieldKind(kinds, 'Radio Button List');
	const extended = fieldKind(kinds, 'Extended Radio Button List');
	const field = (kind: typeof radio, name: string, alias: string, orientation: string | undefined) =>
		formField(kind, name, alias, { configuration: { dataValue: items, ...(orientation ? { orientation } : {}) } });
	const fields = [
		field(radio, 'Radio across', 'radioAcross', 'Horizontal'),
		field(radio, 'Radio down', 'radioDown', 'Vertical'),
		field(radio, 'Radio default', 'radioDefault', undefined),
		field(extended, 'Extended across', 'extendedAcross', 'Horizontal'),
		field(extended, 'Extended down', 'extendedDown', 'Vertical'),
	];
	const { formId, layoutId } = await createForm(page, kinds, { name: 'Orientation form', fields, handlers: [] });
	const created = await createPage(page, 'Orientation page', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);
		await expect(site.locator('form.formulate__form')).toBeVisible();
		await expect(site.locator('link[rel="stylesheet"][href*="basic"]')).toHaveCount(1);
		const list = (name: string) => site.locator('fieldset.formulate__field', { has: site.locator('legend', { hasText: name }) });

		// The class says the orientation, and a list with none chosen has neither class.
		await expect(list('Radio across')).toHaveClass(/formulate__field--radio-list--horizontal/);
		await expect(list('Radio down')).toHaveClass(/formulate__field--radio-list--vertical/);
		await expect(list('Radio default')).not.toHaveClass(/--(horizontal|vertical)/);
		await expect(list('Extended across')).toHaveClass(/formulate__field--extended-radio-list--horizontal/);
		await expect(list('Extended down')).toHaveClass(/formulate__field--extended-radio-list--vertical/);

		// The items of a horizontal list share a top and go left to right; a vertical list's stack.
		for (const name of ['Radio across', 'Extended across']) {
			const boxes = await itemBoxes(list(name));
			expect(new Set(boxes.map((x) => x.top)).size, `${name}: one line`).toBe(1);
			expect(boxes[1]!.left, `${name}: left to right`).toBeGreaterThan(boxes[0]!.left);
			expect(boxes[2]!.left).toBeGreaterThan(boxes[1]!.left);
		}
		for (const name of ['Radio down', 'Extended down']) {
			const boxes = await itemBoxes(list(name));
			expect(boxes[1]!.top, `${name}: stacked`).toBeGreaterThan(boxes[0]!.top);
			expect(boxes[2]!.top).toBeGreaterThan(boxes[1]!.top);
		}
		// A list with no orientation looks as the theme always showed it: its labels are inline, so they share a top.
		const unset = await itemBoxes(list('Radio default'));
		expect(new Set(unset.map((x) => x.top)).size, 'Radio default: inline, as before').toBe(1);
		expect(await list('Radio default').locator('label').first().evaluate((label) => getComputedStyle(label).display)).toBe('inline');
		await site.screenshot({ path: screenshotPath('radio-orientation.png'), fullPage: true });

		// On a narrow screen the horizontal list wraps instead of running off the page.
		await site.setViewportSize({ width: 180, height: 800 });
		const narrow = await itemBoxes(list('Radio across'));
		expect(new Set(narrow.map((x) => x.top)).size, 'wraps onto more than one line').toBeGreaterThan(1);
		expect(problems, 'no console errors').toEqual([]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
		await callManagementApi(page, 'DELETE', `/formulate/data-values/${items}`).catch(() => undefined);
	}
});

test('a reCAPTCHA field without a site key adds no Google script, makes no request to Google and warns once', async ({ page, context, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	await openBackOffice(page);
	const kinds = await findKinds(page);
	const captcha = formField(fieldKind(kinds, 'reCAPTCHA'), 'Prove it', 'proveIt');
	const second = formField(fieldKind(kinds, 'reCAPTCHA'), 'Prove it again', 'proveItAgain');
	const { formId, layoutId } = await createForm(page, kinds, { name: 'Keyless captcha form', fields: [captcha, second], handlers: [] });
	const created = await createPage(page, 'Keyless captcha page', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);
	const warnings: string[] = [];
	site.on('console', (message) => {
		if (message.type() === 'warning') {
			warnings.push(message.text());
		}
	});
	const requested: string[] = [];
	site.on('request', (request) => requested.push(request.url()));

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);
		await expect(site.locator('form.formulate__form')).toBeVisible();
		const wrappers = site.locator('.formulate__field--recaptcha');
		await expect(wrappers).toHaveCount(2);
		await expect(wrappers.first().locator('*')).toHaveCount(0);
		await site.waitForLoadState('networkidle');

		expect(await site.locator('script[src*="google.com"], script[src*="gstatic.com"]').count(), 'no Google script').toBe(0);
		const google = requested.filter((url) => /^https?:\/\/(www\.)?(google|gstatic)\.com\//.test(url) || /\.(google|gstatic)\.com\//.test(url));
		expect(google, 'no request to Google').toEqual([]);
		expect(requested.some((url) => url.includes('/App_Plugins/Formulate/PlainJavaScript/')), 'the renderer itself loaded').toBe(true);
		expect(warnings.filter((text) => text.includes('Formulate:Recaptcha:SiteKey')), 'one warning for the page').toHaveLength(1);
		expect(problems, 'no console errors').toEqual([]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
	}
});
