import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import type { UmbStructureItemModel } from '@umbraco-cms/backoffice/menu';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormulateFolderStore } from '../folders/folder.store.js';
import { manifests as folderManifests } from '../folders/manifests.js';
import { FormulateValidationsFolderWorkspaceContext } from '../folders/workspace/folder-workspace.context.js';
import { fakeApi, jsonResponse, pathAndQuery } from '../test/fake-api.js';
import { createTestHost } from '../test/test-host.js';
import { manifests as treeManifests } from './manifests.js';
import { FormulateValidationsMenuStructureWorkspaceContext } from './menu-structure.context.js';

const API = '/umbraco/management/api/v1/formulate';
const OUTER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const INNER_ID = '1c8d2e0f-4b62-4e1b-8b54-7b2f2d7c3e02';

const repositories = [...treeManifests, ...folderManifests].filter((manifest) => manifest.type === 'repository');

/** A folder as the tree endpoints give it. */
function apiFolder(id: string, name: string, parentId: string | null) {
	return {
		id,
		name,
		entityType: 'formulate-validation-folder',
		hasChildren: true,
		isFolder: true,
		icon: 'icon-folder',
		parent: parentId ? { id: parentId } : null,
	};
}

/** Answers like the API for the folder Inner, in the folder Outer, at the top of the Validation Library. */
function serveNestedFolder() {
	return fakeApi((request) => {
		const path = pathAndQuery(request);

		if (path === `${API}/folder/${INNER_ID}`) {
			return jsonResponse({ id: INNER_ID, name: 'Inner', parentId: OUTER_ID, treeAlias: 'validations' });
		}

		if (path.startsWith(`${API}/tree/validations/root`)) {
			return jsonResponse({ total: 1, items: [apiFolder(OUTER_ID, 'Outer', null)] });
		}

		if (path === `${API}/tree/validations/ancestors?descendantId=${INNER_ID}`) {
			return jsonResponse([apiFolder(OUTER_ID, 'Outer', null), apiFolder(INNER_ID, 'Inner', OUTER_ID)]);
		}

		return jsonResponse({ title: 'Not found', status: 404 }, 404);
	});
}

beforeEach(() => {
	umbExtensionsRegistry.registerMany(repositories);
});

afterEach(() => {
	umbExtensionsRegistry.unregisterMany(repositories.map((manifest) => manifest.alias));
	document.body.replaceChildren();
});

describe('Formulate menu structure', () => {
	it('follows the open item through its own tree: the root, then its ancestors, for the breadcrumb', async () => {
		const requests = serveNestedFolder();
		const host = createTestHost();
		new FormulateFolderStore(host);
		new UmbNotificationContext(host);
		new UmbActionEventContext(host);
		const workspace = new FormulateValidationsFolderWorkspaceContext(host);
		const structure = new FormulateValidationsMenuStructureWorkspaceContext(host);
		let items: Array<UmbStructureItemModel> = [];
		structure.structure.subscribe((value) => (items = value));

		await workspace.load(INNER_ID);

		await expect.poll(() => items).toStrictEqual([
			{ unique: null, entityType: 'formulate-validations-root', name: '#formulate_validationLibrary', isFolder: true },
			{ unique: OUTER_ID, entityType: 'formulate-validation-folder', name: 'Outer', isFolder: true },
			{ unique: INNER_ID, entityType: 'formulate-validation-folder', name: 'Inner', isFolder: true },
		]);
		expect(requests.map(pathAndQuery)).toContain(`${API}/tree/validations/ancestors?descendantId=${INNER_ID}`);
	});
});
