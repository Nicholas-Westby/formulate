import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbEntityDeletedEvent } from '@umbraco-cms/backoffice/entity-action';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateDeletedItemRedirectController, getOpenFormulateItems } from './deleted-item-redirect.js';

const API = '/umbraco/management/api/v1/formulate';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const LAYOUT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03';
const KIND_ID = '3a11bd58-0ac6-43d7-8f63-2f88e7c132af';
const WORKSPACE = '/umbraco/section/formulate/workspace';

/** Waits for the redirect's work, which runs after the contexts are found and the API answers. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

async function createHost() {
	const host = createTestHost();
	new UmbNotificationContext(host);
	const events = new UmbActionEventContext(host);
	new FormulateDeletedItemRedirectController(host);
	await settle();

	return {
		deleted: (entityType: string, unique: string) => events.dispatchEvent(new UmbEntityDeletedEvent({ entityType, unique })),
	};
}

beforeEach(() => {
	// The back office resolves its paths against this base, as its page does.
	const base = document.createElement('base');
	base.href = '/umbraco/';
	document.head.append(base);
});

afterEach(() => {
	document.head.querySelector('base')?.remove();
	document.body.replaceChildren();
	history.replaceState(null, '', '/');
});

describe('Formulate open items', () => {
	it('finds the item a workspace has open', () => {
		expect(getOpenFormulateItems(`${WORKSPACE}/formulate-form/edit/${FORM_ID}`)).toStrictEqual([
			{ entityType: 'formulate-form', unique: FORM_ID },
		]);
	});

	it('finds the parent a new item is being created in, and not its kind', () => {
		expect(
			getOpenFormulateItems(`${WORKSPACE}/formulate-layout/create/parent/formulate-form/${FORM_ID}/${KIND_ID}`),
		).toStrictEqual([{ entityType: 'formulate-form', unique: FORM_ID }]);
	});

	it('finds nothing for a new item at the top of a tree, a tree root or another section', () => {
		expect(getOpenFormulateItems(`${WORKSPACE}/formulate-form/create/parent/formulate-forms-root/null/${KIND_ID}`)).toStrictEqual([]);
		expect(getOpenFormulateItems(`${WORKSPACE}/formulate-forms-root`)).toStrictEqual([]);
		expect(getOpenFormulateItems(`/umbraco/section/settings/workspace/data-type/edit/${FORM_ID}`)).toStrictEqual([]);
	});

	it('finds the item in a workspace view, such as a tab of the form', () => {
		expect(getOpenFormulateItems(`${WORKSPACE}/formulate-form/edit/${FORM_ID}/view/handlers`)).toStrictEqual([
			{ entityType: 'formulate-form', unique: FORM_ID },
		]);
	});
});

describe('Formulate deleted item redirect', () => {
	it('goes to the section when the open item is deleted', async () => {
		const requests = fakeApi(() => jsonResponse([]));
		history.replaceState(null, '', `${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
		const { deleted } = await createHost();

		deleted('formulate-form', FORM_ID);
		await settle();

		expect(location.pathname).toBe('/umbraco/section/formulate');
		// The deleted item is the open one, so there is nothing to ask the API.
		expect(requests).toHaveLength(0);
	});

	it('goes to the section when the open item was deleted with its folder or form', async () => {
		const requests = fakeApi(() => jsonResponse([]));
		history.replaceState(null, '', `${WORKSPACE}/formulate-layout/edit/${LAYOUT_ID}`);
		const { deleted } = await createHost();

		deleted('formulate-form-folder', FOLDER_ID);
		await settle();

		expect(requests.map(pathAndQuery)).toStrictEqual([`${API}/item?id=${LAYOUT_ID}`]);
		expect(location.pathname).toBe('/umbraco/section/formulate');
	});

	it('stays on an open item that still exists', async () => {
		const requests = fakeApi(() =>
			jsonResponse([
				{ id: FORM_ID, entityType: 'formulate-form', name: 'Contact', icon: 'icon-document', parentId: null },
			]),
		);
		history.replaceState(null, '', `${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
		const { deleted } = await createHost();

		deleted('formulate-form-folder', FOLDER_ID);
		await settle();

		expect(requests.map(pathAndQuery)).toStrictEqual([`${API}/item?id=${FORM_ID}`]);
		expect(location.pathname).toBe(`${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
	});

	it('goes to the section when the folder a new item is being created in is deleted', async () => {
		fakeApi(() => jsonResponse([]));
		const path = `${WORKSPACE}/formulate-form/create/parent/formulate-form-folder/${FOLDER_ID}/${KIND_ID}`;
		history.replaceState(null, '', path);
		const { deleted } = await createHost();

		deleted('formulate-form-folder', FOLDER_ID);
		await settle();

		expect(location.pathname).toBe('/umbraco/section/formulate');
	});

	it("ignores deletes outside Formulate's trees", async () => {
		const requests = fakeApi(() => jsonResponse([]));
		history.replaceState(null, '', `${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
		const { deleted } = await createHost();

		deleted('data-type', FORM_ID);
		await settle();

		expect(requests).toHaveLength(0);
		expect(location.pathname).toBe(`${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
	});

	it('stays put when the API cannot say whether the open item exists', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const requests = fakeApi(() =>
			jsonResponse({ type: 'Error', title: 'Server error', status: 500, detail: 'Oops.' }, 500),
		);
		history.replaceState(null, '', `${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
		const { deleted } = await createHost();

		deleted('formulate-form-folder', FOLDER_ID);
		await settle();

		expect(requests).toHaveLength(1);
		expect(location.pathname).toBe(`${WORKSPACE}/formulate-form/edit/${FORM_ID}`);
	});
});
