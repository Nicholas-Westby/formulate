import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse } from '../test/fake-api.js';
import { createTestHost } from '../test/test-host.js';
import {
	FormulateDataValuesFolderRepository,
	FormulateFormsFolderRepository,
	FormulateValidationsFolderRepository,
} from './folder.repository.js';
import { FormulateFolderStore } from './folder.store.js';

const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate folder repositories', () => {
	it('create folders in their own tree, and keep them for workspaces to observe', async () => {
		const bodies: Array<unknown> = [];
		fakeApi(async (request) => {
			if (request.method === 'POST') {
				bodies.push(JSON.parse(await request.text()));
				return new Response(null, { status: 201 });
			}

			const treeAlias = (bodies.at(-1) as { treeAlias: string }).treeAlias;
			return jsonResponse({ id: FOLDER_ID, name: `In ${treeAlias}`, parentId: null, treeAlias });
		});
		const host = createTestHost();
		new FormulateFolderStore(host);
		const repositories = [
			new FormulateFormsFolderRepository(host),
			new FormulateDataValuesFolderRepository(host),
			new FormulateValidationsFolderRepository(host),
		];

		const created = [];
		for (const repository of repositories) {
			const { data: scaffold } = await repository.createScaffold();
			const { data } = await repository.create({ ...scaffold!, unique: FOLDER_ID, name: 'New folder' }, null);
			created.push(data);
		}

		expect(bodies.map((body) => (body as { treeAlias: string }).treeAlias)).toStrictEqual([
			'forms',
			'data-values',
			'validations',
		]);
		expect(created).toStrictEqual([
			{ entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'In forms' },
			{ entityType: 'formulate-data-values-folder', unique: FOLDER_ID, name: 'In data-values' },
			{ entityType: 'formulate-validation-folder', unique: FOLDER_ID, name: 'In validations' },
		]);

		const stored = await new Promise((resolve) => {
			void repositories[2]!.byUnique(FOLDER_ID).then((observable) => observable.subscribe(resolve));
		});
		expect(stored).toStrictEqual({ entityType: 'formulate-validation-folder', unique: FOLDER_ID, name: 'In validations' });
	});

	it("keeps a folder the API refuses to delete (409), and shows the server's reason", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const reason = `id: The folder holds ${FORM_ID}, which is not a kind of item that can be deleted here. Nothing was deleted.`;
		fakeApi((request) =>
			request.method === 'DELETE'
				? jsonResponse({ type: 'Error', title: 'Conflict', status: 409, detail: reason, field: 'id' }, 409)
				: jsonResponse({ id: FOLDER_ID, name: 'Archive', parentId: null, treeAlias: 'forms' }),
		);
		const host = createTestHost();
		new FormulateFolderStore(host);
		const notifications = new UmbNotificationContext(host);
		const peek = vi.spyOn(notifications, 'peek');
		const repository = new FormulateFormsFolderRepository(host);
		await repository.requestByUnique(FOLDER_ID);

		const { error } = await repository.delete(FOLDER_ID);

		expect(error).toBeDefined();
		// Umbraco's error notification shows the title, with the server's reason under it.
		await expect.poll(() => peek.mock.calls.length).toBe(1);
		const [color, args] = peek.mock.calls[0]!;
		const data = (args as { data: { message?: string; detail?: string } }).data;
		expect([color, data.message, data.detail]).toStrictEqual(['danger', 'Conflict', reason]);
		const stored = await new Promise((resolve) => {
			void repository.byUnique(FOLDER_ID).then((observable) => observable.subscribe(resolve));
		});
		expect(stored).toStrictEqual({ entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'Archive' });
	});
});
