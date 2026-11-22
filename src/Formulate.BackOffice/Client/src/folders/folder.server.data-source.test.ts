import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse, pathAndQuery } from '../test/fake-api.js';
import { createTestHost } from '../test/test-host.js';
import {
	FormulateDataValuesFolderServerDataSource,
	FormulateFormsFolderServerDataSource,
	FormulateValidationsFolderServerDataSource,
} from './folder.server.data-source.js';

const API = '/umbraco/management/api/v1/formulate';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const PARENT_ID = '9c3e5a7b-2d4f-4e6a-8b1c-3d5f7a9b1c02';

/** The API's answer for a folder, as GET folder/{id} gives it. */
function folderResponse(name: string, treeAlias: string, parentId: string | null = null) {
	return jsonResponse({ id: FOLDER_ID, name, parentId, treeAlias });
}

/** Answers POST, PUT and DELETE as the API does, and GET with the folder. */
function serveFolder(name: string, treeAlias: string, parentId: string | null = null) {
	return fakeApi((request) => {
		if (request.method === 'POST') return new Response(null, { status: 201 });
		if (request.method === 'DELETE') return jsonResponse({ deletedIds: [FOLDER_ID] });
		return folderResponse(name, treeAlias, parentId);
	});
}

async function bodyOf(request: Request) {
	return JSON.parse(await request.clone().text());
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate folder data source', () => {
	it('scaffolds a new folder of its own tree with an ID of its own', async () => {
		const dataSource = new FormulateValidationsFolderServerDataSource(createTestHost());

		const { data: first } = await dataSource.createScaffold();
		const { data: second } = await dataSource.createScaffold();

		expect(first).toMatchObject({ entityType: 'formulate-validation-folder', name: '' });
		expect(first?.unique).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		expect(second?.unique).not.toBe(first?.unique);
	});

	it('creates a folder at the top of its tree without a parent ID, then reads it back', async () => {
		const requests = serveFolder('Contact forms', 'forms');
		const dataSource = new FormulateFormsFolderServerDataSource(createTestHost());

		const result = await dataSource.create(
			{ entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'Contact forms' },
			null,
		);

		expect(requests.map((request) => `${request.method} ${pathAndQuery(request)}`)).toStrictEqual([
			`POST ${API}/folder`,
			`GET ${API}/folder/${FOLDER_ID}`,
		]);
		// The top of a tree is not an item, so the API is given no parent ID at all.
		expect(await bodyOf(requests[0]!)).toStrictEqual({ id: FOLDER_ID, treeAlias: 'forms', name: 'Contact forms' });
		expect(result).toStrictEqual({
			data: { entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'Contact forms' },
		});
	});

	it('creates a folder in a folder with the parent ID', async () => {
		const requests = serveFolder('Countries', 'data-values', PARENT_ID);
		const dataSource = new FormulateDataValuesFolderServerDataSource(createTestHost());

		const result = await dataSource.create(
			{ entityType: 'formulate-data-values-folder', unique: FOLDER_ID, name: 'Countries' },
			PARENT_ID,
		);

		expect(await bodyOf(requests[0]!)).toStrictEqual({
			id: FOLDER_ID,
			parentId: PARENT_ID,
			treeAlias: 'data-values',
			name: 'Countries',
		});
		expect(result.data).toStrictEqual({ entityType: 'formulate-data-values-folder', unique: FOLDER_ID, name: 'Countries' });
	});

	it('reads a folder', async () => {
		const requests = serveFolder('Required fields', 'validations');
		const dataSource = new FormulateValidationsFolderServerDataSource(createTestHost());

		const result = await dataSource.read(FOLDER_ID);

		expect(requests.map(pathAndQuery)).toStrictEqual([`${API}/folder/${FOLDER_ID}`]);
		expect(result).toStrictEqual({
			data: { entityType: 'formulate-validation-folder', unique: FOLDER_ID, name: 'Required fields' },
		});
	});

	it('renames a folder', async () => {
		const requests = serveFolder('Renamed', 'forms');
		const dataSource = new FormulateFormsFolderServerDataSource(createTestHost());

		const result = await dataSource.update({ entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'Renamed' });

		expect(requests.map((request) => `${request.method} ${pathAndQuery(request)}`)).toStrictEqual([
			`PUT ${API}/folder/${FOLDER_ID}`,
		]);
		expect(await bodyOf(requests[0]!)).toStrictEqual({ name: 'Renamed' });
		expect(result.data).toStrictEqual({ entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'Renamed' });
	});

	it('deletes a folder', async () => {
		const requests = serveFolder('Contact forms', 'forms');
		const dataSource = new FormulateFormsFolderServerDataSource(createTestHost());

		const result = await dataSource.delete(FOLDER_ID);

		expect(requests.map((request) => `${request.method} ${pathAndQuery(request)}`)).toStrictEqual([
			`DELETE ${API}/folder/${FOLDER_ID}`,
		]);
		expect(result.error).toBeUndefined();
	});

	it('shows the problem the API reports, such as an ID that is taken, and reads nothing back', async () => {
		// What the API answers (Umbraco's ProblemDetailsBuilder sets the type, the field is Formulate's own).
		const detail = `id: Something with the ID ${FOLDER_ID} already exists.`;
		const requests = fakeApi(() => jsonResponse({ type: 'Error', title: 'Conflict', status: 409, detail, field: 'id' }, 409));
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const dataSource = new FormulateFormsFolderServerDataSource(host);

		const result = await dataSource.create({ entityType: 'formulate-form-folder', unique: FOLDER_ID, name: 'Copy' }, null);

		expect(result.data).toBeUndefined();
		expect(result.error?.message).toBe(detail);
		expect(requests).toHaveLength(1);
		await vi.waitFor(() =>
			expect(peek).toHaveBeenCalledWith(
				'danger',
				expect.objectContaining({
					data: expect.objectContaining({ message: 'Conflict', detail }),
				}),
			),
		);
	});
});
