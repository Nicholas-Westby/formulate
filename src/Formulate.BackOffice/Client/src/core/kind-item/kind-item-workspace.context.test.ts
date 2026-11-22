import { UmbEntityDeletedEvent } from '@umbraco-cms/backoffice/entity-action';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FormulateDataValuesWorkspaceContext } from '../../data-values/workspace/data-values-workspace.context.js';
import {
	API,
	createWorkspaceHost,
	describeSaves,
	destroyKept,
	firstDefined,
	FOLDER_ID,
	getMessages,
	ID,
	keep,
	LEGACY,
	LIST,
	MANDATORY,
	REGEX_VALIDATION,
	registerKindItemRepositories,
	serve,
	US_STATES,
	VALIDATION_KINDS,
} from '../../test/kind-items.js';
import { createTestHost, FormulateTestHostElement } from '../../test/test-host.js';
import { jsonResponse } from '../../test/fake-api.js';
import { FormulateValidationWorkspaceContext } from '../../validations/workspace/validation-workspace.context.js';
import { FormulateKindItemSaveWorkspaceAction } from './kind-item-save.action.js';

beforeAll(registerKindItemRepositories);

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

describe('Formulate validation and data values workspaces, creating an item', () => {
	it("give a new item its kind's default configuration, and save it in its folder", async () => {
		const requests = serve();
		const { host, reloadedChildren } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));

		await context.create({ entityType: 'formulate-validation-folder', unique: FOLDER_ID }, MANDATORY);
		const unique = context.getUnique();
		expect(context.getData()).toStrictEqual({
			entityType: 'formulate-validation',
			unique,
			name: '',
			alias: null,
			kindId: MANDATORY,
			configuration: { message: null, clientSideOnly: false },
		});

		context.setName('Required');
		context.setAlias('required');
		await context.requestSubmit();

		expect(await describeSaves(requests)).toStrictEqual([
			[
				`POST ${API}/validation`,
				{ id: unique, parentId: FOLDER_ID, kindId: MANDATORY, name: 'Required', alias: 'required', configuration: { message: null, clientSideOnly: false } },
			],
		]);
		expect(context.getIsNew()).toBe(false);
		// The folder reloads its children, so the new item shows (and the folder gets its expand arrow).
		expect(reloadedChildren).toStrictEqual([`formulate-validation-folder ${FOLDER_ID}`]);
	});

	it('leave the configuration out for a kind without a default, and reload the root it is created at', async () => {
		const requests = serve();
		const { host, reloadedChildren } = createWorkspaceHost();
		const context = keep(new FormulateDataValuesWorkspaceContext(host));

		await context.create({ entityType: 'formulate-data-values-root', unique: null }, US_STATES);
		context.setName('States');
		await context.requestSubmit();

		// Never an explicit null: the API refuses a configuration its kind cannot read.
		expect(await describeSaves(requests)).toStrictEqual([
			[`POST ${API}/data-values`, { id: context.getUnique(), kindId: US_STATES, name: 'States', alias: null }],
		]);
		// The root reloads its children, so its expand arrow shows after its first item.
		expect(reloadedChildren).toStrictEqual(['formulate-data-values-root null']);
	});

	it('give each new item its own copy of the default configuration', async () => {
		serve();
		const { host } = createWorkspaceHost();
		const first = keep(new FormulateDataValuesWorkspaceContext(host));
		const second = keep(new FormulateDataValuesWorkspaceContext(createTestHost()));
		const root = { entityType: 'formulate-data-values-root', unique: null };

		await first.create(root, LIST);
		await second.create(root, LIST);

		expect(first.getConfiguration()).toStrictEqual({ items: [] });
		expect(first.getConfiguration()).not.toBe(second.getConfiguration());
	});
});

describe('Formulate validation and data values workspaces, editing an item', () => {
	it("find the definition of the item's kind, whatever the case and dashes of its ID", async () => {
		serve([{ ...REGEX_VALIDATION, kindId: 'AC9A464F6F3F4AF9A3B29C85FF0C5580' }]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));

		await context.load(ID);

		expect(await firstDefined(context.definition)).toStrictEqual(VALIDATION_KINDS[1]);
		expect(context.editorType).toBe('formulateValidationEditor');
	});

	it('save the name, alias and configuration', async () => {
		const requests = serve([REGEX_VALIDATION]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);

		context.setName('Postcode');
		context.setAlias('');
		context.setConfiguration({ regex: '^\\d{4}$', message: 'Enter a postcode.' });
		await context.requestSubmit();

		// An emptied alias is stored as none.
		expect(await describeSaves(requests)).toStrictEqual([
			[`PUT ${API}/validation/${ID}`, { name: 'Postcode', alias: null, configuration: { regex: '^\\d{4}$', message: 'Enter a postcode.' } }],
		]);
	});

	it("send an unknown kind's configuration back untouched, as no editor can change it", async () => {
		const configuration = { anything: [1, { deep: true }], text: null };
		const requests = serve([{ ...REGEX_VALIDATION, kindId: 'f0e1d2c3-b4a5-4968-8776-655443322104', configuration }]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);

		expect(await firstDefined(context.definition)).toBeNull();
		context.setName('Renamed');
		await context.requestSubmit();

		expect(await describeSaves(requests)).toStrictEqual([
			[`PUT ${API}/validation/${ID}`, { name: 'Renamed', alias: 'zipCode', configuration }],
		]);
	});

	it.each([
		['name', 'name: The name is required.', '$.name', 'The name is required.'],
		['alias', 'alias: The alias is already in use.', '$.alias', 'The alias is already in use.'],
		['configuration', 'configuration: The Regular Expression kind can not read the configuration.', '$.configuration', 'The Regular Expression kind can not read the configuration.'],
	])('show a problem the API reports for the %s field on that field', async (field, detail, path, body) => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		serve([REGEX_VALIDATION], () => jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail, field }, 400));
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);

		await expect(context.requestSubmit()).rejects.toBeDefined();

		expect(await getMessages(host)).toStrictEqual([{ type: 'server', path, body }]);
	});

	it('leave a problem for a field without an input to the notification Umbraco shows', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		serve([REGEX_VALIDATION], () =>
			jsonResponse({ type: 'Error', title: 'Conflict', status: 409, detail: 'kindId: Legacy data values can not be changed.', field: 'kindId' }, 409),
		);
		const { host, peek } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);

		await expect(context.requestSubmit()).rejects.toBeDefined();

		expect(await getMessages(host)).toStrictEqual([]);
		await expect.poll(() => peek.mock.calls.map(([color]) => color)).toStrictEqual(['danger']);
	});

	it('clear a configuration problem once the configuration changes, so the item can be saved again', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		let refuse = true;
		const requests = serve([REGEX_VALIDATION], () =>
			refuse
				? jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail: 'configuration: Not readable.', field: 'configuration' }, 400)
				: jsonResponse({ ...REGEX_VALIDATION, configuration: { regex: 'x', message: 'y' } }),
		);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));
		await context.load(ID);
		await expect(context.requestSubmit()).rejects.toBeDefined();

		refuse = false;
		context.setConfiguration({ regex: 'x', message: 'y' });
		await context.requestSubmit();

		expect(await getMessages(host)).toStrictEqual([]);
		expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(2);
	});
});

describe('Formulate validation and data values workspaces, for an item deleted elsewhere', () => {
	const COLORS = { id: ID, name: 'Colors', alias: null, parentId: null, kindId: LIST, isLegacy: false, configuration: { items: [{ value: 'Red' }] } };
	const GONE = () => jsonResponse({ type: 'Error', title: 'Item not found', status: 404 }, 404);

	it.each([
		['a validation', FormulateValidationWorkspaceContext, REGEX_VALIDATION, 'formulate-validation'],
		['data values', FormulateDataValuesWorkspaceContext, COLORS, 'formulate-data-values'],
	] as const)(
		'let go of the changes to %s that cannot be saved, and announce it deleted, so the workspace leaves without asking',
		async (_, Context, item, entityType) => {
			serve([item], GONE);
			const { host, peek, events, deleted } = createWorkspaceHost();
			const context = keep(new Context(host));
			await context.load(ID);
			context.setName('Renamed');
			expect(context.getHasUnpersistedChanges()).toBe(true);
			// Umbraco asks whether to discard unsaved changes when the workspace leaves for the deletion.
			const unsavedWhenDeleted: Array<boolean> = [];
			events.addEventListener(UmbEntityDeletedEvent.TYPE, () => unsavedWhenDeleted.push(context.getHasUnpersistedChanges()));

			await expect(context.requestSubmit()).rejects.toBeDefined();

			expect(peek.mock.calls).toStrictEqual([['warning', { data: { message: 'formulate_itemNotFound' } }]]);
			expect(deleted).toStrictEqual([`${entityType} ${ID}`]);
			expect(unsavedWhenDeleted).toStrictEqual([false]);
			expect(context.getName()).toBe(item.name);
		},
	);

	it('say that an item opened by its URL no longer exists, and announce it deleted, so the workspace leaves', async () => {
		serve([]);
		const { host, peek, deleted } = createWorkspaceHost();
		const context = keep(new FormulateValidationWorkspaceContext(host));

		await context.load(ID);

		await expect.poll(() => deleted).toStrictEqual([`formulate-validation ${ID}`]);
		expect(peek.mock.calls).toStrictEqual([['warning', { data: { message: 'formulate_itemNotFound' } }]]);
	});
});

describe('Formulate data values workspace, for legacy data values', () => {
	const LEGACY_ITEM = { id: ID, name: 'Old colors', alias: null, parentId: null, kindId: LEGACY, isLegacy: true, configuration: null };

	it('is read-only, and sends nothing when asked to save', async () => {
		const requests = serve([LEGACY_ITEM]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateDataValuesWorkspaceContext(host));
		await context.load(ID);

		expect(context.readOnlyGuard.getPermitted()).toBe(true);
		await context.requestSubmit();

		expect(requests.filter((request) => request.method === 'PUT')).toStrictEqual([]);
	});

	it('is not read-only for other data values', async () => {
		serve([{ ...LEGACY_ITEM, kindId: LIST, isLegacy: false, configuration: { items: [] } }]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateDataValuesWorkspaceContext(host));
		await context.load(ID);

		expect(context.readOnlyGuard.getPermitted()).toBe(false);
	});

	it('disables Save for legacy data values, and enables it for others', async () => {
		serve([LEGACY_ITEM, { ...LEGACY_ITEM, id: FOLDER_ID, kindId: LIST, isLegacy: false, configuration: { items: [] } }]);
		const { host } = createWorkspaceHost();
		const context = keep(new FormulateDataValuesWorkspaceContext(host));
		const actionHost = new FormulateTestHostElement();
		host.append(actionHost);
		const save = keep(
			new FormulateKindItemSaveWorkspaceAction(actionHost, { meta: { label: '#buttons_save', look: 'primary', color: 'positive' } }),
		);
		const disabled: Array<boolean> = [];
		save.isDisabled.subscribe((value) => disabled.push(value));

		await context.load(ID);
		await expect.poll(() => disabled.at(-1)).toBe(true);

		await context.load(FOLDER_ID);
		await expect.poll(() => disabled.at(-1)).toBe(false);
	});
});
