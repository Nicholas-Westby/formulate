import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FormulateTreeItemResponseModel } from '../api/index.js';
import { fakeApi, jsonResponse } from '../test/fake-api.js';
import { createTestHost } from '../test/test-host.js';
import {
	FormulateDataValuesTreeServerDataSource,
	FormulateFormsTreeServerDataSource,
	FormulateValidationsTreeServerDataSource,
} from './tree.server.data-source.js';

const TREE_API = '/umbraco/management/api/v1/formulate/tree';

const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const LAYOUT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03';
const KIND_ID = 'f0e1d2c3-b4a5-4968-8776-655443322104';

function apiItem(
	item: Pick<FormulateTreeItemResponseModel, 'id' | 'name' | 'entityType'> & Partial<FormulateTreeItemResponseModel>,
): FormulateTreeItemResponseModel {
	return { hasChildren: false, isFolder: false, icon: 'icon-document', parent: null, kindId: null, isLegacy: false, ...item };
}

function page(...items: Array<FormulateTreeItemResponseModel>) {
	return jsonResponse({ total: items.length, items });
}

function query(request: Request) {
	return Object.fromEntries(new URL(request.url).searchParams);
}

function path(request: Request) {
	return new URL(request.url).pathname;
}

/** A level of `count` forms (Form 000, Form 001 and so on), in the order the API lists them. */
function level(count: number, parentId: string | null = null) {
	return Array.from({ length: count }, (_, index) =>
		apiItem({
			id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
			name: `Form ${String(index).padStart(3, '0')}`,
			entityType: 'formulate-form',
			parent: parentId === null ? null : { id: parentId },
		}),
	);
}

/** Answers every request with the page of `items` it asks for, as the API does. */
function servePages(items: Array<FormulateTreeItemResponseModel>) {
	return fakeApi((request) => {
		const skip = Number(query(request).skip ?? 0);
		const take = Number(query(request).take ?? 100);
		return jsonResponse({ total: items.length, items: items.slice(skip, skip + take) });
	});
}

function ids(items: Array<{ unique: string | null }> | Array<FormulateTreeItemResponseModel> | undefined) {
	return items?.map((item) => ('unique' in item ? item.unique : item.id));
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate tree data source', () => {
	it('tree data source maps API items to tree items (parent, folder flag, icon)', async () => {
		const folder = apiItem({
			id: FOLDER_ID,
			name: 'Contact forms',
			entityType: 'formulate-form-folder',
			isFolder: true,
			hasChildren: true,
			icon: 'icon-folder',
		});
		const form = apiItem({
			id: FORM_ID,
			name: 'Contact',
			entityType: 'formulate-form',
			hasChildren: true,
			parent: { id: FOLDER_ID },
		});
		const layout = apiItem({
			id: LAYOUT_ID,
			name: 'Contact layout',
			entityType: 'formulate-layout',
			icon: 'icon-layout',
			parent: { id: FORM_ID },
			kindId: KIND_ID,
		});
		fakeApi((request) => {
			if (path(request).endsWith('/forms/root')) return page(folder);
			if (query(request).parentId === FOLDER_ID) return page(form);
			if (query(request).parentId === FORM_ID) return page(layout);
			return jsonResponse({ title: 'Item not found', status: 404 }, 404);
		});
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		const rootItems = await dataSource.getRootItems({});
		const folderItems = await dataSource.getChildrenOf({
			parent: { unique: FOLDER_ID, entityType: 'formulate-form-folder' },
		});
		const formItems = await dataSource.getChildrenOf({ parent: { unique: FORM_ID, entityType: 'formulate-form' } });

		expect(rootItems.data?.items).toStrictEqual([
			{
				unique: FOLDER_ID,
				entityType: 'formulate-form-folder',
				name: 'Contact forms',
				hasChildren: true,
				isFolder: true,
				icon: 'icon-folder',
				parent: { unique: null, entityType: 'formulate-forms-root' },
			},
		]);
		expect(folderItems.data?.items).toStrictEqual([
			{
				unique: FORM_ID,
				entityType: 'formulate-form',
				name: 'Contact',
				hasChildren: true,
				isFolder: false,
				icon: 'icon-document',
				parent: { unique: FOLDER_ID, entityType: 'formulate-form-folder' },
			},
		]);
		expect(formItems.data?.items).toStrictEqual([
			{
				unique: LAYOUT_ID,
				entityType: 'formulate-layout',
				name: 'Contact layout',
				hasChildren: false,
				isFolder: false,
				icon: 'icon-layout',
				parent: { unique: FORM_ID, entityType: 'formulate-form' },
			},
		]);
	});

	it('gives parents the root and folder entity types of its own tree', async () => {
		const dataValues = apiItem({
			id: FORM_ID,
			name: 'Countries',
			entityType: 'formulate-data-values',
			icon: 'icon-bulleted-list',
			parent: { id: FOLDER_ID },
		});
		const validation = apiItem({ id: LAYOUT_ID, name: 'Required', entityType: 'formulate-validation', icon: 'icon-check' });
		fakeApi((request) => (path(request).includes('/data-values/') ? page(dataValues) : page(validation)));
		const host = createTestHost();

		const dataValuesItems = await new FormulateDataValuesTreeServerDataSource(host).getRootItems({});
		const validationItems = await new FormulateValidationsTreeServerDataSource(host).getRootItems({});

		expect(dataValuesItems.data?.items[0]?.parent).toStrictEqual({
			unique: FOLDER_ID,
			entityType: 'formulate-data-values-folder',
		});
		expect(validationItems.data?.items[0]?.parent).toStrictEqual({
			unique: null,
			entityType: 'formulate-validations-root',
		});
	});

	it('paging args become skip/take query', async () => {
		const requests = fakeApi(() => page());
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		await dataSource.getRootItems({ paging: { skip: 20, take: 10 } });
		await dataSource.getChildrenOf({
			parent: { unique: FOLDER_ID, entityType: 'formulate-form-folder' },
			paging: { skip: 0, take: 50 },
			foldersOnly: true,
		});

		expect(requests.map(path)).toStrictEqual([`${TREE_API}/forms/root`, `${TREE_API}/forms/children`]);
		expect(requests.map(query)).toStrictEqual([
			{ skip: '20', take: '10' },
			{ parentId: FOLDER_ID, skip: '0', take: '50', foldersOnly: 'true' },
		]);
	});

	it('load next after the first page returns the items after the target', async () => {
		const forms = level(150);
		const requests = servePages(forms);
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		// What Umbraco's "Load more" asks for once the first 100 items are shown.
		const result = await dataSource.getRootItems({
			paging: { target: { unique: forms[99]!.id, entityType: 'formulate-form' }, takeBefore: 0, takeAfter: 100 },
		});

		// Like Umbraco's siblings endpoints, the answer starts with the target itself.
		expect(ids(result.data?.items)).toStrictEqual(ids(forms.slice(99)));
		expect(result.data).toMatchObject({ total: 150, totalBefore: 99, totalAfter: 0 });
		expect(requests.map(query)).toStrictEqual([
			{ skip: '0', take: '100' },
			{ skip: '100', take: '100' },
		]);
	});

	it('load previous returns the items before the target', async () => {
		const forms = level(150);
		servePages(forms);
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		// What Umbraco asks for when items before the first shown one are left to load.
		const result = await dataSource.getRootItems({
			paging: { target: { unique: forms[120]!.id, entityType: 'formulate-form' }, takeBefore: 100, takeAfter: 0 },
		});

		expect(ids(result.data?.items)).toStrictEqual(ids(forms.slice(20, 121)));
		expect(result.data).toMatchObject({ total: 150, totalBefore: 20, totalAfter: 29 });
	});

	it('reads the level page by page until it has the target and the items after it', async () => {
		const forms = level(250, FOLDER_ID);
		const requests = servePages(forms);
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		// The API pages by skip and take only, so finding a target means reading from the start.
		const result = await dataSource.getChildrenOf({
			parent: { unique: FOLDER_ID, entityType: 'formulate-form-folder' },
			paging: { target: { unique: forms[198]!.id, entityType: 'formulate-form' }, takeBefore: 2, takeAfter: 5 },
		});

		expect(ids(result.data?.items)).toStrictEqual(ids(forms.slice(196, 204)));
		expect(result.data).toMatchObject({ total: 250, totalBefore: 196, totalAfter: 46 });
		expect(requests.map(query)).toStrictEqual([
			{ parentId: FOLDER_ID, skip: '0', take: '100' },
			{ parentId: FOLDER_ID, skip: '100', take: '100' },
			{ parentId: FOLDER_ID, skip: '200', take: '100' },
		]);
	});

	it('tells Umbraco that a target no longer in the level was not found', async () => {
		const requests = servePages(level(150));
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
		const dataSource = new FormulateFormsTreeServerDataSource(host);

		const result = await dataSource.getRootItems({
			paging: { target: { unique: FORM_ID, entityType: 'formulate-form' }, takeBefore: 0, takeAfter: 100 },
		});

		// Umbraco's tree looks for "not found" in the message. It then tries again from the item before the
		// target, or loads the level from the start, so the user is not told about it.
		expect(result.data).toBeUndefined();
		expect(result.error?.message).toContain('not found');
		expect(peek).not.toHaveBeenCalled();
		expect(requests.map(query)).toStrictEqual([
			{ skip: '0', take: '100' },
			{ skip: '100', take: '100' },
		]);
	});

	it('reads the children of the root from the root endpoint', async () => {
		const requests = fakeApi(() => page());
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		await dataSource.getChildrenOf({
			parent: { unique: null, entityType: 'formulate-forms-root' },
			paging: { skip: 0, take: 50 },
		});

		expect(requests.map(path)).toStrictEqual([`${TREE_API}/forms/root`]);
		expect(requests.map(query)).toStrictEqual([{ skip: '0', take: '50' }]);
	});

	it('reports how many items come before and after the page', async () => {
		const items = [1, 2, 3, 4, 5].map((n) =>
			apiItem({ id: `00000000-0000-4000-8000-00000000000${n}`, name: `Form ${n}`, entityType: 'formulate-form' }),
		);
		fakeApi(() => jsonResponse({ total: 30, items }));
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		const result = await dataSource.getRootItems({ paging: { skip: 20, take: 5 } });

		expect(result.data).toMatchObject({ total: 30, totalBefore: 20, totalAfter: 5 });
		expect(result.data?.items).toHaveLength(5);
	});

	it('requests the ancestors of an item and maps them', async () => {
		const requests = fakeApi(() =>
			jsonResponse([
				apiItem({ id: FOLDER_ID, name: 'Contact forms', entityType: 'formulate-form-folder', isFolder: true, icon: 'icon-folder' }),
				apiItem({ id: FORM_ID, name: 'Contact', entityType: 'formulate-form', parent: { id: FOLDER_ID } }),
				apiItem({ id: LAYOUT_ID, name: 'Contact layout', entityType: 'formulate-layout', parent: { id: FORM_ID } }),
			]),
		);
		const dataSource = new FormulateFormsTreeServerDataSource(createTestHost());

		const result = await dataSource.getAncestorsOf({ treeItem: { unique: LAYOUT_ID, entityType: 'formulate-layout' } });

		expect(requests.map(path)).toStrictEqual([`${TREE_API}/forms/ancestors`]);
		expect(requests.map(query)).toStrictEqual([{ descendantId: LAYOUT_ID }]);
		expect(result.data?.map((item) => [item.unique, item.parent])).toStrictEqual([
			[FOLDER_ID, { unique: null, entityType: 'formulate-forms-root' }],
			[FORM_ID, { unique: FOLDER_ID, entityType: 'formulate-form-folder' }],
			[LAYOUT_ID, { unique: FORM_ID, entityType: 'formulate-form' }],
		]);
	});
});
