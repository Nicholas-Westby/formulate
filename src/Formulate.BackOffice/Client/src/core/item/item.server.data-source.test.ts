import { afterEach, describe, expect, it } from 'vitest';
import type { FormulateItemResponseModel } from '../../api/index.js';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateItemRepository } from './item.repository.js';
import { FormulateItemServerDataSource } from './item.server.data-source.js';
import { FormulateItemStore } from './item.store.js';

const API = '/umbraco/management/api/v1/formulate';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const LAYOUT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03';
const VALIDATION_ID = 'c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e04';
const DATA_VALUES_ID = 'e5f6a7b8-c9d0-4e1f-9a2b-3c4d5e6f7a05';
const KIND_ID = 'f0e1d2c3-b4a5-4968-8776-655443322106';

function apiItem(
	item: Pick<FormulateItemResponseModel, 'id' | 'name' | 'entityType'> & Partial<FormulateItemResponseModel>,
): FormulateItemResponseModel {
	return { icon: 'icon-document', kindId: null, parentId: null, parentName: null, ...item };
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate item data source', () => {
	it('reads several items of any tree in one request', async () => {
		const requests = fakeApi(() =>
			jsonResponse([
				apiItem({ id: LAYOUT_ID, name: 'Contact layout', entityType: 'formulate-layout', icon: 'icon-layout', kindId: KIND_ID, parentId: FORM_ID, parentName: 'Contact' }),
				apiItem({ id: VALIDATION_ID, name: 'Required', entityType: 'formulate-validation', icon: 'icon-check' }),
			]),
		);
		const dataSource = new FormulateItemServerDataSource(createTestHost());

		const { data } = await dataSource.getItems([LAYOUT_ID, VALIDATION_ID]);

		expect(requests.map(pathAndQuery)).toStrictEqual([`${API}/item?id=${LAYOUT_ID}&id=${VALIDATION_ID}`]);
		expect(data).toStrictEqual([
			{
				entityType: 'formulate-layout',
				unique: LAYOUT_ID,
				name: 'Contact layout',
				icon: 'icon-layout',
				kindId: KIND_ID,
				parent: { unique: FORM_ID, entityType: 'formulate-form' },
				parentName: 'Contact',
			},
			{
				entityType: 'formulate-validation',
				unique: VALIDATION_ID,
				name: 'Required',
				icon: 'icon-check',
				kindId: null,
				parent: { unique: null, entityType: 'formulate-validations-root' },
				parentName: null,
			},
		]);
	});

	it("gives an item in a folder that folder, with its own tree's folder type", async () => {
		fakeApi(() =>
			jsonResponse([
				apiItem({ id: FORM_ID, name: 'Contact', entityType: 'formulate-form', parentId: FOLDER_ID, parentName: 'Contact forms' }),
				apiItem({ id: DATA_VALUES_ID, name: 'Countries', entityType: 'formulate-data-values', parentId: FOLDER_ID }),
				apiItem({ id: VALIDATION_ID, name: 'Patterns', entityType: 'formulate-validation-folder', parentId: FOLDER_ID }),
			]),
		);
		const dataSource = new FormulateItemServerDataSource(createTestHost());

		const { data } = await dataSource.getItems([FORM_ID, DATA_VALUES_ID, VALIDATION_ID]);

		expect(data?.map((item) => item.parent)).toStrictEqual([
			{ unique: FOLDER_ID, entityType: 'formulate-form-folder' },
			{ unique: FOLDER_ID, entityType: 'formulate-data-values-folder' },
			{ unique: FOLDER_ID, entityType: 'formulate-validation-folder' },
		]);
	});

	it('keeps an item of a type it does not know, with a parent of unknown type', async () => {
		fakeApi(() => jsonResponse([apiItem({ id: FORM_ID, name: 'Odd', entityType: 'other-thing', parentId: FOLDER_ID })]));
		const dataSource = new FormulateItemServerDataSource(createTestHost());

		const { data } = await dataSource.getItems([FORM_ID]);

		expect(data?.[0]).toMatchObject({ unique: FORM_ID, entityType: 'other-thing', parent: { unique: FOLDER_ID, entityType: '' } });
	});

	it('the item repository keeps the items it reads for pickers to observe', async () => {
		fakeApi(() => jsonResponse([apiItem({ id: FORM_ID, name: 'Contact', entityType: 'formulate-form' })]));
		const host = createTestHost();
		new FormulateItemStore(host);
		const repository = new FormulateItemRepository(host);

		const { data, asObservable } = await repository.requestItems([FORM_ID]);
		const stored = await new Promise((resolve) => asObservable()?.subscribe(resolve));

		expect(data?.map((item) => item.name)).toStrictEqual(['Contact']);
		expect(stored).toStrictEqual(data);
	});
});
