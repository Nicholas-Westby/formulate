import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures/login.ts';
import { callManagementApi } from '../fixtures/management-api.ts';
import { getUmbracoVersion, treePageSize } from '../fixtures/umbraco-version.ts';
import { screenshotPath } from '../support/screenshots.ts';

/** More forms than Umbraco shows at once (see treePageSize). */
const FORM_COUNT = 105;

interface CreateOption {
	entityType: string;
	kindId?: string | null;
	name: string;
}

test('Load more shows every form at the Forms root', async ({ page }) => {
	test.setTimeout(120_000);

	const pageSize = treePageSize(await getUmbracoVersion(page));
	const options = await callManagementApi<Array<CreateOption>>(page, 'GET', '/formulate/tree/forms/create-options');
	const formKindId = options.find((option) => option.entityType === 'formulate-form' && option.name === 'Form')?.kindId;
	expect(formKindId, 'the forms root offers the plain Form kind').toBeTruthy();

	const forms = Array.from({ length: FORM_COUNT }, (_, index) => ({
		id: randomUUID(),
		name: `Load more ${String(index + 1).padStart(3, '0')}`,
	}));

	for (const form of forms) {
		await callManagementApi(page, 'POST', '/formulate/form', {
			id: form.id,
			kindId: formKindId,
			name: form.name,
			fields: [],
			handlers: [],
		});
	}

	try {
		await page.goto('/umbraco/section/formulate');
		const root = page.locator('umb-section-sidebar').locator('uui-menu-item[label="Forms"]');
		const formItems = root.locator('uui-menu-item');
		const loadMore = root.locator('umb-tree-load-more-button');

		await root.locator('#caret-button').click();
		await expect(formItems).toHaveCount(pageSize);

		let shown = await formItems.count();
		while (shown < FORM_COUNT) {
			await loadMore.click();
			await expect(formItems, 'Load more shows more forms').not.toHaveCount(shown);
			shown = await formItems.count();
		}

		await expect(loadMore).toHaveCount(0);
		await page.screenshot({ path: screenshotPath('tree-load-more.png') });
		const names = await formItems.evaluateAll((items) => items.map((item) => item.getAttribute('label')));
		expect([...names].sort()).toStrictEqual(forms.map((form) => form.name).sort());
	} finally {
		for (const form of forms) {
			await callManagementApi(page, 'DELETE', `/formulate/form/${form.id}`);
		}
	}
});
