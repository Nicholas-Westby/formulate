import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbEntityDeletedEvent, UmbRequestReloadStructureForEntityEvent } from '@umbraco-cms/backoffice/entity-action';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import type { UmbDetailRepository } from '@umbraco-cms/backoffice/repository';
import { UmbApiError } from '@umbraco-cms/backoffice/resources';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormulateDataValuesDetailRepository } from '../../data-values/repository/data-values-detail.repository.js';
import { FormulateDataValuesDetailServerDataSource } from '../../data-values/repository/data-values-detail.server.data-source.js';
import { FormulateDataValuesDetailStore } from '../../data-values/repository/data-values-detail.store.js';
import { FormulateFormDetailRepository } from '../../forms/repository/form-detail.repository.js';
import { FormulateFormDetailServerDataSource } from '../../forms/repository/form-detail.server.data-source.js';
import { FormulateFormDetailStore } from '../../forms/repository/form-detail.store.js';
import { FormulateLayoutDetailRepository } from '../../layouts/repository/layout-detail.repository.js';
import { FormulateLayoutDetailServerDataSource } from '../../layouts/repository/layout-detail.server.data-source.js';
import { FormulateLayoutDetailStore } from '../../layouts/repository/layout-detail.store.js';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateValidationDetailRepository } from '../../validations/repository/validation-detail.repository.js';
import { FormulateValidationDetailServerDataSource } from '../../validations/repository/validation-detail.server.data-source.js';
import { FormulateValidationDetailStore } from '../../validations/repository/validation-detail.store.js';

const API = '/umbraco/management/api/v1/formulate';
const ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '9c3e5a7b-2d4f-4e6a-8b1c-3d5f7a9b1c02';
const KIND_ID = 'f0e1d2c3-b4a5-4968-8776-655443322104';
const TEMPLATE_ID = 'a8b7c6d5-e4f3-4a2b-9c1d-0e9f8a7b6c05';

const FIELD = { id: 'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f06', kindId: KIND_ID, name: 'Name', alias: 'name', label: 'Your name', category: null, validations: [], configuration: { maxLength: 40 } };
const HANDLER = { id: 'e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a07', kindId: KIND_ID, name: 'Store', alias: 'store', enabled: true, configuration: {} };

/** The API's answers, as GET {type}/{id} and PUT {type}/{id} give them. */
const RESPONSES = {
	form: { id: ID, name: 'Contact', alias: 'contact', parentId: FOLDER_ID, fields: [FIELD], handlers: [HANDLER] },
	layout: { id: ID, name: 'Contact layout', alias: null, formId: FORM_ID, kindId: KIND_ID, templateId: TEMPLATE_ID, configuration: { autoPopulate: true, rows: [] } },
	validation: { id: ID, name: 'Required', alias: 'required', parentId: null, kindId: KIND_ID, configuration: { message: 'Please fill this in.' } },
	dataValues: { id: ID, name: 'Countries', alias: null, parentId: FOLDER_ID, kindId: KIND_ID, isLegacy: false, configuration: { items: [{ value: 'NL' }] } },
};

/** Answers like the API: 201 for POST, the deleted IDs for DELETE, and the item for GET and PUT. */
function serve(response: unknown) {
	return fakeApi((request) => {
		if (request.method === 'POST') return new Response(null, { status: 201 });
		if (request.method === 'DELETE') return jsonResponse({ deletedIds: [ID] });
		return jsonResponse(response);
	});
}

/** Each request as [method and path], or [method and path, JSON body]. */
async function describeRequests(requests: Array<Request>) {
	return Promise.all(
		requests.map(async (request) => {
			const head = `${request.method} ${pathAndQuery(request)}`;
			const body = await request.clone().text();
			return body ? [head, JSON.parse(body)] : [head];
		}),
	);
}

/** Reads the item through the repository, then gives the name the store keeps for it. */
async function readStoredName<Model extends { entityType: string; unique: string; name: string }>(
	repository: UmbDetailRepository<Model>,
) {
	const { asObservable } = await repository.requestByUnique(ID);
	return new Promise((resolve) => asObservable?.()?.subscribe((item) => resolve(item?.name)));
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate detail data sources', () => {
	it('scaffold a new form with the kind from the create route and an ID of its own', async () => {
		const dataSource = new FormulateFormDetailServerDataSource(createTestHost());

		const { data } = await dataSource.createScaffold({ kindId: KIND_ID });

		expect(data).toStrictEqual({
			entityType: 'formulate-form',
			unique: data?.unique,
			name: '',
			alias: null,
			kindId: KIND_ID,
			fields: [],
			handlers: [],
		});
		expect(data?.unique).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it('create a form at the top of the tree with its kind and without a parent ID, then read it back', async () => {
		const requests = serve(RESPONSES.form);
		const dataSource = new FormulateFormDetailServerDataSource(createTestHost());

		const { data } = await dataSource.create(
			{ entityType: 'formulate-form', unique: ID, name: 'Contact', alias: 'contact', kindId: KIND_ID, fields: [FIELD], handlers: [HANDLER] },
			null,
		);

		expect(await describeRequests(requests)).toStrictEqual([
			[`POST ${API}/form`, { id: ID, kindId: KIND_ID, name: 'Contact', alias: 'contact', fields: [FIELD], handlers: [HANDLER] }],
			[`GET ${API}/form/${ID}`],
		]);
		// A form's kind only matters when it is created, so the API does not give it back.
		expect(data).toStrictEqual({
			entityType: 'formulate-form',
			unique: ID,
			name: 'Contact',
			alias: 'contact',
			kindId: null,
			fields: [FIELD],
			handlers: [HANDLER],
		});
	});

	it('save a form: its name, alias, fields and handlers', async () => {
		const requests = serve(RESPONSES.form);
		const dataSource = new FormulateFormDetailServerDataSource(createTestHost());

		const { data } = await dataSource.update({
			entityType: 'formulate-form',
			unique: ID,
			name: 'Contact',
			alias: 'contact',
			kindId: null,
			fields: [FIELD],
			handlers: [HANDLER],
		});

		expect(await describeRequests(requests)).toStrictEqual([
			[`PUT ${API}/form/${ID}`, { name: 'Contact', alias: 'contact', fields: [FIELD], handlers: [HANDLER] }],
		]);
		expect(data?.name).toBe('Contact');
	});

	it('create a layout under its form, then read it back', async () => {
		const requests = serve(RESPONSES.layout);
		const dataSource = new FormulateLayoutDetailServerDataSource(createTestHost());

		const { data } = await dataSource.create(
			{
				entityType: 'formulate-layout',
				unique: ID,
				name: 'Contact layout',
				alias: null,
				formUnique: null,
				kindId: KIND_ID,
				templateId: TEMPLATE_ID,
				configuration: { autoPopulate: true, rows: [] },
			},
			FORM_ID,
		);

		expect(await describeRequests(requests)).toStrictEqual([
			[
				`POST ${API}/layout`,
				{
					id: ID,
					formId: FORM_ID,
					kindId: KIND_ID,
					name: 'Contact layout',
					alias: null,
					templateId: TEMPLATE_ID,
					configuration: { autoPopulate: true, rows: [] },
				},
			],
			[`GET ${API}/layout/${ID}`],
		]);
		expect(data).toStrictEqual({
			entityType: 'formulate-layout',
			unique: ID,
			name: 'Contact layout',
			alias: null,
			formUnique: FORM_ID,
			kindId: KIND_ID,
			templateId: TEMPLATE_ID,
			configuration: { autoPopulate: true, rows: [] },
		});
	});

	it('refuse to create a layout without its form', async () => {
		const requests = serve(RESPONSES.layout);
		const dataSource = new FormulateLayoutDetailServerDataSource(createTestHost());
		const { data: scaffold } = await dataSource.createScaffold({ kindId: KIND_ID });

		await expect(dataSource.create(scaffold!, null)).rejects.toThrow('form');
		expect(requests).toHaveLength(0);
	});

	it('save a layout: its name, alias, template and configuration', async () => {
		const requests = serve(RESPONSES.layout);
		const dataSource = new FormulateLayoutDetailServerDataSource(createTestHost());

		await dataSource.update({
			entityType: 'formulate-layout',
			unique: ID,
			name: 'Contact layout',
			alias: null,
			formUnique: FORM_ID,
			kindId: KIND_ID,
			templateId: TEMPLATE_ID,
			configuration: { autoPopulate: false, rows: [] },
		});

		expect(await describeRequests(requests)).toStrictEqual([
			[
				`PUT ${API}/layout/${ID}`,
				{ name: 'Contact layout', alias: null, templateId: TEMPLATE_ID, configuration: { autoPopulate: false, rows: [] } },
			],
		]);
	});

	it('create a validation in a folder with its kind and configuration, then read it back', async () => {
		const requests = serve(RESPONSES.validation);
		const dataSource = new FormulateValidationDetailServerDataSource(createTestHost());

		const { data } = await dataSource.create(
			{
				entityType: 'formulate-validation',
				unique: ID,
				name: 'Required',
				alias: 'required',
				kindId: KIND_ID,
				configuration: { message: 'Please fill this in.' },
			},
			FOLDER_ID,
		);

		expect(await describeRequests(requests)).toStrictEqual([
			[
				`POST ${API}/validation`,
				{
					id: ID,
					parentId: FOLDER_ID,
					kindId: KIND_ID,
					name: 'Required',
					alias: 'required',
					configuration: { message: 'Please fill this in.' },
				},
			],
			[`GET ${API}/validation/${ID}`],
		]);
		expect(data).toStrictEqual({
			entityType: 'formulate-validation',
			unique: ID,
			name: 'Required',
			alias: 'required',
			kindId: KIND_ID,
			configuration: { message: 'Please fill this in.' },
		});
	});

	it('save a validation: its name, alias and configuration', async () => {
		const requests = serve(RESPONSES.validation);
		const dataSource = new FormulateValidationDetailServerDataSource(createTestHost());

		await dataSource.update({
			entityType: 'formulate-validation',
			unique: ID,
			name: 'Required',
			alias: 'required',
			kindId: KIND_ID,
			configuration: { message: 'Required.' },
		});

		expect(await describeRequests(requests)).toStrictEqual([
			[`PUT ${API}/validation/${ID}`, { name: 'Required', alias: 'required', configuration: { message: 'Required.' } }],
		]);
	});

	it('create data values at the top of the tree without a parent ID or configuration, then read them back', async () => {
		const requests = serve(RESPONSES.dataValues);
		const dataSource = new FormulateDataValuesDetailServerDataSource(createTestHost());
		const { data: scaffold } = await dataSource.createScaffold({ kindId: KIND_ID });

		const { data } = await dataSource.create({ ...scaffold!, unique: ID, name: 'Countries' }, null);

		// A new item without configuration leaves it out, so the API uses the kind's default.
		expect(await describeRequests(requests)).toStrictEqual([
			[`POST ${API}/data-values`, { id: ID, kindId: KIND_ID, name: 'Countries', alias: null }],
			[`GET ${API}/data-values/${ID}`],
		]);
		expect(data).toStrictEqual({
			entityType: 'formulate-data-values',
			unique: ID,
			name: 'Countries',
			alias: null,
			kindId: KIND_ID,
			isLegacy: false,
			configuration: { items: [{ value: 'NL' }] },
		});
	});

	it("leave out a configuration that is null when creating, so the API uses the kind's defaults", async () => {
		const requests = serve({ id: ID, name: 'New', kindId: KIND_ID, formId: FORM_ID, isLegacy: false });
		const host = createTestHost();
		const base = { unique: ID, name: 'New', alias: null, kindId: KIND_ID, configuration: null };

		await new FormulateLayoutDetailServerDataSource(host).create(
			{ ...base, entityType: 'formulate-layout', formUnique: FORM_ID, templateId: null },
			FORM_ID,
		);
		await new FormulateValidationDetailServerDataSource(host).create({ ...base, entityType: 'formulate-validation' }, null);
		await new FormulateDataValuesDetailServerDataSource(host).create(
			{ ...base, entityType: 'formulate-data-values', isLegacy: false },
			null,
		);

		const posts = (await describeRequests(requests)).filter(([head]) => head.startsWith('POST'));
		expect(posts).toStrictEqual([
			[`POST ${API}/layout`, { id: ID, formId: FORM_ID, kindId: KIND_ID, name: 'New', alias: null, templateId: null }],
			[`POST ${API}/validation`, { id: ID, kindId: KIND_ID, name: 'New', alias: null }],
			[`POST ${API}/data-values`, { id: ID, kindId: KIND_ID, name: 'New', alias: null }],
		]);
	});

	it('save data values: their name, alias and configuration', async () => {
		const requests = serve(RESPONSES.dataValues);
		const dataSource = new FormulateDataValuesDetailServerDataSource(createTestHost());

		await dataSource.update({
			entityType: 'formulate-data-values',
			unique: ID,
			name: 'Countries',
			alias: 'countries',
			kindId: KIND_ID,
			isLegacy: false,
			configuration: { items: [] },
		});

		expect(await describeRequests(requests)).toStrictEqual([
			[`PUT ${API}/data-values/${ID}`, { name: 'Countries', alias: 'countries', configuration: { items: [] } }],
		]);
	});

	it('delete each kind of item through its own endpoint', async () => {
		const requests = serve({});
		const host = createTestHost();

		const results = [
			await new FormulateFormDetailServerDataSource(host).delete(ID),
			await new FormulateLayoutDetailServerDataSource(host).delete(ID),
			await new FormulateValidationDetailServerDataSource(host).delete(ID),
			await new FormulateDataValuesDetailServerDataSource(host).delete(ID),
		];

		expect(results.map((result) => result.error)).toStrictEqual([undefined, undefined, undefined, undefined]);
		expect(await describeRequests(requests)).toStrictEqual([
			[`DELETE ${API}/form/${ID}`],
			[`DELETE ${API}/layout/${ID}`],
			[`DELETE ${API}/validation/${ID}`],
			[`DELETE ${API}/data-values/${ID}`],
		]);
	});

	it('the detail repositories read each kind of item through its own endpoint and keep it', async () => {
		const requests = fakeApi((request) => {
			const type = new URL(request.url).pathname.split('/').at(-2) as string;
			const responses: Record<string, unknown> = {
				form: RESPONSES.form,
				layout: RESPONSES.layout,
				validation: RESPONSES.validation,
				'data-values': RESPONSES.dataValues,
			};
			return jsonResponse(responses[type]);
		});
		const host = createTestHost();
		new FormulateFormDetailStore(host);
		new FormulateLayoutDetailStore(host);
		new FormulateValidationDetailStore(host);
		new FormulateDataValuesDetailStore(host);

		const names = [
			await readStoredName(new FormulateFormDetailRepository(host)),
			await readStoredName(new FormulateLayoutDetailRepository(host)),
			await readStoredName(new FormulateValidationDetailRepository(host)),
			await readStoredName(new FormulateDataValuesDetailRepository(host)),
		];

		expect(names).toStrictEqual(['Contact', 'Contact layout', 'Required', 'Countries']);
		expect(requests.map(pathAndQuery)).toStrictEqual([
			`${API}/form/${ID}`,
			`${API}/layout/${ID}`,
			`${API}/validation/${ID}`,
			`${API}/data-values/${ID}`,
		]);
	});
});

/**
 * A back office host that records the notifications it shows, the tree reloads it is asked for and the items
 * announced as deleted.
 */
function createNotifyingHost() {
	const host = createTestHost();
	const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
	const events = new UmbActionEventContext(host);
	const reloads: Array<string> = [];
	events.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, (event) => {
		const reload = event as UmbRequestReloadStructureForEntityEvent;
		reloads.push(`${reload.getEntityType()} ${reload.getUnique()}`);
	});
	const deleted: Array<string> = [];
	events.addEventListener(UmbEntityDeletedEvent.TYPE, (event) => {
		const entity = event as UmbEntityDeletedEvent;
		deleted.push(`${entity.getEntityType()} ${entity.getUnique()}`);
	});

	return { host, peek, reloads, deleted };
}

/** Each kind of item, with a model the data source can save. */
const ITEMS = [
	{
		entityType: 'formulate-form',
		DataSource: FormulateFormDetailServerDataSource,
		model: { entityType: 'formulate-form', unique: ID, name: 'Contact', alias: null, kindId: null, fields: [], handlers: [] },
	},
	{
		entityType: 'formulate-layout',
		DataSource: FormulateLayoutDetailServerDataSource,
		model: { entityType: 'formulate-layout', unique: ID, name: 'Contact layout', alias: null, formUnique: FORM_ID, kindId: KIND_ID, templateId: null, configuration: {} },
	},
	{
		entityType: 'formulate-validation',
		DataSource: FormulateValidationDetailServerDataSource,
		model: { entityType: 'formulate-validation', unique: ID, name: 'Required', alias: null, kindId: KIND_ID, configuration: {} },
	},
	{
		entityType: 'formulate-data-values',
		DataSource: FormulateDataValuesDetailServerDataSource,
		model: { entityType: 'formulate-data-values', unique: ID, name: 'Countries', alias: null, kindId: KIND_ID, isLegacy: false, configuration: {} },
	},
] as const;

describe('Formulate detail data sources, when an item was deleted elsewhere', () => {
	for (const { entityType, DataSource, model } of ITEMS) {
		it(`say that a ${entityType} item read, saved or deleted no longer exists, drop it from the tree, and announce it deleted`, async () => {
			fakeApi(() => jsonResponse({ type: 'Error', title: 'Item not found', status: 404, detail: `The item ${ID} does not exist.` }, 404));
			const { host, peek, reloads, deleted } = createNotifyingHost();
			// The data sources share their code; each is given the model of its own kind.
			const dataSource = new DataSource(host) as unknown as {
				read: (unique: string) => Promise<{ error?: unknown }>;
				update: (model: unknown) => Promise<{ error?: unknown }>;
				delete: (unique: string) => Promise<{ error?: unknown }>;
			};

			const results = [await dataSource.read(ID), await dataSource.update(model), await dataSource.delete(ID)];

			// The caller still gets the error, so a save or delete is not taken for a success.
			expect(results.map(({ error }) => error && UmbApiError.isUmbApiError(error) && error.status)).toStrictEqual([404, 404, 404]);
			// Umbraco shows nothing for a 404 (tryExecute leaves out 401, 403 and 404), so the data source says it.
			expect(peek.mock.calls).toStrictEqual([
				['warning', { data: { message: 'formulate_itemNotFound' } }],
				['warning', { data: { message: 'formulate_itemNotFound' } }],
				['warning', { data: { message: 'formulate_itemNotFound' } }],
			]);
			// Reloading its structure drops the stale item from the tree.
			expect(reloads).toStrictEqual([`${entityType} ${ID}`, `${entityType} ${ID}`, `${entityType} ${ID}`]);
			// It is gone for good, so a workspace that shows it leaves, as after a delete.
			expect(deleted).toStrictEqual([`${entityType} ${ID}`, `${entityType} ${ID}`, `${entityType} ${ID}`]);
		});
	}

	it("leave any other problem to Umbraco's own error notification, and reload nothing", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		fakeApi(() => jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail: 'name: The name is required.', field: 'name' }, 400));
		const { host, peek, reloads, deleted } = createNotifyingHost();

		const { error } = await new FormulateValidationDetailServerDataSource(host).update(ITEMS[2].model);

		expect(error && UmbApiError.isUmbApiError(error) && error.status).toBe(400);
		await expect.poll(() => peek.mock.calls.length).toBe(1);
		expect(peek.mock.calls.map(([color, args]) => [color, JSON.stringify(args)])).toStrictEqual([
			['danger', expect.stringContaining('Invalid request')],
		]);
		expect(reloads).toStrictEqual([]);
		expect(deleted).toStrictEqual([]);
	});
});
