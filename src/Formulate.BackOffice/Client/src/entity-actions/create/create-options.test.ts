import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbRequestReloadStructureForEntityEvent } from '@umbraco-cms/backoffice/entity-action';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateOptionModel } from '../../api/index.js';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from '../../tree/trees.js';
import { describeCreateOption, requestCreateOptions } from './create-options.js';

const TREE_API = '/umbraco/management/api/v1/formulate/tree';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const KIND_ID = '3a11bd58-0ac6-43d7-8f63-2f88e7c132af';
const PLAIN_FORM_KIND_ID = '61244083-bd75-417b-af77-dfa8f8dc2673';

const ROOT = { entityType: 'formulate-forms-root', unique: null };
const FOLDER = { entityType: 'formulate-validation-folder', unique: FOLDER_ID };

/** A back office host that records the notifications it shows and the tree reloads it is asked for. */
function createHost() {
	const host = createTestHost();
	const notifications = new UmbNotificationContext(host);
	const peek = vi.spyOn(notifications, 'peek');
	const events = new UmbActionEventContext(host);
	const reloads: Array<string> = [];
	events.addEventListener(UmbRequestReloadStructureForEntityEvent.TYPE, (event) => {
		const reload = event as UmbRequestReloadStructureForEntityEvent;
		reloads.push(`${reload.getEntityType()} ${reload.getUnique()}`);
	});

	return { host, peek, reloads };
}

const FOLDER_OPTION: CreateOptionModel = { entityType: 'formulate-form-folder', name: 'Folder', icon: 'icon-folder' };
const FORM_OPTION: CreateOptionModel = {
	entityType: 'formulate-form',
	kindId: KIND_ID,
	name: 'Form with Basic Layout',
	description: 'Creates a form with a preconfigured form layout.',
	icon: 'icon-document',
};

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate create options', () => {
	it('asks for the options at the top of a tree without a parent ID, as the top is not an item', async () => {
		const requests = fakeApi(() => jsonResponse([FOLDER_OPTION, FORM_OPTION]));

		await requestCreateOptions(createTestHost(), FORMULATE_FORMS_TREE, ROOT);

		expect(requests.map(pathAndQuery)).toStrictEqual([`${TREE_API}/forms/create-options`]);
	});

	it('lists the folder last, as Umbraco does, after the kinds in the order the API gives them', async () => {
		const plainForm: CreateOptionModel = { ...FORM_OPTION, kindId: PLAIN_FORM_KIND_ID, name: 'Form' };
		fakeApi(() => jsonResponse([FOLDER_OPTION, FORM_OPTION, plainForm]));

		const options = await requestCreateOptions(createTestHost(), FORMULATE_FORMS_TREE, ROOT);

		expect(options).toStrictEqual([FORM_OPTION, plainForm, FOLDER_OPTION]);
	});

	it("asks for the options in a folder with the folder's ID, from the folder's own tree", async () => {
		const requests = fakeApi(() => jsonResponse([]));

		await requestCreateOptions(createTestHost(), FORMULATE_VALIDATIONS_TREE, FOLDER);

		expect(requests.map(pathAndQuery)).toStrictEqual([`${TREE_API}/validations/create-options?parentId=${FOLDER_ID}`]);
	});

	it('warns that the parent no longer exists when the API cannot find it, and reloads it out of the tree', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		fakeApi(() =>
			jsonResponse({ type: 'Error', title: 'Not found', status: 404, detail: 'parentId: The parent does not exist.' }, 404),
		);
		const { host, peek, reloads } = createHost();

		const options = await requestCreateOptions(host, FORMULATE_VALIDATIONS_TREE, FOLDER);

		expect(options).toBeUndefined();
		// Umbraco shows nothing for a 404 (tryExecute leaves out 401, 403 and 404), so this says it.
		expect(peek.mock.calls).toStrictEqual([['warning', { data: { message: 'formulate_itemNotFound' } }]]);
		// Reloading its structure drops the stale item from the tree.
		expect(reloads).toStrictEqual([`formulate-validation-folder ${FOLDER_ID}`]);
	});

	it('shows any other problem the API reports through Umbraco, and reloads nothing', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		fakeApi(() => jsonResponse({ type: 'Error', title: 'Something went wrong', status: 500, detail: 'Try again.' }, 500));
		const { host, peek, reloads } = createHost();

		const options = await requestCreateOptions(host, FORMULATE_VALIDATIONS_TREE, FOLDER);

		expect(options).toBeUndefined();
		// Umbraco shows it a moment later.
		await expect.poll(() => peek.mock.calls.length).toBe(1);
		expect(peek.mock.calls.map(([color, args]) => [color, JSON.stringify(args)])).toStrictEqual([
			['danger', expect.stringContaining('Something went wrong')],
		]);
		expect(reloads).toStrictEqual([]);
	});

	it("names a folder option with Umbraco's own text, as the API's name is not translated", () => {
		expect(describeCreateOption(FOLDER_OPTION, FORMULATE_FORMS_TREE)).toStrictEqual({
			name: '#create_folder',
			description: undefined,
			icon: 'icon-folder',
		});
	});

	it("shows a kind with the kind's name, description and icon", () => {
		expect(describeCreateOption(FORM_OPTION, FORMULATE_FORMS_TREE)).toStrictEqual({
			name: 'Form with Basic Layout',
			description: 'Creates a form with a preconfigured form layout.',
			icon: 'icon-document',
		});
	});

	it("keeps the API's name for an option without a kind that is not the tree's folder", () => {
		const kindlessForm: CreateOptionModel = { entityType: 'formulate-form', name: 'Form', icon: 'icon-document' };

		expect(describeCreateOption(kindlessForm, FORMULATE_FORMS_TREE).name).toBe('Form');
	});

	it('leaves out a description the API does not give', () => {
		expect(describeCreateOption({ ...FORM_OPTION, description: null }, FORMULATE_FORMS_TREE)).toStrictEqual({
			name: 'Form with Basic Layout',
			description: undefined,
			icon: 'icon-document',
		});
	});
});
