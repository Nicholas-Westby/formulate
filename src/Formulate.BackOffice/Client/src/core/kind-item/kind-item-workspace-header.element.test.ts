import '@umbraco-cms/backoffice/components';
import type { UmbInputWithAliasElement } from '@umbraco-cms/backoffice/components';
import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FormulateDataValuesWorkspaceContext } from '../../data-values/workspace/data-values-workspace.context.js';
import { jsonResponse } from '../../test/fake-api.js';
import {
	createWorkspaceHost,
	destroyKept,
	ID,
	keep,
	LEGACY,
	MANDATORY,
	REGEX_VALIDATION,
	registerKindItemRepositories,
	serve,
} from '../../test/kind-items.js';
import { FormulateValidationWorkspaceContext } from '../../validations/workspace/validation-workspace.context.js';
import { FormulateKindItemWorkspaceHeaderElement } from './kind-item-workspace-header.element.js';

/** Shows the header in a workspace's host, as the workspace editor does. */
async function renderHeader(host: HTMLElement) {
	const header = new FormulateKindItemWorkspaceHeaderElement();
	host.append(header);
	await header.updateComplete;
	const input = header.shadowRoot!.querySelector('umb-input-with-alias') as UmbInputWithAliasElement;
	await input.updateComplete;
	// The text of the validation messages shown with the input.
	const messages = () =>
		[...(header.shadowRoot!.querySelector('umb-form-validation-message')?.shadowRoot?.querySelectorAll('#messages > div') ?? [])].map(
			(message) => message.textContent?.trim(),
		);

	return { header, input, messages };
}

/** Types into the header's input as a user does: it takes the text, then says it changed. */
function type(input: UmbInputWithAliasElement, change: { name?: string; alias?: string }) {
	if (change.name !== undefined) input.value = change.name;
	if (change.alias !== undefined) input.alias = change.alias;
	input.dispatchEvent(new UmbChangeEvent());
}

beforeAll(registerKindItemRepositories);

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

describe('Formulate validation and data values workspace header', () => {
	it("shows the item's name and alias, and stores what is typed", async () => {
		serve([REGEX_VALIDATION]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);
		const { header, input } = await renderHeader(host);
		await header.updateComplete;

		// umb-input-with-alias leaves autoGenerateAlias undefined until it is set.
		expect([input.value, input.alias, Boolean(input.autoGenerateAlias), input.readonly]).toStrictEqual(['Zip code', 'zipCode', false, false]);

		type(input, { name: 'Postcode', alias: 'postcode' });

		expect([context.getName(), context.getAlias()]).toStrictEqual(['Postcode', 'postcode']);
	});

	it('makes the alias from the name for a new item, until the alias is unlocked', async () => {
		serve();
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.create({ entityType: 'formulate-validations-root', unique: null }, MANDATORY);
		const { header, input } = await renderHeader(host);
		await header.updateComplete;

		// umb-input-with-alias makes the alias itself while auto-generate-alias is set.
		expect([input.required, input.autoGenerateAlias]).toStrictEqual([true, true]);
	});

	it('changes nothing for legacy data values', async () => {
		serve([{ id: ID, name: 'Old colors', alias: null, parentId: null, kindId: LEGACY, isLegacy: true, configuration: null }]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateDataValuesWorkspaceContext(host));
		await context.load(ID);
		const { header, input } = await renderHeader(host);
		await header.updateComplete;

		expect(input.readonly).toBe(true);
	});

	it.each([
		['alias', 'alias: The alias is already in use.', 'The alias is already in use.', { alias: 'zip' }],
		['name', 'name: The name is required.', 'The name is required.', { name: 'Zip' }],
	])('shows a problem the API reports for the %s on the input, until it changes', async (field, detail, message, change) => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		serve([REGEX_VALIDATION], () => jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail, field }, 400));
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);
		const { header, input, messages } = await renderHeader(host);

		await expect(context.requestSubmit()).rejects.toBeDefined();
		await header.updateComplete;

		await expect.poll(messages).toStrictEqual([message]);
		expect([input.validity.valid, input.validationMessage]).toStrictEqual([false, message]);

		type(input, change);
		await header.updateComplete;

		await expect.poll(messages).toStrictEqual([]);
		expect(input.validity.valid).toBe(true);
	});
});
