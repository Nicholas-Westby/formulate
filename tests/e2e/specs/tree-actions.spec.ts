import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures/login.ts';
import { createFolder, emptyTree } from '../fixtures/formulate-api.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { TREES, childNames, confirmDelete, expandTreeItem, runEntityAction, sidebar, treeItem } from '../fixtures/tree.ts';
import { screenshotPath } from '../support/screenshots.ts';

interface CreateOption {
	entityType: string;
	kindId?: string | null;
	name: string;
}

/** The ID of the plain Form kind, which the Forms root offers. */
async function getFormKindId(page: Page): Promise<string> {
	const options = await callManagementApi<Array<CreateOption>>(page, 'GET', '/formulate/tree/forms/create-options');
	const kindId = options.find((option) => option.entityType === 'formulate-form' && option.name === 'Form')?.kindId;
	expect(kindId, 'the Forms root offers the plain Form kind').toBeTruthy();

	return kindId!;
}

/** Creates a form through the API, in a folder or at the top of the Forms tree. */
async function createForm(page: Page, name: string, parentId?: string): Promise<string> {
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', {
		id,
		...(parentId ? { parentId } : {}),
		kindId: await getFormKindId(page),
		name,
		fields: [],
		handlers: [],
	});

	return id;
}

/** Creates a layout for a form through the API, of the first layout kind the form offers. */
async function createLayout(page: Page, formId: string, name: string): Promise<string> {
	const options = await callManagementApi<Array<CreateOption>>(
		page,
		'GET',
		`/formulate/tree/forms/create-options?parentId=${formId}`,
	);
	const kindId = options.find((option) => option.entityType === 'formulate-layout')?.kindId;
	expect(kindId, 'the form offers a layout kind').toBeTruthy();
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/layout', { id, formId, kindId, name });

	return id;
}

/** Picks the Folder option in the create dialog and names the new folder in Umbraco's folder dialog. */
async function createFolderInDialog(page: Page, name: string) {
	await page.locator('formulate-create-options-modal').locator('umb-ref-item[name="Folder..."]').click();
	const dialog = page.locator('umb-folder-create-modal');
	await dialog.locator('uui-input#name input').fill(name);
	await dialog.locator('uui-button#confirm').click();
	await expect(dialog).toHaveCount(0);
}

/** Names the folder anew in Umbraco's rename dialog, once the dialog shows its current name. */
async function renameFolderInDialog(page: Page, currentName: string, name: string) {
	const dialog = page.locator('umb-folder-update-modal');
	const input = dialog.locator('uui-input#name input');
	await expect(input).toHaveValue(currentName);
	await input.fill(name);
	await dialog.locator('uui-button#confirm').click();
	await expect(dialog).toHaveCount(0);
}

test.afterEach(async ({ page }) => {
	for (const tree of TREES) {
		await emptyTree(page, tree.apiAlias);
	}
});

for (const tree of TREES) {
	test(`folders in ${tree.label}: create, rename, nest, move to the top and delete`, async ({ page }) => {
		const suffix = randomUUID().slice(0, 8);
		const folder = `Folder ${suffix}`;
		const renamed = `Renamed ${suffix}`;
		const nested = `Nested ${suffix}`;
		await page.goto('/umbraco/section/formulate');
		const root = treeItem(sidebar(page), tree.label);

		// Create a folder at the top of the tree.
		await runEntityAction(root, 'Create');
		const createDialog = page.locator('formulate-create-options-modal');
		// The folder comes last, as in Umbraco's own create dialog.
		await expect(createDialog.locator('umb-ref-item').last()).toHaveAttribute('name', 'Folder...');
		if (tree.apiAlias === 'forms') {
			await expect(createDialog.locator('umb-ref-item')).toHaveCount(3);
			await page.screenshot({ path: screenshotPath('create-options.png'), animations: 'disabled' });
		}
		// Cancelling the folder dialog comes back to the create dialog, as in Umbraco.
		await createDialog.locator('umb-ref-item[name="Folder..."]').click();
		await page.locator('umb-folder-create-modal uui-button#cancel').click();
		await expect(page.locator('umb-folder-create-modal')).toHaveCount(0);
		await expect(createDialog.locator('umb-ref-item[name="Folder..."]')).toBeVisible();
		await createFolderInDialog(page, folder);

		// The root gets an expand arrow, and the folder shows in it.
		await expandTreeItem(root);
		const folderItem = treeItem(root, folder);
		await expect(folderItem).toBeVisible();

		// Rename it.
		await runEntityAction(folderItem, 'Rename');
		await renameFolderInDialog(page, folder, renamed);
		const renamedItem = treeItem(root, renamed);
		await expect(renamedItem).toBeVisible();
		await expect(treeItem(root, folder)).toHaveCount(0);

		// Create a folder in it.
		await runEntityAction(renamedItem, 'Create');
		await createFolderInDialog(page, nested);
		await expandTreeItem(renamedItem);
		const nestedItem = treeItem(renamedItem, nested);
		await expect(nestedItem).toBeVisible();

		// Move the nested folder to the top of the tree.
		await runEntityAction(nestedItem, 'Move to');
		const picker = page.locator('umb-tree-picker-modal');
		await expect(picker).toBeVisible();
		await expect(picker.locator(`uui-menu-item[label="${tree.label}"]`)).toBeVisible();
		const move = picker.locator('uui-button[label="Move"]');
		await picker.locator(`uui-menu-item[label="${tree.label}"]`).locator('#label-button').first().click();
		if (tree.apiAlias === 'forms') {
			// The dialog slides in from the right, and Move turns on once a place is picked; the screenshot
			// waits for both and finishes their transitions.
			await expect(move).not.toHaveAttribute('disabled');
			await expect(move).toBeInViewport({ ratio: 1 });
			await page.screenshot({ path: screenshotPath('move.png'), animations: 'disabled' });
		}
		await move.click();
		await expect(picker).toHaveCount(0);
		await expect.poll(() => childNames(root)).toEqual(expect.arrayContaining([renamed, nested]));
		await expect.poll(() => childNames(renamedItem)).toEqual([]);

		// Delete the renamed folder, after confirming.
		await runEntityAction(renamedItem, 'Delete');
		await confirmDelete(page, `Are you sure you want to delete ${renamed}? Everything in the folder is deleted with it.`);
		await expect(treeItem(root, renamed)).toHaveCount(0);
		await expect(treeItem(root, nested)).toBeVisible();
	});
}

for (const tree of TREES) {
	test(`a folder in ${tree.label} opens in a workspace that renames it`, async ({ page }) => {
		await page.goto('/umbraco/section/formulate');
		const folderId = await createFolder(page, tree.apiAlias, 'Archive');
		await page.reload();
		const root = treeItem(sidebar(page), tree.label);
		await expandTreeItem(root);

		await treeItem(root, 'Archive').locator('#label-button').first().click();

		await expect(page).toHaveURL(`/umbraco/section/formulate/workspace/${tree.folderEntityType}/edit/${folderId}`);
		const name = page.locator('umb-folder-workspace-editor').locator('uui-input#nameInput input');
		await expect(name).toHaveValue('Archive');
		await name.fill('Old archive');
		// The footer says where the folder is, with the name being typed, and the page lists what is in it.
		await expect(page.locator('umb-workspace-breadcrumb uui-breadcrumb-item')).toHaveText([tree.label, 'Old archive']);
		await expect(page.locator('umb-tree-workspace-view').getByText('No items')).toBeVisible();
		if (tree.apiAlias === 'forms') {
			await page.screenshot({ path: screenshotPath('folder-workspace.png'), animations: 'disabled' });
		}
		await page.locator('umb-workspace-action uui-button[label="Save"]').click();
		await expect(treeItem(root, 'Old archive')).toBeVisible();
		await expect(treeItem(root, 'Archive')).toHaveCount(0);
	});
}

for (const tree of TREES) {
	test(`a nested folder in ${tree.label} opened by its URL shows where it is, in the tree and the breadcrumb`, async ({
		page,
	}) => {
		await page.goto('/umbraco/section/formulate');
		const outerId = await createFolder(page, tree.apiAlias, 'Outer');
		const innerId = await createFolder(page, tree.apiAlias, 'Inner', outerId);

		await page.goto(`/umbraco/section/formulate/workspace/${tree.folderEntityType}/edit/${innerId}`);

		// The tree opens down to the folder and highlights it.
		const inner = treeItem(treeItem(treeItem(sidebar(page), tree.label), 'Outer'), 'Inner');
		await expect(inner).toBeVisible();
		await expect(inner).toHaveAttribute('active');
		// The footer's breadcrumb shows the path to it.
		await expect(page.locator('umb-workspace-breadcrumb uui-breadcrumb-item')).toHaveText([tree.label, 'Outer', 'Inner']);
		if (tree.apiAlias === 'forms') {
			await page.screenshot({ path: screenshotPath('breadcrumb.png'), animations: 'disabled' });
		}
	});
}

for (const tree of TREES) {
	test(`the top of ${tree.label} and its folders list what is in them, as Umbraco's trees do`, async ({ page }) => {
		await page.goto('/umbraco/section/formulate');
		const outerId = await createFolder(page, tree.apiAlias, 'Outer');
		await createFolder(page, tree.apiAlias, 'Inner', outerId);
		const workspace = page.locator('umb-workspace-editor');
		const children = workspace.locator('umb-tree-workspace-view umb-tree');

		await page.goto(`/umbraco/section/formulate/workspace/${tree.rootEntityType}`);
		await expect(treeItem(children, 'Outer')).toBeVisible();
		await expect(workspace.getByText('Not found')).toHaveCount(0);

		await page.goto(`/umbraco/section/formulate/workspace/${tree.folderEntityType}/edit/${outerId}`);
		await expect(treeItem(children, 'Inner')).toBeVisible();
		await expect(workspace.getByText('Not found')).toHaveCount(0);
	});
}

for (const tree of TREES) {
	test(`the top of ${tree.label} and its folders have a Create button above their list, as Umbraco's trees do`, async ({
		page,
	}) => {
		await page.goto('/umbraco/section/formulate');
		const outerId = await createFolder(page, tree.apiAlias, 'Outer');
		const view = page.locator('umb-workspace-editor umb-tree-workspace-view');
		const create = view.locator('umb-tree-create-action-button');
		const menu = create.locator('uui-popover-container');

		// The kinds, then the folder, as in the create dialog; each asks for more.
		await page.goto(`/umbraco/section/formulate/workspace/${tree.rootEntityType}`);
		await create.locator('uui-button[label="Create"]').click();
		await expect(menu.locator('uui-menu-item').last()).toHaveAttribute('label', 'Folder...');
		expect(await menu.locator('uui-menu-item').count()).toBeGreaterThan(1);
		await menu.locator('uui-menu-item[label="Folder..."] #label-button').click();
		const dialog = page.locator('umb-folder-create-modal');
		await dialog.locator('uui-input#name input').fill('Made here');
		await dialog.locator('uui-button#confirm').click();
		await expect(dialog).toHaveCount(0);
		await expect(treeItem(view.locator('umb-tree'), 'Made here')).toBeVisible();

		// A folder's page has one too, for what goes in the folder.
		await page.goto(`/umbraco/section/formulate/workspace/${tree.folderEntityType}/edit/${outerId}`);
		await create.locator('uui-button[label="Create"]').click();
		await expect(menu.locator('uui-menu-item').last()).toHaveAttribute('label', 'Folder...');
	});
}

test('a kind picked in the create dialog opens the create route of its workspace', async ({ page }) => {
	const formKindId = await (async () => {
		await page.goto('/umbraco/section/formulate');
		return getFormKindId(page);
	})();

	await runEntityAction(treeItem(sidebar(page), 'Forms'), 'Create');
	const form = page.locator('formulate-create-options-modal').locator('umb-ref-item[name="Form..."]');
	// A link, as in Umbraco's create dialog, so it can also be opened in a new tab.
	await expect(form).toHaveAttribute(
		'href',
		`section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${formKindId}`,
	);
	await form.click();

	await expect(page).toHaveURL(
		`/umbraco/section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${formKindId}`,
	);
});

test('renaming a folder deleted elsewhere says it is gone, drops it from the tree and leaves its workspace', async ({
	page,
}) => {
	await page.goto('/umbraco/section/formulate');
	const folderId = await createFolder(page, 'validations', 'Old rules');
	await page.goto(`/umbraco/section/formulate/workspace/formulate-validation-folder/edit/${folderId}`);
	const name = page.locator('umb-folder-workspace-editor').locator('uui-input#nameInput input');
	await expect(name).toHaveValue('Old rules');
	const folder = treeItem(treeItem(sidebar(page), 'Validation Library'), 'Old rules');
	await expect(folder).toBeVisible();
	// Someone else deletes it; this workspace still shows it.
	await callManagementApi(page, 'DELETE', `/formulate/folder/${folderId}`);

	await name.fill('Older rules');
	await page.locator('umb-workspace-action uui-button[label="Save"]').click();

	await expect(
		page.locator('uui-toast-notification').getByText('This item no longer exists. Someone may have deleted it.'),
	).toBeVisible();
	await expect(folder).toHaveCount(0);
	// As after a delete, the workspace leaves, without asking to discard a name that cannot be saved.
	await expect(page).toHaveURL('/umbraco/section/formulate');
	await expect(page.locator('umb-discard-changes-modal')).toHaveCount(0);
});

test('creating in a folder deleted elsewhere says it is gone and drops it from the tree', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const folderId = await createFolder(page, 'forms', 'Gone');
	await page.reload();
	const root = treeItem(sidebar(page), 'Forms');
	await expandTreeItem(root);
	const folder = treeItem(root, 'Gone');
	await expect(folder).toBeVisible();
	// Someone else deletes it; this tree still shows it.
	await callManagementApi(page, 'DELETE', `/formulate/folder/${folderId}`);

	await runEntityAction(folder, 'Create');

	// The toast (its text is also announced to screen readers, in a hidden live region).
	await expect(
		page.locator('uui-toast-notification').getByText('This item no longer exists. Someone may have deleted it.'),
	).toBeVisible();
	await expect(folder).toHaveCount(0);
	await expect(page.locator('formulate-create-options-modal')).toHaveCount(0);
});

test('a form is duplicated next to the original', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const folderId = await createFolder(page, 'forms', 'Contact forms');
	await createForm(page, 'Contact', folderId);
	await page.reload();
	const root = treeItem(sidebar(page), 'Forms');
	await expandTreeItem(root);
	const folder = treeItem(root, 'Contact forms');
	await expandTreeItem(folder);

	await runEntityAction(treeItem(folder, 'Contact'), 'Duplicate');

	await expect.poll(() => childNames(folder)).toEqual(['Contact', 'Contact (copy)']);
});

test('deleting a form takes its layouts out of the tree with it', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const formId = await createForm(page, 'Signup');
	const layoutId = await createLayout(page, formId, 'Signup layout');
	await page.reload();
	const root = treeItem(sidebar(page), 'Forms');
	await expandTreeItem(root);
	const form = treeItem(root, 'Signup');
	await expandTreeItem(form);
	await expect(treeItem(form, 'Signup layout')).toBeVisible();

	await runEntityAction(form, 'Delete');
	await confirmDelete(page, 'Are you sure you want to delete Signup? Its layouts are deleted with it.');

	await expect(form).toHaveCount(0);
	await expect(treeItem(sidebar(page), 'Signup layout')).toHaveCount(0);
	// The layout is gone from the API too, so it does not come back when the tree reloads.
	await expect(callManagementApi(page, 'GET', `/formulate/layout/${layoutId}`)).rejects.toThrow('answered 404');
});

test('deleting the open form, or the folder it is in, leaves its workspace for the section', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const folderId = await createFolder(page, 'forms', 'Old forms');
	const formId = await createForm(page, 'Old contact', folderId);
	const otherFormId = await createForm(page, 'Other contact');

	// The form's workspace comes in a later task; its path is enough here.
	await page.goto(`/umbraco/section/formulate/workspace/formulate-form/edit/${otherFormId}`);
	const root = treeItem(sidebar(page), 'Forms');
	await expandTreeItem(root);
	await runEntityAction(treeItem(root, 'Other contact'), 'Delete');
	await confirmDelete(page, 'Are you sure you want to delete Other contact? Its layouts are deleted with it.');
	await expect(page).toHaveURL('/umbraco/section/formulate');

	await page.goto(`/umbraco/section/formulate/workspace/formulate-form/edit/${formId}`);
	await expandTreeItem(root);
	await runEntityAction(treeItem(root, 'Old forms'), 'Delete');
	await confirmDelete(page, 'Are you sure you want to delete Old forms?');
	await expect(page).toHaveURL('/umbraco/section/formulate');
});
