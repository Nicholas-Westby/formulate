import { afterEach, describe, expect, it } from 'vitest';
import { fakeApi, jsonResponse } from '../test/fake-api.js';
import { createTestHost } from '../test/test-host.js';
import {
	FormulateDataValuesTreeRepository,
	FormulateFormsTreeRepository,
	FormulateValidationsTreeRepository,
} from './tree.repository.js';

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate tree repositories', () => {
	it('give each tree a root of its own, built in the client', async () => {
		fakeApi(() => jsonResponse({ total: 1, items: [] }));
		const host = createTestHost();

		const roots = await Promise.all(
			[FormulateFormsTreeRepository, FormulateDataValuesTreeRepository, FormulateValidationsTreeRepository].map(
				async (Repository) => (await new Repository(host).requestTreeRoot()).data,
			),
		);

		expect(roots).toStrictEqual([
			{
				unique: null,
				entityType: 'formulate-forms-root',
				name: '#formulate_forms',
				hasChildren: true,
				isFolder: true,
			},
			{
				unique: null,
				entityType: 'formulate-data-values-root',
				name: '#formulate_dataValues',
				hasChildren: true,
				isFolder: true,
			},
			{
				unique: null,
				entityType: 'formulate-validations-root',
				name: '#formulate_validationLibrary',
				hasChildren: true,
				isFolder: true,
			},
		]);
	});

	it('offer to expand a root only when its tree has items', async () => {
		const requests = fakeApi((request) =>
			new URL(request.url).pathname.includes('/forms/')
				? jsonResponse({ total: 3, items: [] })
				: jsonResponse({ total: 0, items: [] }),
		);
		const host = createTestHost();

		const forms = await new FormulateFormsTreeRepository(host).requestTreeRoot();
		const validations = await new FormulateValidationsTreeRepository(host).requestTreeRoot();

		expect(forms.data?.hasChildren).toBe(true);
		expect(validations.data?.hasChildren).toBe(false);
		// One item is enough: the answer's total says whether there is anything to show.
		expect(requests.map((request) => new URL(request.url).pathname + new URL(request.url).search)).toStrictEqual([
			'/umbraco/management/api/v1/formulate/tree/forms/root?skip=0&take=1',
			'/umbraco/management/api/v1/formulate/tree/validations/root?skip=0&take=1',
		]);
	});

	it('read the items of their own tree', async () => {
		const requests = fakeApi(() => jsonResponse({ total: 0, items: [] }));
		const host = createTestHost();

		await new FormulateFormsTreeRepository(host).requestTreeRootItems({ paging: { skip: 0, take: 50 } });
		await new FormulateDataValuesTreeRepository(host).requestTreeRootItems({ paging: { skip: 0, take: 50 } });
		await new FormulateValidationsTreeRepository(host).requestTreeRootItems({ paging: { skip: 0, take: 50 } });

		expect(requests.map((request) => new URL(request.url).pathname)).toStrictEqual([
			'/umbraco/management/api/v1/formulate/tree/forms/root',
			'/umbraco/management/api/v1/formulate/tree/data-values/root',
			'/umbraco/management/api/v1/formulate/tree/validations/root',
		]);
	});
});
