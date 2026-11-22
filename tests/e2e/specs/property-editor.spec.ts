import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures/seeded-page.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { screenshotPath } from '../support/screenshots.ts';

const FORM_NAME = 'Contact Form';
const LAYOUT_NAME = 'Contact';

interface KindDefinition {
	kindId: string;
	name: string;
	isHidden?: boolean;
	isServerSideOnly?: boolean;
	isLegacy?: boolean;
	defaultConfiguration?: unknown;
}

/**
 * Creates the "Contact" form (with one field) and its "Contact" layout through the API: the form designer
 * is a later task. The layout is a Basic layout that shows every field of the form.
 */
async function createContactFormAndLayout(page: import('@playwright/test').Page) {
	const [fieldKinds, layoutKinds, templates, formOptions] = await Promise.all([
		callManagementApi<Array<KindDefinition>>(page, 'GET', '/formulate/definition/form-field'),
		callManagementApi<Array<KindDefinition>>(page, 'GET', '/formulate/definition/layout'),
		callManagementApi<Array<{ id: string; isDefault: boolean }>>(page, 'GET', '/formulate/definition/template'),
		callManagementApi<Array<{ entityType: string; kindId?: string; name: string }>>(
			page,
			'GET',
			'/formulate/tree/forms/create-options',
		),
	]);
	const formKindId = formOptions.find((option) => option.entityType === 'formulate-form' && option.name === 'Form')?.kindId;
	const fieldKind = fieldKinds.find((kind) => !kind.isHidden && !kind.isServerSideOnly && /text/i.test(kind.name));
	const layoutKind = layoutKinds.find((kind) => !kind.isLegacy && /basic/i.test(kind.name));
	const template = templates.find((candidate) => candidate.isDefault) ?? templates[0];
	expect(formKindId, 'the Forms root offers the plain Form kind').toBeTruthy();
	expect(fieldKind, 'a text field kind exists').toBeTruthy();
	expect(layoutKind, 'the Basic layout kind exists').toBeTruthy();
	expect(template, 'a template exists').toBeTruthy();

	const formId = randomUUID();
	const layoutId = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', {
		id: formId,
		kindId: formKindId,
		name: FORM_NAME,
		fields: [
			{
				id: randomUUID(),
				kindId: fieldKind!.kindId,
				name: 'Your name',
				alias: 'yourName',
				label: 'Your name',
				validations: [],
				...(fieldKind!.defaultConfiguration ? { configuration: fieldKind!.defaultConfiguration } : {}),
			},
		],
		handlers: [],
	});
	await callManagementApi(page, 'POST', '/formulate/layout', {
		id: layoutId,
		formId,
		kindId: layoutKind!.kindId,
		name: LAYOUT_NAME,
		templateId: template!.id,
		configuration: { autoPopulate: true, rows: [] },
	});

	return { formId, layoutId };
}

/** The value of the "form" property of the Contact Us page, as the Management API stores it. */
async function readFormValue(page: import('@playwright/test').Page, documentId: string): Promise<unknown> {
	const document = await callManagementApi<{ values: Array<{ alias: string; value: unknown }> }>(
		page,
		'GET',
		`/document/${documentId}`,
	);

	return document.values.find((value) => value.alias === 'form')?.value;
}

// A click that cannot happen fails in seconds, not at the end of the test.
test.use({ actionTimeout: 15_000 });

test('the Form Layout Picker picks, shows, clears and renders a form layout', async ({ page, seededPage }) => {
	void seededPage;
	test.setTimeout(180_000);
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
	const { formId, layoutId } = await createContactFormAndLayout(page);

	try {
		await page.goto('/umbraco/section/content');
		await page.locator('umb-section-sidebar').getByText('Contact Us', { exact: true }).click();
		await expect(page).toHaveURL(/\/umbraco\/section\/content\/workspace\/document\/edit\/([0-9a-f-]{36})/);
		const documentId = /document\/edit\/([0-9a-f-]{36})/.exec(page.url())![1]!;

		const picker = page.locator('formulate-form-layout-picker');
		// Saves and publishes, then waits until the page shows the value (a notification from an earlier save
		// may still be on screen, so none says when this one is done).
		const saveAndPublish = async (expected: unknown) => {
			await page.getByRole('button', { name: /^Save and publish/i }).click();
			await expect.poll(() => readFormValue(page, documentId)).toStrictEqual(expected);
		};
		// The form's name is the ref's name, and the layout's is its detail line, as in core's refs.
		const expectPicked = async (picker: import('@playwright/test').Locator) => {
			await expect(picker.locator('uui-ref-node')).toHaveAttribute('name', FORM_NAME);
			await expect(picker.locator('uui-ref-node')).toHaveAttribute('detail', LAYOUT_NAME);
		};
		const publishedHtml = async () => (await page.request.get('/')).text();

		// A new page has nothing picked.
		await expect(picker).toBeVisible();
		await expect(picker.locator('uui-ref-node')).toHaveCount(0);
		await expect(picker.getByRole('button', { name: 'Choose' })).toBeVisible();

		// Forms and folders open, but only a layout can be picked.
		await picker.getByRole('button', { name: 'Choose' }).click();
		const modal = page.locator('umb-tree-picker-modal');
		await expect(modal).toBeVisible();
		const formItem = modal.locator(`uui-menu-item[label="${FORM_NAME}"]`);
		await expect(formItem).toBeVisible();
		await formItem.locator('#caret-button').click();
		const layoutItem = modal.locator('uui-menu-item[label="Contact"]');
		await expect(layoutItem).toBeVisible();
		await expect(formItem.locator('#label-button').first()).toBeDisabled();
		await expect(modal.getByRole('button', { name: 'Choose' })).toBeDisabled();
		await page.screenshot({ path: screenshotPath('property-editor-picker.png') });

		await layoutItem.locator('#label-button').click();
		await modal.getByRole('button', { name: 'Choose' }).click();
		await expect(modal).toHaveCount(0);
		await expectPicked(picker);

		await saveAndPublish({ id: layoutId });

		// A reload shows the pick again.
		await page.reload();
		await expectPicked(picker);
		await page.screenshot({ path: screenshotPath('property-editor.png') });

		// Removing it stores no value.
		await picker.locator('uui-ref-node uui-button[label="Remove"]').click();
		await expect(picker.locator('uui-ref-node')).toHaveCount(0);
		await saveAndPublish(undefined);
		// The published page stops showing the form, once Umbraco's cache has caught up.
		await expect.poll(publishedHtml).not.toContain('formulate-plain-js-forms');
		expect((await page.request.get('/')).status()).toBe(200);

		// Pick it again, and the published page carries the form's JSON.
		await picker.getByRole('button', { name: 'Choose' }).click();
		await expect(modal).toBeVisible();
		await modal.locator(`uui-menu-item[label="${FORM_NAME}"]`).locator('#caret-button').click();
		await modal.locator('uui-menu-item[label="Contact"]').locator('#label-button').click();
		await modal.getByRole('button', { name: 'Choose' }).click();
		await expectPicked(picker);
		await saveAndPublish({ id: layoutId });

		await expect.poll(publishedHtml).toContain('formulate-plain-js-forms');
		const html = await publishedHtml();
		expect(html).toContain('formulate-plain-js-forms');
		expect(html).toContain(`data-form-name="${FORM_NAME}"`);
		// The form's ID, without dashes, is in the payload the page sends back.
		expect(html).toContain(formId.replaceAll('-', ''));
	} finally {
		await callManagementApi(page, 'DELETE', `/formulate/form/${formId}`);
	}
});
