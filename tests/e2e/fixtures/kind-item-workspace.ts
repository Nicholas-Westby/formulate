import { expect, type Locator, type Page } from '@playwright/test';

/** The parts of a validation or data values workspace the tests use. */
export function kindItemWorkspace(page: Page) {
	const header = page.locator('formulate-kind-item-workspace-header');
	const settings = page.locator('formulate-kind-item-workspace-view-settings');

	return {
		/** The name input. */
		name: header.getByRole('textbox', { name: 'Enter a name...', exact: true }),
		/** The alias input, while the alias can be changed. */
		alias: header.getByRole('textbox', { name: 'Enter alias...', exact: true }),
		/** The messages shown under the name and alias. */
		headerMessages: header.locator('umb-form-validation-message'),
		/** The Settings view: the kind's editor in a box named after the kind. */
		settings,
		/** The box around the kind's editor. */
		box: settings.locator('uui-box'),
		/** The workspace's Save button. */
		save: page.locator('umb-workspace-action uui-button[label="Save"]'),
		/** The footer's breadcrumb. */
		breadcrumb: page.locator('umb-workspace-breadcrumb uui-breadcrumb-item'),
	};
}

/** The values of a list of inputs, in order. */
export function valuesOf(inputs: Locator): Promise<Array<string>> {
	return inputs.evaluateAll((elements) => elements.map((element) => (element as HTMLInputElement).value));
}

/** The URL of an item's workspace in the Formulate section, such as formulate-validation/edit/{id}. */
export const WORKSPACE_URL = '/umbraco/section/formulate/workspace';

/** Matches the edit URL of an item of an entity type, and captures its ID. */
export function editUrl(entityType: string): RegExp {
	return new RegExp(`/umbraco/section/formulate/workspace/${entityType}/edit/([0-9a-f-]{36})$`);
}

/** The ID in a page's edit URL. */
export function idInUrl(page: Page, entityType: string): string {
	const id = editUrl(entityType).exec(page.url())?.[1];

	if (!id) {
		throw new Error(`${page.url()} is not the edit URL of a ${entityType}.`);
	}

	return id;
}

/**
 * Waits until the workspace has put the focus in the name for good, before anything else is typed or
 * clicked. Umbraco's umbFocus directive focuses the name when the workspace opens, then checks every
 * 100 ms until it finds the focus there; the input takes the focus a moment after it is asked, so the first
 * check always misses. Moving the focus before the next check has the focus, and the keys typed, taken
 * back to the name. A person is never that quick; a test is.
 * @param page The page.
 * @param name The name input.
 */
export async function waitForNameFocus(page: Page, name: Locator) {
	await expect(name).toBeFocused();
	// Past the directive's next check, which finds the focus in the name and stops.
	await page.waitForTimeout(250);
	await expect(name).toBeFocused();
}
