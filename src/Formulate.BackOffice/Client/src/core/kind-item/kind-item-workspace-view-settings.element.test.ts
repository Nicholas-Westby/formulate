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
	REGEX_VALIDATION,
	registerKindItemRepositories,
	serve,
} from '../../test/kind-items.js';
import { FormulateValidationWorkspaceContext } from '../../validations/workspace/validation-workspace.context.js';
import type { FormulateKindEditorSlotElement } from '../kind-editor-slot.element.js';
import { FormulateKindItemWorkspaceViewSettingsElement } from './kind-item-workspace-view-settings.element.js';

/** Shows the Settings view in a workspace's host, as the workspace editor does. */
async function renderView(host: HTMLElement) {
	const view = new FormulateKindItemWorkspaceViewSettingsElement();
	host.append(view);
	await view.updateComplete;
	const slot = () => view.shadowRoot!.querySelector('formulate-kind-editor-slot') as FormulateKindEditorSlotElement | null;

	return { view, slot };
}

beforeAll(registerKindItemRepositories);

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

describe('Formulate validation and data values Settings view', () => {
	it("shows the kind's editor with the configuration, under the kind's name, and stores its changes", async () => {
		serve([REGEX_VALIDATION]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);
		const { view, slot } = await renderView(host);

		await expect.poll(() => slot()?.editorAlias).toBe('formulate-regex-validation');
		expect(view.shadowRoot!.querySelector('uui-box')?.getAttribute('headline')).toBe('Regular Expression');
		expect([slot()!.type, slot()!.value, slot()!.readonly]).toStrictEqual([
			'formulateValidationEditor',
			REGEX_VALIDATION.configuration,
			false,
		]);

		slot()!.value = { regex: '^\\d{4}$', message: 'Enter a postcode.' };
		slot()!.dispatchEvent(new UmbChangeEvent());

		expect(context.getConfiguration()).toStrictEqual({ regex: '^\\d{4}$', message: 'Enter a postcode.' });
	});

	it('shows a problem the API reports for the configuration, until the configuration changes', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		serve([REGEX_VALIDATION], () =>
			jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail: 'configuration: Not readable.', field: 'configuration' }, 400),
		);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);
		const { view, slot } = await renderView(host);
		const messages = () => [...view.shadowRoot!.querySelectorAll('#configuration-messages > *')].map((message) => message.textContent?.trim());

		await expect(context.requestSubmit()).rejects.toBeDefined();

		await expect.poll(messages).toStrictEqual(['Not readable.']);

		slot()!.value = { regex: 'x', message: 'y' };
		slot()!.dispatchEvent(new UmbChangeEvent());

		await expect.poll(messages).toStrictEqual([]);
	});

	it('gives the editor read-only legacy data values', async () => {
		serve([{ id: ID, name: 'Old colors', alias: null, parentId: null, kindId: LEGACY, isLegacy: true, configuration: null }]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateDataValuesWorkspaceContext(host));
		await context.load(ID);
		const { slot } = await renderView(host);

		await expect.poll(() => slot()?.editorAlias).toBe('formulate-legacy-data-value');
		expect([slot()!.type, slot()!.readonly]).toStrictEqual(['formulateDataValuesEditor', true]);
	});
});
