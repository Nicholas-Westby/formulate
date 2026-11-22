import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { dragRowToTop } from '../fixtures/drag.ts';
import { KINDS, createKindItem, emptyTree } from '../fixtures/formulate-api.ts';
import { WORKSPACE_URL, waitForNameFocus } from '../fixtures/kind-item-workspace.ts';
import { expect, test } from '../fixtures/login.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { expandTreeItem, runEntityAction, sidebar, treeItem } from '../fixtures/tree.ts';
import { screenshotPath } from '../support/screenshots.ts';

/** The kinds of form, field and handler the tests use, by the IDs the API gives them. */
const FORM_KINDS = { withBasicLayout: '3a11bd58-0ac6-43d7-8f63-2f88e7c132af', plain: '61244083-bd75-417b-af77-dfa8f8dc2673' };
const FIELD_KINDS = {
	text: '17906580-86ea-440b-bc30-9e1b099f803b',
	dropDown: '6d3df157-1bc4-4fcf-b2b7-0a94fe719b47',
	checkboxList: '02dba5da-4b93-439e-b63f-43392e443dcf',
	richText: '6fcdfdc9-293f-4913-b762-f4ba502216eb',
	button: 'cde8565c-5e92-4112-9a1f-7ffa1940c53c',
};
const STORE_DATA = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';

/** The edit URL of a form, whichever of its views shows; captures the form's ID. */
const FORM_EDIT_URL = /\/workspace\/formulate-form\/edit\/([0-9a-f-]{36})(\/|$)/;

/** A form as the API gives it. */
interface StoredForm {
	name: string;
	alias?: string | null;
	fields: Array<{ id: string; kindId: string; name?: string | null; alias?: string | null; label?: string | null; validations: Array<string>; configuration?: unknown }>;
	handlers: Array<{ id: string; kindId: string; name?: string | null; alias?: string | null; enabled: boolean; configuration?: unknown }>;
}

/** The parts of the form workspace the tests use. */
function formWorkspace(page: Page) {
	const fieldsView = page.locator('formulate-form-fields-workspace-view');
	const handlersView = page.locator('formulate-form-handlers-workspace-view');

	return {
		name: page.locator('formulate-kind-item-workspace-header').getByRole('textbox', { name: 'Enter a name...', exact: true }),
		save: page.locator('umb-workspace-action uui-button[label="Save"]'),
		fieldsView,
		handlersView,
		/** The rows of the Fields view. */
		fieldRows: fieldsView.locator('.row'),
		handlerRows: handlersView.locator('.row'),
		/** The tab of a view, by its label. */
		tab: (label: string) => page.locator('umb-workspace-editor').getByRole('tab', { name: label }),
	};
}

/** The names of the rows of a view, in order. */
function namesOf(rows: Locator) {
	return rows.locator('uui-ref-node').evaluateAll((refs) => refs.map((ref) => ref.getAttribute('name')));
}

/** Picks an item in the tree picker a picker opened, such as a validation, and chooses it. */
async function pickInTree(page: Page, name: string) {
	const modal = page.locator('umb-tree-picker-modal');
	await modal.locator(`uui-menu-item[label="${name}"] #label-button`).first().click();
	await modal.getByRole('button', { name: 'Choose', exact: true }).click();
	await expect(modal).toHaveCount(0);
}

/** What a new field is given in its dialog. */
interface NewField {
	name: string;
	label?: string;
	validation?: string;
	dataValues?: string;
	buttonKind?: string;
	richText?: string;
	/** Takes a screenshot of the dialog, filled in, before it is submitted. */
	screenshot?: string;
}

/** Adds a field as a user does: Add field, the kind, then its dialog. */
async function addField(page: Page, kindName: string, field: NewField) {
	const { fieldsView } = formWorkspace(page);
	await fieldsView.getByRole('button', { name: 'Add field', exact: true }).click();
	const pick = page.locator('formulate-pick-kind-modal');
	await pick.getByRole('button', { name: kindName, exact: true }).click();
	await expect(pick).toHaveCount(0);

	const dialog = page.locator('formulate-edit-field-modal');
	const name = dialog.locator('umb-input-with-alias#name').getByRole('textbox', { name: 'Enter a name...', exact: true });
	await waitForNameFocus(page, name);
	await name.fill(field.name);

	if (field.label !== undefined) {
		await dialog.locator('uui-input#label input').fill(field.label);
	}

	if (field.validation) {
		await dialog.locator('formulate-validation-picker').getByRole('button', { name: 'Choose', exact: true }).click();
		await pickInTree(page, field.validation);
		await expect(dialog.locator(`formulate-validation-picker uui-ref-node[name="${field.validation}"]`)).toBeVisible();
	}

	if (field.dataValues) {
		await dialog.locator('formulate-data-values-picker').getByRole('button', { name: 'Choose', exact: true }).click();
		await pickInTree(page, field.dataValues);
		await expect(dialog.locator(`formulate-data-values-picker uui-ref-node[name="${field.dataValues}"]`)).toBeVisible();
	}

	if (field.buttonKind) {
		await dialog.locator('uui-select#button-kind select').selectOption(field.buttonKind);
	}

	if (field.richText) {
		const text = dialog.locator('umb-input-tiptap [contenteditable="true"]');
		await text.click();
		await page.keyboard.type(field.richText);
		await expect(text).toContainText(field.richText);
	}

	if (field.screenshot) {
		await page.screenshot({ path: screenshotPath(field.screenshot), animations: 'disabled' });
	}

	await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(dialog).toHaveCount(0);
}

test.afterEach(async ({ page }) => {
	await emptyTree(page, 'forms');
	await emptyTree(page, 'validations');
	await emptyTree(page, 'data-values');
});

test('the Contact form is designed with its fields and a handler, reordered, saved, and kept after a reload', async ({ page }) => {
	test.setTimeout(240_000);
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	const required = await createKindItem(page, 'validation', {
		name: 'Required',
		kindId: KINDS.mandatory,
		configuration: { message: 'Please fill this in.', clientSideOnly: false },
	});
	const emailAddress = await createKindItem(page, 'validation', {
		name: 'Email address',
		kindId: KINDS.regex,
		configuration: { regex: '^\\S+@\\S+$', message: 'Enter an email address.' },
	});
	const usStates = await createKindItem(page, 'data-values', { name: 'US States', kindId: KINDS.usStates });
	const interests = await createKindItem(page, 'data-values', {
		name: 'Interests',
		kindId: KINDS.list,
		configuration: { items: [{ value: 'News' }, { value: 'Offers' }] },
	});

	// "Form with Basic Layout" from the create dialog at the top of the Forms tree.
	const root = treeItem(sidebar(page), 'Forms');
	await runEntityAction(root, 'Create');
	await page.locator('formulate-create-options-modal').locator('umb-ref-item[name="Form with Basic Layout..."]').click();
	await expect(page).toHaveURL(
		`${WORKSPACE_URL}/formulate-form/create/parent/formulate-forms-root/null/${FORM_KINDS.withBasicLayout}`,
	);
	const workspace = formWorkspace(page);
	await waitForNameFocus(page, workspace.name);
	await workspace.name.fill('Contact');

	await addField(page, 'Text', { name: 'Name', label: 'Your name', validation: 'Required' });
	await addField(page, 'Text', { name: 'Email', label: 'Your email', validation: 'Email address' });
	await addField(page, 'Drop Down', { name: 'State', label: 'Your state', dataValues: 'US States', screenshot: 'field-editor.png' });
	await addField(page, 'Checkbox List', { name: 'Interests', label: 'Send me', dataValues: 'Interests' });
	await addField(page, 'Rich Text', { name: 'Intro', richText: 'Tell us about yourself.' });
	await addField(page, 'Button', { name: 'Submit', buttonKind: 'Submit' });
	await expect.poll(() => namesOf(workspace.fieldRows)).toEqual(['Name', 'Email', 'State', 'Interests', 'Intro', 'Submit']);

	// The rich text goes above the inputs, dragged by its handle.
	await dragRowToTop(page, workspace.fieldRows.nth(4), workspace.fieldRows, () => namesOf(workspace.fieldRows), [
		'Intro',
		'Name',
		'Email',
		'State',
		'Interests',
		'Submit',
	]);
	await expect.poll(() => namesOf(workspace.fieldRows)).toEqual(['Intro', 'Name', 'Email', 'State', 'Interests', 'Submit']);

	// A handler that stores each submission.
	await workspace.tab('Handlers').click();
	await workspace.handlersView.getByRole('button', { name: 'Add handler', exact: true }).click();
	await page.locator('formulate-pick-kind-modal').getByRole('button', { name: 'Store Data', exact: true }).click();
	const handlerDialog = page.locator('formulate-edit-handler-modal');
	const handlerName = handlerDialog.locator('umb-input-with-alias#name').getByRole('textbox', { name: 'Enter a name...', exact: true });
	await waitForNameFocus(page, handlerName);
	await handlerName.fill('Store submissions');
	await expect(handlerDialog.locator('formulate-store-data-handler-editor')).toContainText('Stores each submission');
	await handlerDialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(handlerDialog).toHaveCount(0);
	await expect.poll(() => namesOf(workspace.handlerRows)).toEqual(['Store submissions']);
	// The switch shows "Enabled", and is named after its handler.
	const enabled = workspace.handlersView.getByRole('switch', { name: 'Enabled: Store submissions', exact: true });
	await expect(enabled).toBeChecked();
	await expect(workspace.handlerRows.locator('uui-toggle')).toContainText('Enabled');
	await page.screenshot({ path: screenshotPath('handlers.png'), animations: 'disabled' });

	// Saved: the workspace moves to the form's edit URL; the form shows in the tree, its layout under it.
	await workspace.save.click();
	await expect(page).toHaveURL(FORM_EDIT_URL);
	const formId = FORM_EDIT_URL.exec(page.url())![1]!;
	const form = treeItem(root, 'Contact');
	await expect(form).toBeVisible();
	await expandTreeItem(form);
	await expect(treeItem(form, 'Contact (Autogenerated)')).toBeVisible();

	const stored = await callManagementApi<StoredForm>(page, 'GET', `/formulate/form/${formId}`);
	expect(stored.name).toBe('Contact');
	expect(
		stored.fields.map(({ kindId, name, alias, label, validations }) => ({ kindId, name, alias, label, validations })),
	).toStrictEqual([
		{ kindId: FIELD_KINDS.richText, name: 'Intro', alias: 'intro', label: null, validations: [] },
		{ kindId: FIELD_KINDS.text, name: 'Name', alias: 'name', label: 'Your name', validations: [required] },
		{ kindId: FIELD_KINDS.text, name: 'Email', alias: 'email', label: 'Your email', validations: [emailAddress] },
		{ kindId: FIELD_KINDS.dropDown, name: 'State', alias: 'state', label: 'Your state', validations: [] },
		{ kindId: FIELD_KINDS.checkboxList, name: 'Interests', alias: 'interests', label: 'Send me', validations: [] },
		{ kindId: FIELD_KINDS.button, name: 'Submit', alias: 'submit', label: null, validations: [] },
	]);
	expect(stored.fields[0].configuration).toStrictEqual({ text: '<p>Tell us about yourself.</p>' });
	expect(stored.fields[3].configuration).toStrictEqual({ dataValue: usStates });
	expect(stored.fields[4].configuration).toStrictEqual({ dataValue: interests });
	expect(stored.fields[5].configuration).toStrictEqual({ buttonKind: 'Submit' });
	expect(stored.handlers.map(({ kindId, name, enabled }) => ({ kindId, name, enabled }))).toStrictEqual([
		{ kindId: STORE_DATA, name: 'Store submissions', enabled: true },
	]);

	// After a reload, everything shows as it was saved.
	await page.goto(`${WORKSPACE_URL}/formulate-form/edit/${formId}`);
	await expect(workspace.name).toHaveValue('Contact');
	await expect.poll(() => namesOf(workspace.fieldRows)).toEqual(['Intro', 'Name', 'Email', 'State', 'Interests', 'Submit']);
	await expect(workspace.fieldRows.nth(1).locator('uui-tag')).toHaveText(['Text', '1 validation']);
	await expect(workspace.fieldRows.nth(3).locator('uui-ref-node')).toHaveAttribute('detail', 'state');
	await page.screenshot({ path: screenshotPath('form-fields.png'), animations: 'disabled' });

	// The drop down's dialog shows its data values; closing it changes nothing. Each row's actions, and each
	// picked item's Remove, are named after their item.
	await workspace.fieldRows.nth(3).locator('uui-ref-node').getByRole('button', { name: 'Edit State', exact: true }).click();
	const dialog = page.locator('formulate-edit-field-modal');
	await expect(dialog.locator('formulate-data-values-picker uui-ref-node[name="US States"]')).toBeVisible();
	await expect(dialog.locator('formulate-data-values-picker').getByRole('button', { name: 'Remove US States', exact: true })).toHaveText(
		'Remove',
	);
	await expect(dialog.locator('uui-input#label input')).toHaveValue('Your state');
	await dialog.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(dialog).toHaveCount(0);

	await workspace.tab('Handlers').click();
	await expect.poll(() => namesOf(workspace.handlerRows)).toEqual(['Store submissions']);
	await expect(enabled).toBeChecked();
});

/** Creates a form with one Rich Text field, Intro, whose text is the given HTML; returns the form's ID. */
async function createRichTextForm(page: Page, html: string) {
	const formId = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', {
		id: formId,
		kindId: FORM_KINDS.plain,
		name: 'Newsletter',
		fields: [{ id: randomUUID(), kindId: FIELD_KINDS.richText, name: 'Intro', alias: 'intro', validations: [], configuration: { text: html } }],
		handlers: [],
	});

	return formId;
}

/** Opens the dialog of the form's Intro field. */
async function openIntro(page: Page, formId: string) {
	await page.goto(`${WORKSPACE_URL}/formulate-form/edit/${formId}`);
	const workspace = formWorkspace(page);
	await expect.poll(() => namesOf(workspace.fieldRows)).toEqual(['Intro']);

	return openField(page, 'Intro');
}

/** Opens the dialog of a field of the form the workspace shows. */
async function openField(page: Page, name: string) {
	await formWorkspace(page).fieldsView.getByRole('button', { name: `Edit ${name}`, exact: true }).click();

	return page.locator('formulate-edit-field-modal');
}

/** Submits the field's dialog, saves the form and gives back the text the API stored for the field. */
async function submitAndReadText(page: Page, dialog: Locator, formId: string) {
	await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(dialog).toHaveCount(0);
	const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith(`/formulate/form/${formId}`));
	await formWorkspace(page).save.click();
	expect((await saved).ok()).toBe(true);

	const stored = await callManagementApi<StoredForm>(page, 'GET', `/formulate/form/${formId}`);
	return stored.fields[0].configuration;
}

test("a Rich Text field's HTML is stored byte for byte when its dialog is opened and submitted unedited", async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	// Markup Umbraco's rich text editor writes another way (<b> as <strong>, <i> as <em>) or drops (the iframe).
	const html = '<h2 class="intro">Hello</h2><p>Fill <b>this</b> in, <i>please</i>.</p><iframe src="https://www.example.com/video"></iframe>';
	const formId = await createRichTextForm(page, html);

	const dialog = await openIntro(page, formId);
	const text = dialog.locator('umb-input-tiptap [contenteditable="true"]');
	await expect(text).toContainText('Fill this in, please.');
	await expect(text.locator('h2')).toHaveText('Hello');

	expect(await submitAndReadText(page, dialog, formId)).toStrictEqual({ text: html });
});
