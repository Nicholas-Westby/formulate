import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import {
	FormulateDataValuesMoveRepository,
	FormulateFolderMoveRepository,
	FormulateFormMoveRepository,
	FormulateValidationMoveRepository,
} from './move.repository.js';

const API = '/umbraco/management/api/v1/formulate';
const ITEM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';

async function describeRequest(request: Request) {
	return `${request.method} ${pathAndQuery(request)} ${await request.clone().text()}`;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate move repositories', () => {
	it('move each kind of item through its own endpoint, into a folder', async () => {
		const requests = fakeApi(() => new Response(null, { status: 200 }));
		const host = createTestHost();
		new UmbNotificationContext(host);
		const destination = { unique: FOLDER_ID };

		await new FormulateFormMoveRepository(host).requestMoveTo({ unique: ITEM_ID, destination });
		await new FormulateFolderMoveRepository(host).requestMoveTo({ unique: ITEM_ID, destination });
		await new FormulateValidationMoveRepository(host).requestMoveTo({ unique: ITEM_ID, destination });
		await new FormulateDataValuesMoveRepository(host).requestMoveTo({ unique: ITEM_ID, destination });

		expect(await Promise.all(requests.map(describeRequest))).toStrictEqual([
			`PUT ${API}/form/${ITEM_ID}/move {"targetId":"${FOLDER_ID}"}`,
			`PUT ${API}/folder/${ITEM_ID}/move {"targetId":"${FOLDER_ID}"}`,
			`PUT ${API}/validation/${ITEM_ID}/move {"targetId":"${FOLDER_ID}"}`,
			`PUT ${API}/data-values/${ITEM_ID}/move {"targetId":"${FOLDER_ID}"}`,
		]);
	});

	it('move an item to the top of its tree with an empty target, as the API needs a body', async () => {
		const requests = fakeApi(() => new Response(null, { status: 200 }));
		const host = createTestHost();
		new UmbNotificationContext(host);

		const { error } = await new FormulateFolderMoveRepository(host).requestMoveTo({
			unique: ITEM_ID,
			destination: { unique: null },
		});

		expect(error).toBeUndefined();
		expect(await Promise.all(requests.map(describeRequest))).toStrictEqual([
			`PUT ${API}/folder/${ITEM_ID}/move {"targetId":null}`,
		]);
	});

	it('tell the user the item moved', async () => {
		fakeApi(() => new Response(null, { status: 200 }));
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');

		await new FormulateFormMoveRepository(host).requestMoveTo({ unique: ITEM_ID, destination: { unique: FOLDER_ID } });

		expect(peek).toHaveBeenCalledWith('positive', { data: { message: 'formulate_moved' } });
	});

	it('give back the problem the API reports, such as a folder moved into itself, and say nothing of a move', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const detail = 'targetId: An item cannot be moved into itself or into something under it.';
		fakeApi(() =>
			jsonResponse({ type: 'Error', title: 'Invalid request', status: 400, detail, field: 'targetId' }, 400),
		);
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');

		const { error } = await new FormulateFolderMoveRepository(host).requestMoveTo({
			unique: ITEM_ID,
			destination: { unique: FOLDER_ID },
		});

		expect(error?.message).toBe(detail);
		await vi.waitFor(() => expect(peek).toHaveBeenCalledWith('danger', expect.anything()));
		expect(peek).not.toHaveBeenCalledWith('positive', expect.anything());
	});
});
