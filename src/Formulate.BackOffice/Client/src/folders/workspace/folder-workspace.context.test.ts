import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbRequestReloadStructureForEntityEvent } from '@umbraco-cms/backoffice/entity-action';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateFolderStore } from '../folder.store.js';
import { manifests } from '../manifests.js';
import {
	FormulateDataValuesFolderWorkspaceContext,
	FormulateFormsFolderWorkspaceContext,
	FormulateValidationsFolderWorkspaceContext,
	type FormulateFolderWorkspaceContext,
} from './folder-workspace.context.js';

const API = '/umbraco/management/api/v1/formulate';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';

const WORKSPACES = [
	{
		tree: 'forms',
		Context: FormulateFormsFolderWorkspaceContext,
		alias: 'Formulate.Workspace.Folder.Forms',
		entityType: 'formulate-form-folder',
	},
	{
		tree: 'data-values',
		Context: FormulateDataValuesFolderWorkspaceContext,
		alias: 'Formulate.Workspace.Folder.DataValues',
		entityType: 'formulate-data-values-folder',
	},
	{
		tree: 'validations',
		Context: FormulateValidationsFolderWorkspaceContext,
		alias: 'Formulate.Workspace.Folder.Validations',
		entityType: 'formulate-validation-folder',
	},
];

const repositories = manifests.filter((manifest) => manifest.type === 'repository');

/** Answers like the API: the folder, under the name it was last saved with. */
function serveFolder(treeAlias: string) {
	return fakeApi(async (request) => {
		const name = request.method === 'PUT' ? ((await request.clone().json()) as { name: string }).name : 'Contact forms';
		return jsonResponse({ id: FOLDER_ID, name, parentId: null, treeAlias });
	});
}

/** A back office host with the contexts a workspace uses; it records the tree reloads it is asked for. */
function createHost() {
	const host = createTestHost();
	new FormulateFolderStore(host);
	new UmbNotificationContext(host);
	const events = new UmbActionEventContext(host);
	const reloads: Array<string> = [];
	events.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, (event) => {
		const reload = event as UmbRequestReloadStructureForEntityEvent;
		reloads.push(`${reload.getEntityType()} ${reload.getUnique()}`);
	});

	return { host, reloads };
}

/** Opens the workspace's edit route for the folder, as the router does when a folder is picked in the tree. */
function openFolder(context: FormulateFolderWorkspaceContext) {
	const edit = context.routes.getRoutes().find((route) => route.path === 'edit/:unique') as
		| { setup?: (component: HTMLElement, info: unknown) => void }
		| undefined;
	expect(edit?.setup, 'an edit route that sets the workspace up').toBeDefined();
	edit!.setup!(document.createElement('div'), {
		match: { params: { unique: FOLDER_ID }, fragments: { consumed: `edit/${FOLDER_ID}`, rest: '' } },
	});
}

beforeEach(() => {
	umbExtensionsRegistry.registerMany(repositories);
});

afterEach(() => {
	umbExtensionsRegistry.unregisterMany(repositories.map((manifest) => manifest.alias));
	document.body.replaceChildren();
});

describe('Formulate folder workspaces', () => {
	for (const { tree, Context, alias, entityType } of WORKSPACES) {
		it(`open a folder of the ${tree} tree by its edit route, then save its new name and refresh the tree`, async () => {
			const requests = serveFolder(tree);
			const { host, reloads } = createHost();
			const context = new Context(host);

			openFolder(context);
			await expect.poll(() => context.getName()).toBe('Contact forms');
			expect([context.workspaceAlias, context.getEntityType(), context.getUnique()]).toStrictEqual([
				alias,
				entityType,
				FOLDER_ID,
			]);

			context.setName('Renamed');
			await context.requestSubmit();

			const saves = requests.filter((request) => request.method === 'PUT');
			expect(await Promise.all(saves.map(async (request) => [pathAndQuery(request), await request.text()]))).toStrictEqual([
				[`${API}/folder/${FOLDER_ID}`, JSON.stringify({ name: 'Renamed' })],
			]);
			expect(context.getName()).toBe('Renamed');
			expect(reloads).toStrictEqual([`${entityType} ${FOLDER_ID}`]);
		});
	}

	it("give every tree's folders a workspace with a Save button", () => {
		const workspaces = manifests.filter((manifest) => manifest.type === 'workspace') as Array<{
			alias: string;
			kind?: string;
			meta: { entityType: string };
		}>;
		const save = manifests.find((manifest) => manifest.type === 'workspaceAction') as
			| { meta?: unknown; conditions?: unknown }
			| undefined;

		expect(workspaces.map((manifest) => [manifest.alias, manifest.kind, manifest.meta.entityType])).toStrictEqual(WORKSPACES.map(({ alias, entityType }) => [alias, 'routable', entityType]));
		expect(save?.meta).toMatchObject({ label: '#buttons_save', look: 'primary', color: 'positive' });
		expect(save?.conditions).toStrictEqual([
			{ alias: 'Umb.Condition.WorkspaceAlias', oneOf: WORKSPACES.map(({ alias }) => alias) },
		]);
	});
});
