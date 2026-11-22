import { expect, type Locator, type Page } from '@playwright/test';

/** The Formulate trees, as the section's sidebar shows them. */
export const TREES = [
	{
		label: 'Forms',
		apiAlias: 'forms',
		rootEntityType: 'formulate-forms-root',
		folderEntityType: 'formulate-form-folder',
	},
	{
		label: 'Data Values',
		apiAlias: 'data-values',
		rootEntityType: 'formulate-data-values-root',
		folderEntityType: 'formulate-data-values-folder',
	},
	{
		label: 'Validation Library',
		apiAlias: 'validations',
		rootEntityType: 'formulate-validations-root',
		folderEntityType: 'formulate-validation-folder',
	},
] as const;

/** The section's sidebar, which holds the trees. */
export function sidebar(page: Page): Locator {
	return page.locator('umb-section-sidebar');
}

/** A tree's root or any item under it, by its name. */
export function treeItem(scope: Locator, name: string): Locator {
	return scope.locator(`uui-menu-item[label="${name}"]`);
}

/** Shows a tree item's children, unless they are shown already. */
export async function expandTreeItem(item: Locator) {
	if (!(await item.evaluate((element) => (element as HTMLElement & { showChildren?: boolean }).showChildren))) {
		await item.locator('#caret-button').first().click();
	}

	await expect.poll(() => item.evaluate((element) => (element as HTMLElement & { showChildren?: boolean }).showChildren)).toBe(true);
}

/**
 * Runs one of a tree item's actions from its "..." menu, as a user would.
 * @param item The tree item.
 * @param label The action's label, such as Rename. An action that opens a dialog shows it with an ellipsis.
 */
export async function runEntityAction(item: Locator, label: string) {
	// The item's own actions, not those of the items under it.
	const actions = item.locator(':scope > umb-entity-actions-bundle');

	await item.locator('#label-button').first().hover();
	await actions.locator('umb-entity-actions-dropdown').click();
	await actions
		.locator('umb-entity-action-list')
		.getByRole('button', { name: new RegExp(`^${label}(…|\\.\\.\\.)?$`) })
		.click();
}

/** The direct children of a tree item, by name. */
export async function childNames(item: Locator): Promise<Array<string | null>> {
	const names: Array<string | null> = [];
	for (const child of await item.locator(':scope > umb-tree-item').all()) {
		names.push(await child.locator('uui-menu-item').first().getAttribute('label'));
	}

	return names;
}

/** Confirms a delete in Umbraco's confirm dialog, after checking what it says. */
export async function confirmDelete(page: Page, text: string) {
	const dialog = page.locator('umb-confirm-modal');
	await expect(dialog).toContainText(text);
	await dialog.locator('uui-button#confirm').click();
	await expect(dialog).toHaveCount(0);
}
