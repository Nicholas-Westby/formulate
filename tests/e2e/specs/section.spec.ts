import { join } from 'node:path';
import { expect, test } from '../fixtures/login.js';

const TREES = [
	{ label: 'Forms', apiAlias: 'forms', rootEntityType: 'formulate-forms-root' },
	{ label: 'Data Values', apiAlias: 'data-values', rootEntityType: 'formulate-data-values-root' },
	{ label: 'Validation Library', apiAlias: 'validations', rootEntityType: 'formulate-validations-root' },
];

test('the Formulate section shows the welcome dashboard and the three trees', async ({ page }) => {
	// Each root reads one item of its tree, to learn whether it has anything to expand.
	const rootReads = TREES.map((tree) =>
		page.waitForResponse(
			(response) => new URL(response.url()).pathname === `/umbraco/management/api/v1/formulate/tree/${tree.apiAlias}/root`,
		),
	);
	await page.goto('/umbraco/section/formulate');

	const dashboard = page.locator('formulate-welcome-dashboard');
	await expect(dashboard.getByRole('heading', { name: 'Welcome to Formulate' })).toBeVisible();
	await expect(dashboard.getByText('Formulate 5.0.0')).toBeVisible();

	const sidebar = page.locator('umb-section-sidebar');
	for (const [index, tree] of TREES.entries()) {
		const response = await rootReads[index]!;
		expect(response.status()).toBe(200);
		expect(new URL(response.url()).searchParams.get('take')).toBe('1');
		expect(await response.json()).toMatchObject({ total: 0, items: [] });

		// The site is new, so no tree has anything to expand.
		const root = sidebar.locator(`uui-menu-item[label="${tree.label}"]`);
		await expect(root).toBeVisible();
		await expect(root.locator('#caret-button')).toHaveCount(0);
		await expect(root.locator('umb-tree-item')).toHaveCount(0);
	}

	await page.screenshot({ path: join(import.meta.dirname, '..', 'screenshots', 'section.png') });
});

test('selecting a tree root opens a page with the tree name', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const sidebar = page.locator('umb-section-sidebar');

	for (const tree of TREES) {
		await sidebar.locator(`uui-menu-item[label="${tree.label}"]`).locator('#label-button').click();

		await expect(page).toHaveURL(new RegExp(`/umbraco/section/formulate/workspace/${tree.rootEntityType}$`));
		await expect(page.locator('umb-workspace-editor').getByRole('heading', { name: tree.label })).toBeVisible();
	}
});
