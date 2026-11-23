import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { screenshotDialog } from '../fixtures/dialog-screenshot.ts';
import { KINDS, createKindItem, emptyTree } from '../fixtures/formulate-api.ts';
import { WORKSPACE_URL, waitForNameFocus } from '../fixtures/kind-item-workspace.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { expect, test } from '../fixtures/seeded-page.ts';
import {
	cleanUp,
	createForm,
	createPage,
	fieldKind,
	findKinds,
	formField,
	waitForPage,
	watchPage,
} from '../fixtures/site-forms.ts';
import { pickInTree } from '../fixtures/tree.ts';
import { screenshotPath } from '../support/screenshots.ts';

/**
 * Sizes, as Pair List data values: each item's value (its primary text) and label (its secondary text). An
 * Extended Radio Button List shows each value with its label as its description, and no description for a label
 * that repeats its value.
 */
const SIZES = [
	{ primary: 'Small', secondary: 'Up to 36 inches' },
	{ primary: 'Medium', secondary: 'Medium' },
	{ primary: 'Large', secondary: 'Over 48 inches' },
];

/**
 * What the reCAPTCHA field's dialog says on the dev site, whose appsettings.json leaves both keys blank
 * (Formulate:Recaptcha:SiteKey and SecretKey). The run's environment sets both to empty too (see
 * support/site-environment.ts), and the dev site reads environment variables after appsettings.Local.json (see
 * src/Website/LocalSettings.cs), so real keys in a developer's own file do not change this.
 */
const KEYS_NOT_SET = 'This site does not have both reCAPTCHA keys set, so this field rejects every submission.';

/** A field, as the API gives it and takes it. */
interface StoredField {
	id: string;
	kindId: string;
	name?: string | null;
	configuration?: unknown;
}

/** A field as the site stores it in the form's file (PersistedFormField): its configuration is the JSON text the kind reads. */
interface FileField {
	Id: string;
	TypeId: string;
	Name: string;
	FieldConfiguration?: string | null;
}

/** A form as the page hands it to the renderer (the renderer's FormulateForm), with what the tests read of it. */
interface PushedForm {
	data: { fields: Array<{ fieldType: string; configuration: unknown }> };
}

/** The parts of the form workspace the tests use. */
function formWorkspace(page: Page) {
	const fieldsView = page.locator('formulate-form-fields-workspace-view');

	return {
		save: page.locator('umb-workspace-action uui-button[label="Save"]'),
		fieldsView,
		fieldRows: fieldsView.locator('.row'),
	};
}

/** Adds a field of a kind, as a user does (Add field, the kind, then its dialog), names it, and gives back its dialog. */
async function addField(page: Page, kindName: string, name: string) {
	await formWorkspace(page).fieldsView.getByRole('button', { name: 'Add field', exact: true }).click();
	const pick = page.locator('formulate-pick-kind-modal');
	await pick.getByRole('button', { name: kindName, exact: true }).click();
	await expect(pick).toHaveCount(0);
	const dialog = page.locator('formulate-edit-field-modal');
	const nameInput = dialog.locator('umb-input-with-alias#name').getByRole('textbox', { name: 'Enter a name...', exact: true });
	await waitForNameFocus(page, nameInput);
	await nameInput.fill(name);

	return dialog;
}

/** Opens the dialog of a field, by its name. */
async function editField(page: Page, name: string) {
	await formWorkspace(page).fieldsView.getByRole('button', { name: `Edit ${name}`, exact: true }).click();

	return page.locator('formulate-edit-field-modal');
}

/** Picks the data values and the orientation of an Extended Radio Button List in its editor. */
async function setUpExtendedList(page: Page, editor: Locator, dataValues: string, orientation: string) {
	const picker = editor.locator('formulate-data-values-picker');
	await picker.getByRole('button', { name: 'Choose', exact: true }).click();
	await pickInTree(page, dataValues);
	await expect(picker.locator(`uui-ref-node[name="${dataValues}"]`)).toBeVisible();
	await editor.locator('uui-select#orientation select').selectOption(orientation);
}

/** Submits a field's dialog. */
async function submit(dialog: Locator) {
	await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(dialog).toHaveCount(0);
}

/**
 * Saves the form.
 * @param siteFolder The folder of the worker's site (workerSite.folder).
 * @returns The fields the back office sent, the fields as the API gives them back, and the fields as the site
 * stored them in the form's file.
 */
async function saveAndRead(page: Page, siteFolder: string, formId: string) {
	const saved = page.waitForResponse(
		(response) => response.request().method() === 'PUT' && response.url().endsWith(`/formulate/form/${formId}`),
	);
	await formWorkspace(page).save.click();
	const response = await saved;
	expect(response.ok()).toBe(true);
	const sent: Array<StoredField> = response.request().postDataJSON().fields;
	const stored = (await callManagementApi<{ fields: Array<StoredField> }>(page, 'GET', `/formulate/form/${formId}`)).fields;
	// The site keeps each form in a file of its own (Formulate.Web's WebHostRepositoryUtility), in its folder.
	const file = join(siteFolder, 'Formulate', 'Forms', `${formId.replaceAll('-', '')}.form`);
	const inFile: Array<FileField> = JSON.parse(readFileSync(file, 'utf8')).Fields;

	return { sent, stored, inFile };
}

/** A field of a list, by its name. */
function named<T extends { name?: string | null } | { Name: string }>(fields: Array<T>, name: string): T {
	const found = fields.find((field) => ('Name' in field ? field.Name : field.name) === name);
	expect(found, `the ${name} field`).toBeTruthy();

	return found!;
}

/** The configuration the site stored for a field, as its kind reads it: the JSON text of the form's file, parsed. */
function storedConfiguration(field: FileField) {
	return field.FieldConfiguration ? JSON.parse(field.FieldConfiguration) : null;
}

test.use({ actionTimeout: 15_000 });

test.afterEach(async ({ page }) => {
	await emptyTree(page, 'forms');
	await emptyTree(page, 'data-values');
});

test('an Extended Radio Button List and a reCAPTCHA field are added in the designer, set up, and kept as set', async ({ page, workerSite }) => {
	test.setTimeout(240_000);
	const kinds = await findKinds(page);
	const extendedList = fieldKind(kinds, 'Extended Radio Button List');
	const recaptcha = fieldKind(kinds, 'reCAPTCHA');
	const sizes = await createKindItem(page, 'data-values', { name: 'Sizes', kindId: KINDS.pairList, configuration: { items: SIZES } });
	const formId = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', { id: formId, kindId: kinds.formKindId, name: 'Order', fields: [], handlers: [] });
	await page.goto(`${WORKSPACE_URL}/formulate-form/edit/${formId}`);
	await expect(formWorkspace(page).fieldsView).toBeVisible();

	// The Extended Radio Button List: its data values, which say where each choice's description comes from, and
	// how its choices are laid out.
	const sizeDialog = await addField(page, 'Extended Radio Button List', 'Size');
	const sizeEditor = sizeDialog.locator('formulate-extended-radio-button-list-field-editor');
	await expect(sizeEditor.locator('umb-property-layout').first()).toContainText('becomes its description');
	await setUpExtendedList(page, sizeEditor, 'Sizes', 'Horizontal');
	await screenshotDialog(page, sizeEditor, 'extended-radio-button-list-field.png');
	await submit(sizeDialog);

	// The reCAPTCHA field has nothing to set. It says that the dev site has no keys, so the field rejects every
	// submission, and which settings hold the keys.
	const robotDialog = await addField(page, 'reCAPTCHA', 'Robot check');
	const robotEditor = robotDialog.locator('formulate-recaptcha-field-editor');
	await expect(robotEditor.locator('#notice')).toHaveText(KEYS_NOT_SET);
	await expect(robotEditor.getByRole('note')).toHaveText(KEYS_NOT_SET);
	await expect(robotEditor.locator('code')).toHaveText(['Formulate:Recaptcha:SiteKey', 'Formulate:Recaptcha:SecretKey']);
	await expect(robotEditor.locator('input, textarea, select, uui-input, uui-textarea, uui-select, uui-toggle')).toHaveCount(0);
	await screenshotDialog(page, robotEditor, 'recaptcha-field.png');
	await submit(robotDialog);

	// Saved: the Extended Radio Button List as ExtendedRadioButtonListFieldPreValues reads it, and nothing for the
	// reCAPTCHA field, which stores no configuration.
	const { sent, stored, inFile } = await saveAndRead(page, workerSite.folder, formId);
	const sizeSettings = { dataValue: sizes, orientation: 'Horizontal' };
	expect(sent.map(({ kindId, name }) => ({ kindId, name }))).toStrictEqual([
		{ kindId: extendedList.kindId, name: 'Size' },
		{ kindId: recaptcha.kindId, name: 'Robot check' },
	]);
	expect(named(sent, 'Size').configuration).toStrictEqual(sizeSettings);
	expect(named(sent, 'Robot check')).not.toHaveProperty('configuration');
	expect(named(stored, 'Size').configuration).toStrictEqual(sizeSettings);
	expect(named(stored, 'Robot check').configuration ?? null).toBeNull();
	expect(storedConfiguration(named(inFile, 'Size'))).toStrictEqual(sizeSettings);
	expect(storedConfiguration(named(inFile, 'Robot check'))).toBeNull();

	// After a reload, each dialog shows what was saved.
	await page.goto(`${WORKSPACE_URL}/formulate-form/edit/${formId}`);
	await expect(formWorkspace(page).fieldRows).toHaveCount(2);
	const sizeAgain = (await editField(page, 'Size')).locator('formulate-extended-radio-button-list-field-editor');
	await expect(sizeAgain.locator('formulate-data-values-picker uui-ref-node[name="Sizes"]')).toBeVisible();
	await expect(sizeAgain.locator('uui-select#orientation select')).toHaveValue('Horizontal');
	await page.locator('formulate-edit-field-modal').getByRole('button', { name: 'Close', exact: true }).click();
	await expect(page.locator('formulate-edit-field-modal')).toHaveCount(0);
	const robotAgain = (await editField(page, 'Robot check')).locator('formulate-recaptcha-field-editor');
	await expect(robotAgain.locator('#notice')).toHaveText(KEYS_NOT_SET);
	await page.locator('formulate-edit-field-modal').getByRole('button', { name: 'Close', exact: true }).click();

	// The back office learns this from Formulate's configuration, which says whether the keys are set but never
	// gives them.
	const config = await callManagementApi<Record<string, unknown>>(page, 'GET', '/formulate/config');
	expect(config.recaptchaConfigured).toBe(false);
	expect(Object.keys(config).sort()).toStrictEqual(['buttonKinds', 'fieldCategories', 'recaptchaConfigured']);
});

test('an Extended Radio Button List set up in the designer shows its choices, their descriptions and its orientation on a page', async ({
	page,
	context,
	seededPage,
	workerSite,
}) => {
	void seededPage;
	test.setTimeout(240_000);
	const kinds = await findKinds(page);
	await createKindItem(page, 'data-values', { name: 'Sizes', kindId: KINDS.pairList, configuration: { items: SIZES } });
	// A new field, with what its kind gives a new field: no data values and no orientation.
	const size = formField(fieldKind(kinds, 'Extended Radio Button List'), 'Size', 'size');
	const { formId, layoutId } = await createForm(page, kinds, { name: 'Sizes form', fields: [size], handlers: [] });
	const created = await createPage(page, 'Sizes page', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);
	// The form data the page hands the renderer: each form the page pushes onto window["formulate-plain-js-forms"],
	// as it was pushed.
	await site.addInitScript(() => {
		const pushed: Array<unknown> = [];
		const queue: Array<unknown> = [];
		queue.push = (...forms: Array<unknown>) => {
			pushed.push(...forms.map((form) => JSON.parse(JSON.stringify(form))));
			return Array.prototype.push.apply(queue, forms);
		};
		Object.assign(window, { 'formulate-plain-js-forms': queue, formulatePushedForms: pushed });
	});

	try {
		await page.goto(`${WORKSPACE_URL}/formulate-form/edit/${formId}`);
		const dialog = await editField(page, 'Size');
		await setUpExtendedList(page, dialog.locator('formulate-extended-radio-button-list-field-editor'), 'Sizes', 'Vertical');
		await submit(dialog);
		const { stored } = await saveAndRead(page, workerSite.folder, formId);
		expect(named(stored, 'Size').configuration).toMatchObject({ orientation: 'Vertical' });

		await waitForPage(site, created.path);
		await site.goto(created.path);

		// Each choice is a radio button named by its value and its description; Medium's label repeats its value,
		// so it has no description.
		const list = site.locator('fieldset.formulate__field--extended-radio-list');
		await expect(list.locator('legend')).toHaveText('Size');
		const choices = list.getByRole('radio');
		await expect(choices).toHaveCount(3);
		for (const name of ['Small Up to 36 inches', 'Medium', 'Large Over 48 inches']) {
			await expect(list.getByRole('radio', { name, exact: true })).toBeVisible();
		}
		await expect(choices.nth(0)).toHaveAttribute('value', 'Small');
		await expect(choices.nth(1)).toHaveAttribute('value', 'Medium');
		await expect(choices.nth(2)).toHaveAttribute('value', 'Large');
		const texts = await list
			.locator('label')
			.evaluateAll((labels) => labels.map((label) => [...label.querySelectorAll('.formulate__field__label-text')].map((text) => text.textContent)));
		expect(texts).toStrictEqual([
			['Small', 'Up to 36 inches'],
			['Medium', ''],
			['Large', 'Over 48 inches'],
		]);

		// The page gives the renderer the orientation chosen in the designer, with the choices.
		const pushed = await site.evaluate(() => (window as unknown as { formulatePushedForms: Array<PushedForm> }).formulatePushedForms);
		expect(pushed).toHaveLength(1);
		const field = pushed[0]!.data.fields.find((candidate) => candidate.fieldType === 'extended-radio-list');
		expect(field?.configuration).toStrictEqual({
			orientation: 'Vertical',
			items: [
				{ value: 'Small', label: 'Small', description: 'Up to 36 inches' },
				{ value: 'Medium', label: 'Medium', description: '' },
				{ value: 'Large', label: 'Large', description: 'Over 48 inches' },
			],
		});
		await site.screenshot({ path: screenshotPath('extended-radio-button-list-page.png'), fullPage: true });
		expect(problems, 'no console errors').toEqual([]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
	}
});
