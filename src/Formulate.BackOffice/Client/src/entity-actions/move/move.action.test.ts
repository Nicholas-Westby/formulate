import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import {
	UmbRequestReloadChildrenOfEntityEvent,
	UmbRequestReloadStructureForEntityEvent,
} from '@umbraco-cms/backoffice/entity-action';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { UMB_TREE_PICKER_MODAL, type UmbTreePickerModalData } from '@umbraco-cms/backoffice/tree';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateFormsTreeRepository } from '../../tree/tree.repository.js';
import { FormulateFolderMoveRepository, FormulateFormMoveRepository } from './move.repository.js';
import { FormulateMoveToEntityAction } from './move.action.js';

const API = '/umbraco/management/api/v1/formulate';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const FOLDER_A = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FOLDER_B = '1c8d2e0f-4b62-4e1b-8b54-7b2f2d7c3e02';

const META = {
	icon: 'icon-enter',
	label: '#actions_move',
	treeAlias: 'Formulate.Tree.Forms',
	treeRepositoryAlias: 'Formulate.Repository.Tree.Forms',
	moveRepositoryAlias: 'Formulate.Repository.Move.Form',
	foldersOnly: true,
};

/** A tree item as the tree endpoints give it. */
function apiTreeItem(id: string, entityType: string, parentId: string | null) {
	return { id, entityType, name: id, icon: 'icon-folder', hasChildren: true, isFolder: true, parentId };
}

/** A back office host with the contexts entity actions use; the picker answers with the given value. */
function createHost(pickerAnswer?: { selection: Array<string | null> }) {
	const host = createTestHost();
	new UmbNotificationContext(host);
	const events = new UmbActionEventContext(host);
	const modals = new UmbModalManagerContext(host);
	const open = vi.spyOn(modals, 'open').mockImplementation(() => {
		const onSubmit = () => (pickerAnswer ? Promise.resolve(pickerAnswer) : Promise.reject(new Error('Cancelled')));
		return { onSubmit } as unknown as UmbModalContext;
	});
	const reloads: Array<string> = [];
	const record = (kind: string) => (event: Event) => {
		const reload = event as UmbRequestReloadChildrenOfEntityEvent;
		reloads.push(`${kind} ${reload.getEntityType()} ${reload.getUnique()}`);
	};
	events.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, record('structure of'));
	events.addEventListener(UmbRequestReloadChildrenOfEntityEvent.TYPE, record('children of'));

	return { host, open, reloads };
}

/** Answers like the API: the ancestors of the form (ending with the form), and an empty 200 for a move. */
function serveTree() {
	return fakeApi((request) =>
		request.method === 'PUT'
			? new Response(null, { status: 200 })
			: jsonResponse([
					apiTreeItem(FOLDER_A, 'formulate-form-folder', null),
					apiTreeItem(FORM_ID, 'formulate-form', FOLDER_A),
				]),
	);
}

function moveForm(host: HTMLElement) {
	return new FormulateMoveToEntityAction(host as never, { entityType: 'formulate-form', unique: FORM_ID, meta: META }).execute();
}

beforeEach(() => {
	umbExtensionsRegistry.registerMany([
		{ type: 'repository', alias: META.treeRepositoryAlias, name: 'Tree', api: FormulateFormsTreeRepository },
		{ type: 'repository', alias: META.moveRepositoryAlias, name: 'Move form', api: FormulateFormMoveRepository },
		{ type: 'repository', alias: 'Formulate.Repository.Move.Folder', name: 'Move folder', api: FormulateFolderMoveRepository },
	]);
});

afterEach(() => {
	umbExtensionsRegistry.unregisterMany([META.treeRepositoryAlias, META.moveRepositoryAlias, 'Formulate.Repository.Move.Folder']);
	document.body.replaceChildren();
});

describe('Formulate move action', () => {
	it("offers the folders and top of the item's own tree, with the item's folder open", async () => {
		serveTree();
		const { host, open } = createHost();

		await moveForm(host);

		expect(open.mock.calls[0][1]).toBe(UMB_TREE_PICKER_MODAL);
		const { data } = open.mock.calls[0][2] as { data: UmbTreePickerModalData };
		expect({ ...data, pickableFilter: undefined }).toStrictEqual({
			headline: '#actions_move',
			confirmLabel: '#general_move',
			treeAlias: 'Formulate.Tree.Forms',
			foldersOnly: true,
			expandTreeRoot: true,
			treeExpansion: [{ entityType: 'formulate-form-folder', unique: FOLDER_A }],
			pickableFilter: undefined,
		});
		const canPick = data.pickableFilter!;
		expect(canPick({ unique: null, entityType: 'formulate-forms-root' } as never)).toBe(true);
		expect(canPick({ unique: FOLDER_B, entityType: 'formulate-form-folder', parent: { unique: null } } as never)).toBe(true);
		expect(canPick({ unique: null, entityType: 'formulate-validations-root' } as never)).toBe(false);
	});

	it('does not offer a folder being moved, nor the folders inside it', async () => {
		serveTree();
		const { host, open } = createHost();

		await new FormulateMoveToEntityAction(host as never, {
			entityType: 'formulate-form-folder',
			unique: FOLDER_A,
			meta: { ...META, moveRepositoryAlias: 'Formulate.Repository.Move.Folder' },
		}).execute();

		const canPick = (open.mock.calls[0][2] as { data: UmbTreePickerModalData }).data.pickableFilter!;
		expect(canPick({ unique: FOLDER_A, entityType: 'formulate-form-folder', parent: { unique: null } } as never)).toBe(false);
		expect(canPick({ unique: FOLDER_B, entityType: 'formulate-form-folder', parent: { unique: FOLDER_A } } as never)).toBe(false);
	});

	it('moves the item to the folder picked, then reloads its old parent and the folder', async () => {
		const requests = serveTree();
		const { host, reloads } = createHost({ selection: [FOLDER_B] });

		await moveForm(host);

		expect(requests.filter((request) => request.method === 'PUT').map(pathAndQuery)).toStrictEqual([
			`${API}/form/${FORM_ID}/move`,
		]);
		expect(reloads).toStrictEqual([
			`structure of formulate-form ${FORM_ID}`,
			`children of formulate-form-folder ${FOLDER_B}`,
		]);
	});

	it('moves the item to the top of its tree, then reloads the root', async () => {
		serveTree();
		const { host, reloads } = createHost({ selection: [null] });

		await moveForm(host);

		expect(reloads).toStrictEqual([`structure of formulate-form ${FORM_ID}`, 'children of formulate-forms-root null']);
	});

	it('stays put when the picker is cancelled', async () => {
		const requests = serveTree();
		const { host, open, reloads } = createHost();

		await moveForm(host);

		expect(open).toHaveBeenCalledTimes(1);
		expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(0);
		expect(reloads).toHaveLength(0);
	});

	it('reloads nothing when the API refuses the move, and gives back its problem', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const detail = 'targetId: An item cannot be moved into itself or into something under it.';
		fakeApi((request) =>
			request.method === 'PUT'
				? jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail, field: 'targetId' }, 400)
				: jsonResponse([apiTreeItem(FORM_ID, 'formulate-form', null)]),
		);
		const { host, reloads } = createHost({ selection: [FOLDER_B] });

		await expect(moveForm(host)).rejects.toThrow(detail);
		expect(reloads).toHaveLength(0);
	});
});
