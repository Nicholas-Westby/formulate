import { join } from 'node:path';
import { KINDS, createFolder, createKindItem, emptyTree } from '../fixtures/formulate-api.ts';
import { WORKSPACE_URL, editUrl, idInUrl, kindItemWorkspace, waitForNameFocus } from '../fixtures/kind-item-workspace.ts';
import { expect, test } from '../fixtures/login.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { confirmDelete, expandTreeItem, runEntityAction, sidebar, treeItem } from '../fixtures/tree.ts';

const SCREENSHOTS = join(import.meta.dirname, '..', 'screenshots');

test.afterEach(async ({ page }) => {
	await emptyTree(page, 'validations');
});

test('a Mandatory validation is created from the create dialog, and keeps its settings after a reload', async ({
	page,
}) => {
	await page.goto('/umbraco/section/formulate');
	const root = treeItem(sidebar(page), 'Validation Library');

	await runEntityAction(root, 'Create');
	await page.locator('formulate-create-options-modal').locator('umb-ref-item[name="Mandatory..."]').click();

	// The create route of the validation workspace, for the kind picked, at the top of the tree.
	await expect(page).toHaveURL(
		`${WORKSPACE_URL}/formulate-validation/create/parent/formulate-validations-root/null/${KINDS.mandatory}`,
	);
	const { name, alias, box, save } = kindItemWorkspace(page);
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	const editor = box.locator('formulate-mandatory-validation-editor');
	const message = editor.locator('uui-input#message input');
	const clientSideOnly = editor.locator('uui-toggle#client-side-only input');
	await expect(box).toHaveAttribute('headline', 'Mandatory');
	// The kind's default configuration.
	await expect(message).toHaveValue('');
	await expect(clientSideOnly).not.toBeChecked();

	await name.fill('Required field');
	// The alias follows the name until it is unlocked, as in Umbraco's own workspaces.
	await expect(alias).toHaveValue('requiredField');
	await message.fill('Please fill this in.');
	await editor.locator('uui-toggle#client-side-only').click();
	await save.click();

	// Saved: the workspace moves to the item's edit URL, and the tree shows it at the top.
	await expect(page).toHaveURL(editUrl('formulate-validation'));
	const id = idInUrl(page, 'formulate-validation');
	await expect(treeItem(root, 'Required field')).toBeVisible();
	expect(await callManagementApi(page, 'GET', `/formulate/validation/${id}`)).toMatchObject({
		name: 'Required field',
		alias: 'requiredField',
		kindId: KINDS.mandatory,
		configuration: { message: 'Please fill this in.', clientSideOnly: true },
	});

	await page.reload();
	await expect(name).toHaveValue('Required field');
	await expect(alias).toHaveValue('requiredField');
	await expect(message).toHaveValue('Please fill this in.');
	await expect(clientSideOnly).toBeChecked();
});

test("a Mandatory validation saved with its settings untouched stores its kind's default settings", async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const root = treeItem(sidebar(page), 'Validation Library');
	await runEntityAction(root, 'Create');
	await page.locator('formulate-create-options-modal').locator('umb-ref-item[name="Mandatory..."]').click();
	const { name, box, save } = kindItemWorkspace(page);
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	const editor = box.locator('formulate-mandatory-validation-editor');
	const message = editor.locator('uui-input#message input');
	const clientSideOnly = editor.locator('uui-toggle#client-side-only input');
	await expect(message).toHaveValue('');

	// Only the name, which every item needs; the settings stay as the kind gives them.
	await name.fill('Required');
	await save.click();

	await expect(page).toHaveURL(editUrl('formulate-validation'));
	const id = idInUrl(page, 'formulate-validation');
	const definitions = await callManagementApi<Array<{ kindId: string; defaultConfiguration?: unknown }>>(
		page,
		'GET',
		'/formulate/definition/validation',
	);
	const defaults = definitions.find((definition) => definition.kindId === KINDS.mandatory)?.defaultConfiguration;
	expect(defaults).toStrictEqual({ message: null, clientSideOnly: false });
	const stored = await callManagementApi<{ name: string; kindId: string; configuration?: unknown }>(
		page,
		'GET',
		`/formulate/validation/${id}`,
	);
	expect([stored.name, stored.kindId, stored.configuration]).toStrictEqual(['Required', KINDS.mandatory, defaults]);

	await page.reload();
	await expect(name).toHaveValue('Required');
	await expect(message).toHaveValue('');
	await expect(clientSideOnly).not.toBeChecked();
});

test('a Regular Expression validation is created in a folder, warns about a pattern browsers cannot read, and keeps its settings', async ({
	page,
}) => {
	await page.goto('/umbraco/section/formulate');
	const folderId = await createFolder(page, 'validations', 'Patterns');
	await page.reload();
	const root = treeItem(sidebar(page), 'Validation Library');
	await expandTreeItem(root);
	const folder = treeItem(root, 'Patterns');

	await runEntityAction(folder, 'Create');
	await page.locator('formulate-create-options-modal').locator('umb-ref-item[name="Regular Expression..."]').click();

	await expect(page).toHaveURL(
		`${WORKSPACE_URL}/formulate-validation/create/parent/formulate-validation-folder/${folderId}/${KINDS.regex}`,
	);
	const { name, alias, headerMessages, box, save } = kindItemWorkspace(page);
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	const editor = box.locator('formulate-regex-validation-editor');
	const pattern = editor.locator('uui-input#regex input');
	const message = editor.locator('uui-input#message input');
	const warning = editor.locator('#pattern-warning');
	await expect(box).toHaveAttribute('headline', 'Regular Expression');

	// A pattern browsers cannot read is warned about while it is typed.
	await pattern.fill('^(\\d{5}$');
	await expect(warning).toContainText('Browsers cannot read this regular expression');
	await pattern.fill('^\\d{5}$');
	await expect(warning).toHaveCount(0);
	await message.fill('Enter a five digit zip code.');

	// A name of spaces passes the browser's check. The API refuses it, and its reason shows on the name.
	await name.fill('   ');
	await save.click();
	await expect(headerMessages).toContainText('The name is required.');
	await expect(page).toHaveURL(/\/create\/parent\//);

	await name.fill('Zip code');
	await expect(headerMessages).not.toContainText('The name is required.');
	await expect(alias).toHaveValue('zipCode');
	await save.click();

	// Saved: the edit URL, and the item in the folder it was created in.
	await expect(page).toHaveURL(editUrl('formulate-validation'));
	const id = idInUrl(page, 'formulate-validation');
	await expandTreeItem(folder);
	await expect(treeItem(folder, 'Zip code')).toBeVisible();
	expect(await callManagementApi(page, 'GET', `/formulate/validation/${id}`)).toMatchObject({
		name: 'Zip code',
		alias: 'zipCode',
		parentId: folderId,
		kindId: KINDS.regex,
		configuration: { regex: '^\\d{5}$', message: 'Enter a five digit zip code.' },
	});

	await page.reload();
	await expect(name).toHaveValue('Zip code');
	await expect(pattern).toHaveValue('^\\d{5}$');
	await expect(message).toHaveValue('Enter a five digit zip code.');
	await expect(treeItem(treeItem(treeItem(sidebar(page), 'Validation Library'), 'Patterns'), 'Zip code')).toHaveAttribute(
		'active',
	);
	await page.screenshot({ path: join(SCREENSHOTS, 'validation.png'), animations: 'disabled' });

	// Deleting it from the tree takes it out of its folder, and leaves its workspace.
	await runEntityAction(treeItem(folder, 'Zip code'), 'Delete');
	await confirmDelete(page, 'Zip code');
	await expect(treeItem(folder, 'Zip code')).toHaveCount(0);
	await expect(page).toHaveURL('/umbraco/section/formulate');
});

test('a validation in a folder opened by its URL shows where it is, in the tree and the breadcrumb', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	const outerId = await createFolder(page, 'validations', 'Outer');
	const innerId = await createFolder(page, 'validations', 'Inner', outerId);
	const id = await createKindItem(page, 'validation', {
		name: 'Zip code',
		kindId: KINDS.regex,
		parentId: innerId,
		configuration: { regex: '^\\d{5}$', message: 'Enter a zip code.' },
	});

	await page.goto(`${WORKSPACE_URL}/formulate-validation/edit/${id}`);

	// The tree opens down to the validation and highlights it.
	const item = treeItem(treeItem(treeItem(treeItem(sidebar(page), 'Validation Library'), 'Outer'), 'Inner'), 'Zip code');
	await expect(item).toBeVisible();
	await expect(item).toHaveAttribute('active');
	// The footer's breadcrumb shows the path to it.
	await expect(kindItemWorkspace(page).breadcrumb).toHaveText(['Validation Library', 'Outer', 'Inner', 'Zip code']);
});

test('saving a validation deleted elsewhere says it is gone, drops it from the tree and leaves its workspace', async ({
	page,
}) => {
	await page.goto('/umbraco/section/formulate');
	const id = await createKindItem(page, 'validation', {
		name: 'Old rule',
		kindId: KINDS.mandatory,
		configuration: { message: 'Required.', clientSideOnly: false },
	});
	await page.goto(`${WORKSPACE_URL}/formulate-validation/edit/${id}`);
	const { name, save } = kindItemWorkspace(page);
	const item = treeItem(treeItem(sidebar(page), 'Validation Library'), 'Old rule');
	await expect(name).toHaveValue('Old rule');
	await expect(item).toBeVisible();
	// Someone else deletes it; this workspace still shows it.
	await callManagementApi(page, 'DELETE', `/formulate/validation/${id}`);

	await name.fill('Renamed rule');
	await save.click();

	// The toast (its text is also announced to screen readers, in a hidden live region).
	await expect(
		page.locator('uui-toast-notification').getByText('This item no longer exists. Someone may have deleted it.'),
	).toBeVisible();
	await expect(item).toHaveCount(0);
	// As after a delete, the workspace leaves, without asking to discard changes that cannot be saved.
	await expect(page).toHaveURL('/umbraco/section/formulate');
	await expect(page.locator('umb-discard-changes-modal')).toHaveCount(0);
});

test('leaving a validation with unsaved changes asks whether to discard them, and leaving an untouched one does not', async ({
	page,
}) => {
	await page.goto('/umbraco/section/formulate');
	const requiredId = await createKindItem(page, 'validation', {
		name: 'Required',
		kindId: KINDS.mandatory,
		configuration: { message: 'Fill this in.', clientSideOnly: false },
	});
	const zipCodeId = await createKindItem(page, 'validation', {
		name: 'Zip code',
		kindId: KINDS.regex,
		configuration: { regex: '^\\d{5}$', message: 'Enter a zip code.' },
	});
	await page.goto(`${WORKSPACE_URL}/formulate-validation/edit/${requiredId}`);
	const { name, box } = kindItemWorkspace(page);
	const message = box.locator('formulate-mandatory-validation-editor uui-input#message input');
	await expect(message).toHaveValue('Fill this in.');
	// Umbraco puts the focus in the name when the workspace opens (see waitForNameFocus).
	await waitForNameFocus(page, name);
	await message.fill('Please fill this in.');
	const root = treeItem(sidebar(page), 'Validation Library');
	const open = (itemName: string) => treeItem(root, itemName).locator('#label-button').first().click();
	const dialog = page.locator('umb-discard-changes-modal');

	await open('Zip code');

	// Umbraco's own dialog. Staying keeps the workspace, with the change.
	await expect(dialog.locator('uui-dialog-layout')).toHaveAttribute('headline', 'Discard unsaved changes');
	await dialog.locator('uui-button#cancel[label="Stay"]').click();
	await expect(dialog).toHaveCount(0);
	await expect(page).toHaveURL(`${WORKSPACE_URL}/formulate-validation/edit/${requiredId}`);
	await expect(message).toHaveValue('Please fill this in.');

	// Discarding goes on to the other validation, and leaves the first as it was saved.
	await open('Zip code');
	await dialog.locator('uui-button#confirm[label="Discard changes"]').click();
	await expect(page).toHaveURL(`${WORKSPACE_URL}/formulate-validation/edit/${zipCodeId}`);
	await expect(name).toHaveValue('Zip code');
	await expect(box.locator('formulate-regex-validation-editor uui-input#regex input')).toHaveValue('^\\d{5}$');
	expect(await callManagementApi(page, 'GET', `/formulate/validation/${requiredId}`)).toMatchObject({
		configuration: { message: 'Fill this in.', clientSideOnly: false },
	});

	// An untouched validation has nothing to discard: its editor changes nothing as it is shown.
	await open('Required');
	await expect(page).toHaveURL(`${WORKSPACE_URL}/formulate-validation/edit/${requiredId}`);
	await expect(message).toHaveValue('Fill this in.');
	await expect(dialog).toHaveCount(0);
});
