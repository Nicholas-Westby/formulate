import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import {
	UmbRequestReloadChildrenOfEntityEvent,
	UmbRequestReloadStructureForEntityEvent,
} from '@umbraco-cms/backoffice/entity-action';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { UMB_FOLDER_CREATE_MODAL } from '@umbraco-cms/backoffice/tree';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOptionModel } from '../../api/index.js';
import { fakeApi, jsonResponse } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FORMULATE_CREATE_OPTIONS_MODAL } from './create-options-modal.token.js';
import { FormulateCreateEntityAction } from './create.action.js';

const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const FORM_KIND_ID = '61244083-bd75-417b-af77-dfa8f8dc2673';
const LAYOUT_KIND_ID = 'b4e5a1f2-7c3d-4e8f-9a6b-1c2d3e4f5a60';

const FOLDER_OPTION: CreateOptionModel = { entityType: 'formulate-form-folder', name: 'Folder', icon: 'icon-folder' };
const FORM_OPTION: CreateOptionModel = { entityType: 'formulate-form', kindId: FORM_KIND_ID, name: 'Form', icon: 'icon-document' };
const LAYOUT_OPTION: CreateOptionModel = {
	entityType: 'formulate-layout',
	kindId: LAYOUT_KIND_ID,
	name: 'Basic Layout',
	icon: 'icon-layout',
};
const DATA_VALUES_FOLDER_OPTION: CreateOptionModel = {
	entityType: 'formulate-data-values-folder',
	name: 'Folder',
	icon: 'icon-folder',
};

/** A back office host with the contexts entity actions use; the dialogs answer with the given values in turn. */
function createHost(...dialogAnswers: Array<unknown>) {
	const host = createTestHost();
	const notifications = new UmbNotificationContext(host);
	const peek = vi.spyOn(notifications, 'peek');
	const events = new UmbActionEventContext(host);
	const modals = new UmbModalManagerContext(host);
	const open = vi.spyOn(modals, 'open').mockImplementation(() => {
		const answer = dialogAnswers.shift();
		const onSubmit = () => (answer === undefined ? Promise.reject(new Error('Cancelled')) : Promise.resolve(answer));
		return { onSubmit } as unknown as UmbModalContext;
	});
	const reloads: Array<UmbRequestReloadChildrenOfEntityEvent> = [];
	events.addEventListener(UmbRequestReloadChildrenOfEntityEvent.TYPE, (event) =>
		reloads.push(event as UmbRequestReloadChildrenOfEntityEvent),
	);
	const structureReloads: Array<string> = [];
	events.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, (event) => {
		const reload = event as UmbRequestReloadStructureForEntityEvent;
		structureReloads.push(`${reload.getEntityType()} ${reload.getUnique()}`);
	});

	return { host, open, peek, reloads, structureReloads };
}

function createAction(host: HTMLElement, entityType: string, unique: string | null) {
	return new FormulateCreateEntityAction(host as never, {
		entityType,
		unique,
		meta: { icon: 'icon-add', label: '#actions_createFor' },
	});
}

beforeEach(() => {
	// The back office resolves its paths against this base, as its page does.
	const base = document.createElement('base');
	base.href = '/umbraco/';
	document.head.append(base);
	history.replaceState(null, '', '/umbraco/section/formulate');
});

afterEach(() => {
	document.head.querySelector('base')?.remove();
	document.body.replaceChildren();
	history.replaceState(null, '', '/');
});

describe('Formulate create action', () => {
	it('lists what can be created in the create dialog, which runs the option picked', async () => {
		fakeApi(() => jsonResponse([FOLDER_OPTION, FORM_OPTION]));
		const { host, open, reloads } = createHost({ option: FORM_OPTION });

		await createAction(host, 'formulate-forms-root', null).execute();

		expect(open).toHaveBeenCalledTimes(1);
		expect(open.mock.calls[0][1]).toBe(FORMULATE_CREATE_OPTIONS_MODAL);
		expect(open.mock.calls[0][2]).toStrictEqual({
			data: { parent: { entityType: 'formulate-forms-root', unique: null }, options: [FORM_OPTION, FOLDER_OPTION] },
		});
		// The dialog itself follows a kind's link or creates the folder; nothing is left to do here.
		expect(location.pathname).toBe('/umbraco/section/formulate');
		expect(reloads).toHaveLength(0);
	});

	it("creates a folder with Umbraco's folder dialog and the folder's own tree, then reloads the parent", async () => {
		fakeApi(() => jsonResponse([DATA_VALUES_FOLDER_OPTION]));
		const { host, open, reloads } = createHost({ folder: { unique: 'new-folder' } });

		await createAction(host, 'formulate-data-values-folder', FOLDER_ID).execute();

		expect(open).toHaveBeenCalledTimes(1);
		expect(open.mock.calls[0][1]).toBe(UMB_FOLDER_CREATE_MODAL);
		expect(open.mock.calls[0][2]).toStrictEqual({
			data: {
				folderRepositoryAlias: 'Formulate.Repository.Folder.DataValues',
				parent: { unique: FOLDER_ID, entityType: 'formulate-data-values-folder' },
			},
		});
		// Reloading the parent's children makes the new folder appear, and the parent's caret with it.
		expect(reloads.map((event) => [event.getEntityType(), event.getUnique()])).toStrictEqual([
			['formulate-data-values-folder', FOLDER_ID],
		]);
	});

	it('opens the workspace of the only option without a dialog, as Umbraco does, such as a layout under its form', async () => {
		fakeApi(() => jsonResponse([LAYOUT_OPTION]));
		const { host, open } = createHost();

		await createAction(host, 'formulate-form', FORM_ID).execute();

		expect(open).not.toHaveBeenCalled();
		expect(location.pathname).toBe(
			`/umbraco/section/formulate/workspace/formulate-layout/create/parent/formulate-form/${FORM_ID}/${LAYOUT_KIND_ID}`,
		);
	});

	it("creates a folder only for the tree's folder option, not for any option without a kind", async () => {
		const kindlessForm: CreateOptionModel = { entityType: 'formulate-form', name: 'Form', icon: 'icon-document' };
		fakeApi(() => jsonResponse([kindlessForm]));
		const { host, open, reloads } = createHost({ folder: { unique: 'new-folder' } });

		await expect(createAction(host, 'formulate-forms-root', null).execute()).rejects.toThrow('has no kind');

		expect(open).not.toHaveBeenCalled();
		expect(reloads).toHaveLength(0);
	});

	it('stays put when the create dialog is cancelled', async () => {
		fakeApi(() => jsonResponse([FOLDER_OPTION, FORM_OPTION]));
		const { host, open, reloads } = createHost();

		await createAction(host, 'formulate-forms-root', null).execute();

		expect(open).toHaveBeenCalledTimes(1);
		expect(location.pathname).toBe('/umbraco/section/formulate');
		expect(reloads).toHaveLength(0);
	});

	it('stays put when the folder dialog of the only option is cancelled', async () => {
		fakeApi(() => jsonResponse([FOLDER_OPTION]));
		const { host, open, reloads } = createHost();

		await expect(createAction(host, 'formulate-forms-root', null).execute()).resolves.toBeUndefined();

		expect(open.mock.calls.map((call) => call[1])).toStrictEqual([UMB_FOLDER_CREATE_MODAL]);
		expect(location.pathname).toBe('/umbraco/section/formulate');
		expect(reloads).toHaveLength(0);
	});

	it('warns and reloads the folder out of the tree when it no longer exists, and opens no dialog', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const requests = fakeApi(() =>
			jsonResponse({ type: 'Error', title: 'Not found', status: 404, detail: 'id: Not found.' }, 404),
		);
		const { host, open, peek, structureReloads } = createHost();

		await createAction(host, 'formulate-form-folder', FOLDER_ID).execute();

		expect(requests).toHaveLength(1);
		expect(open).not.toHaveBeenCalled();
		expect(peek.mock.calls).toStrictEqual([['warning', { data: { message: 'formulate_itemNotFound' } }]]);
		expect(structureReloads).toStrictEqual([`formulate-form-folder ${FOLDER_ID}`]);
		expect(location.pathname).toBe('/umbraco/section/formulate');
	});
});
