import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import {
	UmbEntityDeletedEvent,
	UmbRequestReloadChildrenOfEntityEvent,
	UmbRequestReloadStructureForEntityEvent,
} from '@umbraco-cms/backoffice/entity-action';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { manifests as itemManifests } from '../../core/item/manifests.js';
import { FormulateItemStore } from '../../core/item/item.store.js';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { manifests as validationRepositoryManifests } from '../../validations/repository/manifests.js';
import { FormulateValidationDetailStore } from '../../validations/repository/validation-detail.store.js';
import { manifests as folderManifests } from '../../folders/manifests.js';
import { FormulateDeleteEntityAction } from './delete.action.js';
import { manifests as deleteManifests } from './manifests.js';

const API = '/umbraco/management/api/v1/formulate';
const ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';

const META = {
	icon: 'icon-trash',
	label: '#actions_delete',
	detailRepositoryAlias: 'Formulate.Repository.Detail.Validation',
	itemRepositoryAlias: 'Formulate.Repository.Item',
};

/** The item as the item endpoint gives it, in a folder or at the top of the Validation Library. */
function apiItem(parentId: string | null) {
	return { id: ID, entityType: 'formulate-validation', name: 'Required', icon: 'icon-check', parentId, parentName: null };
}

/**
 * Answers like the API: the item endpoint lists the items that exist, and DELETE answers with the
 * deleted IDs (or the given answer).
 */
function serve(items: Array<unknown>, deleteAnswer = () => jsonResponse({ deletedIds: [ID] })) {
	return fakeApi((request) => (request.method === 'DELETE' ? deleteAnswer() : jsonResponse(items)));
}

/** A back office host whose confirm dialogs are confirmed, which records notifications and tree events. */
function createHost() {
	const host = createTestHost();
	const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
	const events = new UmbActionEventContext(host);
	const open = vi
		.spyOn(new UmbModalManagerContext(host), 'open')
		.mockImplementation(() => ({ onSubmit: () => Promise.resolve() }) as unknown as UmbModalContext);
	new FormulateItemStore(host);
	new FormulateValidationDetailStore(host);
	const happened: Array<string> = [];
	const record = (what: string) => (event: Event) => {
		const entity = event as UmbRequestReloadChildrenOfEntityEvent;
		happened.push(`${what} ${entity.getEntityType()} ${entity.getUnique()}`);
	};
	events.addEventListener(UmbEntityDeletedEvent.TYPE, record('deleted'));
	events.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, record('structure of'));
	events.addEventListener(UmbRequestReloadChildrenOfEntityEvent.TYPE, record('children of'));

	return { host, peek, open, happened };
}

function deleteValidation(host: HTMLElement) {
	return new FormulateDeleteEntityAction(host as never, { entityType: 'formulate-validation', unique: ID, meta: META }).execute();
}

beforeAll(() => {
	umbExtensionsRegistry.registerMany([...itemManifests, ...validationRepositoryManifests]);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate delete action', () => {
	it('says the item no longer exists when it was deleted elsewhere, drops it from the tree, and announces it deleted', async () => {
		const requests = serve([]);
		const { host, peek, open, happened } = createHost();

		await deleteValidation(host);

		// Umbraco's own action fails with "Item not found." in the console only.
		expect(peek.mock.calls).toStrictEqual([['warning', { data: { message: 'formulate_itemNotFound' } }]]);
		// Gone is as good as deleted: a workspace that shows it leaves.
		expect(happened).toStrictEqual([`structure of formulate-validation ${ID}`, `deleted formulate-validation ${ID}`]);
		expect(open).not.toHaveBeenCalled();
		expect(requests.map((request) => request.method)).toStrictEqual(['GET']);
	});

	it("deletes the item as Umbraco does, then reloads its folder's children", async () => {
		const requests = serve([apiItem(FOLDER_ID)]);
		const { host, peek, open, happened } = createHost();

		await deleteValidation(host);

		expect(open).toHaveBeenCalledOnce();
		expect(requests.filter((request) => request.method === 'DELETE').map(pathAndQuery)).toStrictEqual([`${API}/validation/${ID}`]);
		expect(happened).toStrictEqual([
			`deleted formulate-validation ${ID}`,
			`structure of formulate-validation ${ID}`,
			// The folder reloads its children, so it loses its expand arrow once it is empty.
			`children of formulate-validation-folder ${FOLDER_ID}`,
		]);
		expect(peek.mock.calls.map(([color]) => color)).toStrictEqual(['positive']);
	});

	it('reloads the root of the tree after deleting an item at the top', async () => {
		serve([apiItem(null)]);
		const { host, happened } = createHost();

		await deleteValidation(host);

		expect(happened.at(-1)).toBe('children of formulate-validations-root null');
	});

	it('says the item no longer exists when it is deleted elsewhere while the dialog is open, and announces it deleted', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		serve([apiItem(null)], () => jsonResponse({ type: 'Error', title: 'Item not found', status: 404, detail: `The validation ${ID} does not exist.` }, 404));
		const { host, peek, happened } = createHost();

		await deleteValidation(host);

		expect(peek.mock.calls).toStrictEqual([['warning', { data: { message: 'formulate_itemNotFound' } }]]);
		expect(happened).toStrictEqual([`structure of formulate-validation ${ID}`, `deleted formulate-validation ${ID}`]);
	});

	it('runs every Formulate delete, of items and of folders', async () => {
		const deletes = ([...deleteManifests, ...folderManifests] as Array<{ type: string; kind?: string; api?: () => Promise<{ api: { name: string } }> }>).filter(
			(manifest) => manifest.type === 'entityAction' && (manifest.kind === 'delete' || manifest.kind === 'folderDelete'),
		);

		const apis = await Promise.all(deletes.map(async (manifest) => (await manifest.api?.())?.api.name));

		// Forms, layouts, validations and data values, and the folders of the three trees.
		expect(apis).toStrictEqual(Array(7).fill('FormulateDeleteEntityAction'));
	});
});
