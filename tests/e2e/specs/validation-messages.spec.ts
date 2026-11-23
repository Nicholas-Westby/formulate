import { KINDS, createKindItem } from '../fixtures/formulate-api.ts';
import { expect, test } from '../fixtures/seeded-page.ts';
import { cleanUp, createForm, createPage, fieldKind, findKinds, formField, openBackOffice, waitForPage, watchPage } from '../fixtures/site-forms.ts';

/** The Store Data handler's kind. */
const STORE_DATA_KIND_ID = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';

interface PageFormData {
	fields: Array<{ id: string; alias: string }>;
	payload: Record<string, string>;
	url: string;
}

test.use({ actionTimeout: 15_000 });

test("the placeholders in a validation's message are replaced with the field's values, in the browser and on the server", async ({
	page,
	context,
	seededPage,
}) => {
	void seededPage;
	test.setTimeout(180_000);
	await openBackOffice(page);
	const kinds = await findKinds(page);
	const required = await createKindItem(page, 'validation', {
		name: 'Messages required',
		kindId: KINDS.mandatory,
		configuration: { message: '{label} is required.' },
	});
	const digits = await createKindItem(page, 'validation', {
		name: 'Messages digits',
		kindId: KINDS.regex,
		configuration: { regex: '^\\d+$', message: '{NAME} ({alias}) must be digits.' },
	});
	// The label is not the name, so a placeholder shows which of them it was replaced with.
	const message = { ...formField(fieldKind(kinds, 'Text'), 'Your note', 'yourNote', { validations: [required] }), label: 'Message' };
	const code = formField(fieldKind(kinds, 'Text'), 'Code', 'code', { validations: [digits] });
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const { formId, layoutId } = await createForm(page, kinds, {
		name: 'Validation messages form',
		fields: [message, code, send],
		handlers: [{ kindId: STORE_DATA_KIND_ID, name: 'Store Data', alias: 'storeData', enabled: true }],
	});
	const created = await createPage(page, 'Validation messages', layoutId);
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);

		// In the browser: submitting the form empty shows the messages with the field's own values.
		const form = site.locator('form.formulate__form');
		await form.getByRole('button', { name: 'Send' }).click();
		const messageField = form.locator('.formulate__field', { hasText: 'Message' });
		await expect(messageField.locator('.formulate__inline-validation-summary')).toHaveText('Message is required.');
		const codeField = form.locator('.formulate__field', { hasText: 'Code' });
		await expect(codeField.locator('.formulate__inline-validation-summary')).toHaveText('Code (code) must be digits.');
		await expect(site.locator('body')).not.toContainText('{label}');
		expect(problems, 'no console errors').toEqual([]);

		// On the server: the form's data is posted without the browser's check, with the field empty.
		// (The renderer takes the form's data off the page, so it is read from the page's HTML, where the server wrote it.)
		const html = await (await site.request.get(created.path)).text();
		const data = JSON.parse(/formData = (\{.*\});/.exec(html)![1]!) as { data: PageFormData };
		const response = await site.request.post(data.data.url, { form: { ...data.data.payload, [data.data.fields[1]!.id]: 'abc' } });
		expect(response.ok()).toBe(true);
		const result = (await response.json()) as { Success: boolean; ValidationErrors: Array<{ FieldName: string; Messages: string[] }> };
		expect(result.Success).toBe(false);
		expect(result.ValidationErrors.map((error) => [error.FieldName, error.Messages])).toEqual([
			['Your note', ['Message is required.']],
			['Code', ['Code (code) must be digits.']],
		]);
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId], validationIds: [required, digits] });
	}
});
