import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { screenshotDialog } from '../fixtures/dialog-screenshot.ts';
import { emptyTree } from '../fixtures/formulate-api.ts';
import { WORKSPACE_URL, waitForNameFocus } from '../fixtures/kind-item-workspace.ts';
import { expect, test } from '../fixtures/login.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { transmissionFormats } from '../support/server-constants.ts';

/** The kinds the tests use, by the IDs the API gives them. */
const PLAIN_FORM_KIND = '61244083-bd75-417b-af77-dfa8f8dc2673';
const FIELD_KINDS = {
	text: '17906580-86ea-440b-bc30-9e1b099f803b',
	date: 'e70cb78c-cf52-4611-98b4-556382f23119',
	hidden: '3df6facd-2ffa-4055-b0be-94e8fa8e7c4a',
	header: '6383dd2c-68bd-482b-95db-811d09d01bc8',
	button: 'cde8565c-5e92-4112-9a1f-7ffa1940c53c',
};
const EMAIL_KIND = 'a0c06033-cb94-424f-9c03-5b10a420db16';
const DESIGNED_EMAIL_KIND = '15be7a7d-179d-40a5-9ad0-34b71dac52d4';
const SEND_DATA_KIND = 'c76e8d1d-5df2-44cb-8fa2-85c32312d688';
/** A form's edit URL, with its ID; a view's path can follow it. */
const FORM_EDIT_URL = /\/workspace\/formulate-form\/edit\/([0-9a-f-]{36})(\/|$)/;
/** The built-in sample views (src/Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs). */
const SAMPLE_VIEWS = {
	subject: '~/Views/Formulate/Email/Sample (Subject).cshtml',
	html: '~/Views/Formulate/Email/Sample (HTML).cshtml',
	text: '~/Views/Formulate/Email/Sample (Text).cshtml',
};

/** A handler, as the API gives it. */
interface StoredHandler {
	id: string;
	kindId: string;
	name?: string | null;
	alias?: string | null;
	enabled: boolean;
	configuration?: unknown;
}

/** A field of the form the tests make. */
function field(kindId: string, name: string, alias: string, configuration?: unknown) {
	return { id: randomUUID(), kindId, name, alias, label: name, validations: [], ...(configuration ? { configuration } : {}) };
}

/** Makes a form with the fields the handlers pick from, and the given handlers. */
async function createForm(page: Page, handlers: Array<Omit<StoredHandler, 'id' | 'enabled'>> = []) {
	const fields = {
		name: field(FIELD_KINDS.text, 'Name', 'name'),
		email: field(FIELD_KINDS.text, 'Email', 'email'),
		visit: field(FIELD_KINDS.date, 'Visit date', 'visitDate'),
		source: field(FIELD_KINDS.hidden, 'Source', 'source'),
		heading: field(FIELD_KINDS.header, 'Heading', 'heading', { text: 'Tell us about you' }),
		send: field(FIELD_KINDS.button, 'Send', 'send', { buttonKind: 'Submit' }),
	};
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', {
		id,
		kindId: PLAIN_FORM_KIND,
		name: 'Enquiry',
		fields: Object.values(fields),
		handlers: handlers.map((handler) => ({ id: randomUUID(), enabled: true, ...handler })),
	});

	return { id, fields };
}

/** The parts of the form workspace the tests use. */
function formWorkspace(page: Page) {
	const handlersView = page.locator('formulate-form-handlers-workspace-view');

	return {
		save: page.locator('umb-workspace-action uui-button[label="Save"]'),
		handlersView,
		handlerRows: handlersView.locator('.row'),
		tab: (label: string) => page.locator('umb-workspace-editor').getByRole('tab', { name: label }),
	};
}

/** Opens the form's Handlers view. */
async function openHandlers(page: Page, formId: string) {
	await page.goto(`${WORKSPACE_URL}/formulate-form/edit/${formId}`);
	const workspace = formWorkspace(page);
	await workspace.tab('Handlers').click();
	await expect(workspace.handlersView).toBeVisible();

	return workspace;
}

/** Adds a handler of a kind, names it, and gives back its dialog. */
async function addHandler(page: Page, kindName: string, name: string) {
	const { handlersView } = formWorkspace(page);
	await handlersView.getByRole('button', { name: 'Add handler', exact: true }).click();
	const pick = page.locator('formulate-pick-kind-modal');
	await pick.getByRole('button', { name: kindName, exact: true }).click();
	await expect(pick).toHaveCount(0);
	const dialog = page.locator('formulate-edit-handler-modal');
	const nameInput = dialog.locator('umb-input-with-alias#name').getByRole('textbox', { name: 'Enter a name...', exact: true });
	await waitForNameFocus(page, nameInput);
	await nameInput.fill(name);

	return dialog;
}

/** Opens the dialog of a handler, by its name. */
async function editHandler(page: Page, name: string) {
	await formWorkspace(page).handlersView.getByRole('button', { name: `Edit ${name}`, exact: true }).click();

	return page.locator('formulate-edit-handler-modal');
}

/**
 * Picks fields in the dialog a field picker opens, by the names a screen reader gives them, and submits it.
 * @param names Each field's name with its alias, such as "Email (email)", as two fields can share a name.
 */
async function pickFields(page: Page, picker: Locator, names: Array<string>) {
	await picker.getByRole('button', { name: 'Choose', exact: true }).click();
	const modal = page.locator('formulate-pick-fields-modal');
	for (const name of names) {
		const item = modal.locator('uui-menu-item').filter({ has: page.getByRole('button', { name, exact: true }) });
		await item.locator('#label-button').click();
		// A picked field's alias stays readable on the selected item's color: it takes the color of the name.
		const nameColor = await item.locator('.name').evaluate((element) => getComputedStyle(element).color);
		await expect(item.locator('.alias')).toHaveCSS('color', nameColor);
	}
	await modal.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(modal).toHaveCount(0);
}

/** The names of the refs of a picker or list, in order. */
function refNames(container: Locator) {
	return container.locator('uui-ref-node').evaluateAll((refs) => refs.map((ref) => ref.getAttribute('name')));
}

/** Types into a Umbraco UI input or text area. */
async function fillIn(container: Locator, selector: string, text: string) {
	await container.locator(`${selector} input, ${selector} textarea`).first().fill(text);
}

/** Submits a handler's dialog. */
async function submit(dialog: Locator) {
	await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(dialog).toHaveCount(0);
}

/** A handler's kind, name and configuration. */
function settingsOf(handlers: Array<StoredHandler>) {
	return handlers.map(({ kindId, name, configuration }) => ({ kindId, name, configuration }));
}

/**
 * Saves the form.
 * @returns The handlers the back office sent, and the handlers as the API gives them back.
 */
async function saveAndRead(page: Page, formId: string) {
	const saved = page.waitForResponse(
		(response) => response.request().method() === 'PUT' && response.url().endsWith(`/formulate/form/${formId}`),
	);
	await formWorkspace(page).save.click();
	const response = await saved;
	expect(response.ok()).toBe(true);
	const sent: Array<StoredHandler> = response.request().postDataJSON().handlers;
	const stored = (await callManagementApi<{ handlers: Array<StoredHandler> }>(page, 'GET', `/formulate/form/${formId}`)).handlers;

	return { sent, stored };
}

test.use({ actionTimeout: 15_000 });

test.afterEach(async ({ page }) => {
	await emptyTree(page, 'forms');
});

test('the Email, Designed Email and Send Data handlers are set up in the designer, with their fields, and kept as set', async ({ page }) => {
	test.setTimeout(240_000);
	const formats = transmissionFormats();
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	const form = await createForm(page);
	const workspace = await openHandlers(page, form.id);

	// Email: two recipients, the visitor's address, Cc, and only the name and date, after the page.
	const email = await addHandler(page, 'Send Email', 'Email the team');
	const emailEditor = email.locator('formulate-send-email-handler-editor');
	await fillIn(emailEditor, 'uui-input#sender-email', 'forms@example.com');
	const recipients = emailEditor.locator('formulate-email-recipients-input');
	await recipients.getByRole('button', { name: 'Add recipient', exact: true }).click();
	await fillIn(recipients, 'uui-input[label="Email address 1"]', 'team@example.com');
	await recipients.getByRole('button', { name: 'Add recipient', exact: true }).click();
	await fillIn(recipients, 'uui-input[label="Email address 2"]', 'Sales <sales@example.com>');
	await pickFields(page, emailEditor.locator('formulate-form-field-picker#recipient-fields'), ['Email (email)']);
	await emailEditor.locator('uui-select#delivery-type select').selectOption('cc');
	await fillIn(emailEditor, 'uui-input#subject', 'New enquiry');
	await fillIn(emailEditor, 'uui-textarea#message', 'Someone filled in the form.\nPlease reply.');
	// A switch is turned on by clicking it; its checkbox is hidden behind it. Each is named after its setting.
	for (const setting of ['Append fields', 'Include hidden fields', 'Append payload']) {
		await emailEditor.locator(`uui-toggle[aria-label="${setting}"]`).click();
		await expect(emailEditor.getByRole('switch', { name: setting, exact: true })).toBeChecked();
	}
	await pickFields(page, emailEditor.locator('formulate-form-field-picker#fields-to-include'), ['Name (name)', 'Visit date (visitDate)']);
	await expect.poll(() => refNames(emailEditor.locator('#fields-to-include'))).toEqual(['Name', 'Visit date']);
	// The field picker shows each field's alias under its name, and its Remove says which field it removes.
	await expect(emailEditor.locator('#recipient-fields uui-ref-node')).toHaveAttribute('detail', 'email');
	await expect(emailEditor.locator('#recipient-fields').getByRole('button', { name: 'Remove Email', exact: true })).toHaveCount(1);
	await screenshotDialog(page, emailEditor, 'email-handler.png');
	await submit(email);

	// Designed Email: the base settings it reads, and the sample views.
	const designed = await addHandler(page, 'Designed Email', 'Designed email');
	const designedEditor = designed.locator('formulate-designed-email-handler-editor');
	await fillIn(designedEditor, 'uui-input#sender-email', 'forms@example.com');
	await designedEditor.getByRole('button', { name: 'Add recipient', exact: true }).click();
	await fillIn(designedEditor, 'uui-input[label="Email address 1"]', 'designed@example.com');
	await pickFields(page, designedEditor.locator('formulate-form-field-picker#recipient-fields'), ['Email (email)']);
	await designedEditor.locator('uui-select#delivery-type select').selectOption('to');
	await fillIn(designedEditor, 'uui-input#subject', 'Designed for {PageName}');
	await fillIn(designedEditor, 'uui-textarea#message', 'A designed message.');
	// The samples are offered as hints; the Email handler's own settings are not shown, as it does not read them.
	await expect(designedEditor.locator('umb-property-layout[label="Subject view"]')).toContainText(SAMPLE_VIEWS.subject);
	await expect(designedEditor.locator('umb-property-layout[label="HTML view"]')).toContainText(SAMPLE_VIEWS.html);
	await expect(designedEditor.locator('umb-property-layout[label="Text view"]')).toContainText(SAMPLE_VIEWS.text);
	await expect(designedEditor.getByRole('switch')).toHaveCount(0);
	await fillIn(designedEditor, 'uui-input#subject-view', SAMPLE_VIEWS.subject);
	await fillIn(designedEditor, 'uui-input#html-view', SAMPLE_VIEWS.html);
	await fillIn(designedEditor, 'uui-input#text-view', SAMPLE_VIEWS.text);
	await screenshotDialog(page, designedEditor, 'designed-email-handler.png');
	await submit(designed);

	// Send Data: every field with a value to send, the email renamed, and the date moved up with the keyboard.
	const sendData = await addHandler(page, 'Send Data', 'Send to the CRM');
	const sendDataEditor = sendData.locator('formulate-send-data-handler-editor');
	await expect(sendDataEditor.locator('#no-fields')).toBeVisible();
	await fillIn(sendDataEditor, 'uui-input#url', 'https://crm.example.com/forms?source=formulate');
	await sendDataEditor.locator('uui-select#method select').selectOption('POST');
	await sendDataEditor.locator('uui-select#transmission-format select').selectOption(formats.Json);
	const mappings = sendDataEditor.locator('formulate-field-mappings-input');
	// Choose offers only the fields that send a value: not the heading or the button.
	await mappings.getByRole('button', { name: 'Choose', exact: true }).click();
	const fieldDialog = page.locator('formulate-pick-fields-modal');
	await expect
		.poll(() => fieldDialog.locator('uui-menu-item').evaluateAll((items) => items.map((item) => item.getAttribute('label'))))
		.toEqual(['Name (name)', 'Email (email)', 'Visit date (visitDate)', 'Source (source)']);
	await fieldDialog.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(fieldDialog).toHaveCount(0);
	await mappings.getByRole('button', { name: 'Add all fields', exact: true }).click();
	// The heading and the button send nothing, so they are left out.
	await expect.poll(() => refNames(mappings)).toEqual(['Name', 'Email', 'Visit date', 'Source']);
	await expect(sendDataEditor.locator('#no-fields')).toHaveCount(0);
	// Each field is sent once: nothing is left to add.
	await expect(mappings.getByRole('button', { name: 'Add all fields', exact: true })).toBeDisabled();
	await fillIn(mappings, 'uui-input[label="Name sent for Email"]', 'email_address');
	const dateHandle = mappings.getByRole('button', { name: 'Move Visit date', exact: true });
	await dateHandle.focus();
	await page.keyboard.press('ArrowUp');
	await expect.poll(() => refNames(mappings)).toEqual(['Name', 'Visit date', 'Email', 'Source']);
	// The source is not sent after all.
	await mappings.getByRole('button', { name: 'Remove Source', exact: true }).click();
	await expect.poll(() => refNames(mappings)).toEqual(['Name', 'Visit date', 'Email']);
	await screenshotDialog(page, sendDataEditor, 'send-data-handler.png');
	await submit(sendData);
	await expect.poll(() => refNames(workspace.handlerRows)).toEqual(['Email the team', 'Designed email', 'Send to the CRM']);

	const { fields } = form;
	const expected = [
		{
			kindId: EMAIL_KIND,
			name: 'Email the team',
			configuration: {
				senderEmail: 'forms@example.com',
				recipients: [{ email: 'team@example.com' }, { email: 'Sales <sales@example.com>' }],
				recipientFields: [{ id: fields.email.id }],
				deliveryType: 'cc',
				subject: 'New enquiry',
				message: 'Someone filled in the form.\nPlease reply.',
				appendFields: true,
				appendPayload: true,
				excludeFieldLabels: false,
				includeHiddenFields: true,
				fieldsToInclude: [{ id: fields.name.id }, { id: fields.visit.id }],
			},
		},
		{
			kindId: DESIGNED_EMAIL_KIND,
			name: 'Designed email',
			configuration: {
				senderEmail: 'forms@example.com',
				recipients: [{ email: 'designed@example.com' }],
				recipientFields: [{ id: fields.email.id }],
				deliveryType: 'to',
				subject: 'Designed for {PageName}',
				message: 'A designed message.',
				subjectRazorPath: SAMPLE_VIEWS.subject,
				htmlEmailRazorPath: SAMPLE_VIEWS.html,
				textEmailRazorPath: SAMPLE_VIEWS.text,
			},
		},
		{
			kindId: SEND_DATA_KIND,
			name: 'Send to the CRM',
			configuration: {
				url: 'https://crm.example.com/forms?source=formulate',
				method: 'POST',
				transmissionFormat: formats.Json,
				fields: [
					{ id: fields.name.id, name: 'name' },
					{ id: fields.visit.id, name: 'visitDate' },
					{ id: fields.email.id, name: 'email_address' },
				],
			},
		},
	];
	// What the editors stored is what the server's configuration classes read, key for key.
	const saved = await saveAndRead(page, form.id);
	expect(settingsOf(saved.sent)).toStrictEqual(expected);
	expect(settingsOf(saved.stored)).toStrictEqual(expected);

	// After a reload, each dialog shows what was saved, and submitting it unchanged changes nothing.
	await openHandlers(page, form.id);
	await expect.poll(() => refNames(workspace.handlerRows)).toEqual(['Email the team', 'Designed email', 'Send to the CRM']);

	const emailAgain = await editHandler(page, 'Email the team');
	const emailEditorAgain = emailAgain.locator('formulate-send-email-handler-editor');
	await expect(emailEditorAgain.locator('uui-input#sender-email input')).toHaveValue('forms@example.com');
	await expect(emailEditorAgain.locator('uui-input[label="Email address 2"] input')).toHaveValue('Sales <sales@example.com>');
	await expect(emailEditorAgain.locator('uui-select#delivery-type select')).toHaveValue('cc');
	await expect(emailEditorAgain.locator('uui-textarea#message textarea')).toHaveValue('Someone filled in the form.\nPlease reply.');
	await expect.poll(() => refNames(emailEditorAgain.locator('#recipient-fields'))).toEqual(['Email']);
	await expect.poll(() => refNames(emailEditorAgain.locator('#fields-to-include'))).toEqual(['Name', 'Visit date']);
	await expect(emailEditorAgain.getByRole('switch', { name: 'Append fields', exact: true })).toBeChecked();
	await expect(emailEditorAgain.getByRole('switch', { name: 'Exclude field labels', exact: true })).not.toBeChecked();
	await submit(emailAgain);

	const designedAgain = await editHandler(page, 'Designed email');
	const designedEditorAgain = designedAgain.locator('formulate-designed-email-handler-editor');
	await expect(designedEditorAgain.locator('uui-select#delivery-type select')).toHaveValue('to');
	await expect(designedEditorAgain.locator('uui-input#html-view input')).toHaveValue(SAMPLE_VIEWS.html);
	await expect.poll(() => refNames(designedEditorAgain.locator('#recipient-fields'))).toEqual(['Email']);
	await submit(designedAgain);

	const sendDataAgain = await editHandler(page, 'Send to the CRM');
	const sendDataEditorAgain = sendDataAgain.locator('formulate-send-data-handler-editor');
	await expect(sendDataEditorAgain.locator('uui-select#method select')).toHaveValue('POST');
	await expect(sendDataEditorAgain.locator('uui-select#transmission-format select')).toHaveValue(formats.Json);
	await expect.poll(() => refNames(sendDataEditorAgain.locator('formulate-field-mappings-input'))).toEqual(['Name', 'Visit date', 'Email']);
	await expect(sendDataEditorAgain.locator('uui-input[label="Name sent for Email"] input')).toHaveValue('email_address');
	await submit(sendDataAgain);

	const savedAgain = await saveAndRead(page, form.id);
	expect(settingsOf(savedAgain.sent)).toStrictEqual(expected);
	expect(savedAgain.stored).toStrictEqual(saved.stored);
});

test('a picked field that is no longer on the form shows as missing, and can be removed', async ({ page }) => {
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	// A field that was deleted from the form after the handlers picked it.
	const gone = randomUUID();
	const form = await createForm(page, [
		{
			kindId: EMAIL_KIND,
			name: 'Old email',
			configuration: { recipients: [{ email: 'team@example.com' }], recipientFields: [{ id: gone }], fieldsToInclude: [] },
		},
		{
			kindId: SEND_DATA_KIND,
			name: 'Old send',
			configuration: { url: 'https://crm.example.com/', fields: [{ id: gone, name: 'gone' }] },
		},
	]);
	const workspace = await openHandlers(page, form.id);

	await expect.poll(() => refNames(workspace.handlerRows)).toEqual(['Old email', 'Old send']);
	const dialog = await editHandler(page, 'Old email');
	const recipientFields = dialog.locator('formulate-form-field-picker#recipient-fields');
	await expect(recipientFields.locator('uui-ref-node')).toHaveAttribute('name', 'Field not found');
	await expect(recipientFields.locator('uui-ref-node')).toHaveAttribute('detail', gone);
	await recipientFields.getByRole('button', { name: 'Remove item 1', exact: true }).click();
	await expect(recipientFields.locator('uui-ref-node')).toHaveCount(0);
	await submit(dialog);

	await editHandler(page, 'Old send');
	const mappings = dialog.locator('formulate-field-mappings-input');
	await expect(mappings.locator('uui-ref-node')).toHaveAttribute('name', 'Field not found');
	await mappings.getByRole('button', { name: 'Remove item 1', exact: true }).click();
	await expect(mappings.locator('uui-ref-node')).toHaveCount(0);
	await submit(dialog);

	const { stored } = await saveAndRead(page, form.id);
	expect(
		stored.map((handler) => (handler.configuration as Record<string, unknown>)[handler.kindId === EMAIL_KIND ? 'recipientFields' : 'fields']),
	).toStrictEqual([[], []]);
});

test('a field added to a new form and picked in a handler before the first save is referenced by the ID it is stored with', async ({
	page,
}) => {
	// A new form, which is saved once, with the field and the handler that picks it.
	await page.goto(`${WORKSPACE_URL}/formulate-form/create/parent/formulate-forms-root/null/${PLAIN_FORM_KIND}`);
	const formName = page.locator('formulate-kind-item-workspace-header').getByRole('textbox', { name: 'Enter a name...', exact: true });
	await waitForNameFocus(page, formName);
	await formName.fill('Callback');

	await page.locator('formulate-form-fields-workspace-view').getByRole('button', { name: 'Add field', exact: true }).click();
	const pick = page.locator('formulate-pick-kind-modal');
	await pick.getByRole('button', { name: 'Text', exact: true }).click();
	await expect(pick).toHaveCount(0);
	const fieldDialog = page.locator('formulate-edit-field-modal');
	const fieldName = fieldDialog.locator('umb-input-with-alias#name').getByRole('textbox', { name: 'Enter a name...', exact: true });
	await waitForNameFocus(page, fieldName);
	await fieldName.fill('Email');
	await submit(fieldDialog);

	const workspace = formWorkspace(page);
	await workspace.tab('Handlers').click();
	const email = await addHandler(page, 'Send Email', 'Email the visitor');
	const emailEditor = email.locator('formulate-send-email-handler-editor');
	await pickFields(page, emailEditor.locator('formulate-form-field-picker#recipient-fields'), ['Email (email)']);
	await submit(email);

	await workspace.save.click();
	await expect(page).toHaveURL(FORM_EDIT_URL);
	const formId = FORM_EDIT_URL.exec(page.url())![1]!;
	const stored = await callManagementApi<{ fields: Array<{ id: string; alias?: string | null }>; handlers: Array<StoredHandler> }>(
		page,
		'GET',
		`/formulate/form/${formId}`,
	);

	expect(stored.fields.map(({ alias }) => alias)).toStrictEqual(['email']);
	expect(settingsOf(stored.handlers).map(({ configuration }) => (configuration as Record<string, unknown>).recipientFields)).toStrictEqual([
		[{ id: stored.fields[0]!.id }],
	]);
});
