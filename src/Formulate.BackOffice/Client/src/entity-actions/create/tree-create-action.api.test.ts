import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbEntityContext } from '@umbraco-cms/backoffice/entity';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import type { UmbTreeCreateOption } from '@umbraco-cms/backoffice/tree';
import { UMB_FOLDER_CREATE_MODAL } from '@umbraco-cms/backoffice/tree';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOptionModel } from '../../api/index.js';
import { fakeApi, jsonResponse } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateTreeCreateActionApi } from './tree-create-action.api.js';

const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_KIND_ID = '61244083-bd75-417b-af77-dfa8f8dc2673';
const BASIC_FORM_KIND_ID = '3a11bd58-0ac6-43d7-8f63-2f88e7c132af';

// As the API lists them: the folder first.
const FORM_OPTIONS: Array<CreateOptionModel> = [
	{ entityType: 'formulate-form-folder', name: 'Folder', icon: 'icon-folder' },
	{ entityType: 'formulate-form', kindId: BASIC_FORM_KIND_ID, name: 'Form with Basic Layout', icon: 'icon-document' },
	{ entityType: 'formulate-form', kindId: FORM_KIND_ID, name: 'Form', icon: 'icon-document' },
];

/**
 * A tree's root or folder page, as Umbraco shows it: the tree in the page says which item it starts at, and the
 * Create button above the tree takes its options from the tree action's API.
 */
function createPage(entityType: string, unique: string | null) {
	const requests: Array<string> = [];
	fakeApi((request) => {
		requests.push(`${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`);
		return jsonResponse(FORM_OPTIONS);
	});
	const host = createTestHost();
	new UmbNotificationContext(host);
	const events = new UmbActionEventContext(host);
	const modals = new UmbModalManagerContext(host);
	const open = vi.spyOn(modals, 'open').mockImplementation(
		() => ({ onSubmit: () => Promise.reject(new Error('Cancelled')) }) as unknown as UmbModalContext,
	);
	const entity = new UmbEntityContext(host);
	entity.setEntityType(entityType);
	entity.setUnique(unique);
	const api = new FormulateTreeCreateActionApi(host as never);
	let options: Array<UmbTreeCreateOption> = [];
	let multiple: boolean | undefined;
	api.options.subscribe((value) => (options = value));
	api.multipleOptions.subscribe((value) => (multiple = value));

	return { api, open, events, requests, options: () => options, multiple: () => multiple };
}

beforeEach(() => {
	// The back office resolves its paths against this base, as its page does.
	const base = document.createElement('base');
	base.href = '/umbraco/';
	document.head.append(base);
	history.replaceState(null, '', '/umbraco/section/formulate/workspace/formulate-forms-root');
});

afterEach(() => {
	document.head.querySelector('base')?.remove();
	document.body.replaceChildren();
	history.replaceState(null, '', '/');
});

describe('Formulate tree create action', () => {
	it("offers what the API says can be created at the top of the tree, with the folder last, as core's Create button does", async () => {
		const { options, multiple, requests } = createPage('formulate-forms-root', null);

		await expect.poll(() => options().length).toBe(3);

		expect(requests).toStrictEqual(['GET /umbraco/management/api/v1/formulate/tree/forms/create-options']);
		expect(options().map(({ label, icon, additionalOptions }) => [label, icon, additionalOptions])).toStrictEqual([
			['Form with Basic Layout', 'icon-document', true],
			['Form', 'icon-document', true],
			// Umbraco's own word for it.
			['#create_folder', 'icon-folder', true],
		]);
		// A kind opens its workspace on the create route (a path the back office's base resolves); the folder opens
		// the folder dialog, so it has no link.
		expect(options().map(({ href }) => href)).toStrictEqual([
			`section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${BASIC_FORM_KIND_ID}`,
			`section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${FORM_KIND_ID}`,
			undefined,
		]);
		expect(multiple()).toBe(true);
	});

	it("offers what can be created in a folder, from the folder's page", async () => {
		const { options, requests } = createPage('formulate-form-folder', FOLDER_ID);

		await expect.poll(() => options().length).toBe(3);

		expect(requests).toStrictEqual([`GET /umbraco/management/api/v1/formulate/tree/forms/create-options?parentId=${FOLDER_ID}`]);
		expect(options()[0]!.href).toBe(
			`section/formulate/workspace/formulate-form/create/parent/formulate-form-folder/${FOLDER_ID}/${BASIC_FORM_KIND_ID}`,
		);
	});

	it("creates a folder with Umbraco's folder dialog", async () => {
		const { api, options, open } = createPage('formulate-forms-root', null);
		await expect.poll(() => options().length).toBe(3);

		await api.executeByAlias(options()[2]!.alias);

		expect(open.mock.calls.map(([, token]) => String(token))).toStrictEqual([String(UMB_FOLDER_CREATE_MODAL)]);
	});

	it('opens the workspace of a kind on the create route when its option is run without its link', async () => {
		const { api, options } = createPage('formulate-forms-root', null);
		await expect.poll(() => options().length).toBe(3);

		await api.executeByAlias(options()[1]!.alias);

		expect(location.pathname).toBe(
			`/umbraco/section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${FORM_KIND_ID}`,
		);
	});

	it('offers nothing outside a Formulate tree', async () => {
		const { options, requests } = createPage('document', null);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect([options(), requests]).toStrictEqual([[], []]);
	});
});
