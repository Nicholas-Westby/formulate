import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse, pathAndQuery } from '../../test/fake-api.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateFormDuplicateRepository } from './duplicate.repository.js';

const API = '/umbraco/management/api/v1/formulate';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate form duplicate repository', () => {
	it('copies the form through the API, which puts the copy next to the original', async () => {
		const requests = fakeApi(() => new Response(null, { status: 201 }));
		const host = createTestHost();
		new UmbNotificationContext(host);

		const { error } = await new FormulateFormDuplicateRepository(host).requestDuplicate({ unique: FORM_ID });

		expect(error).toBeUndefined();
		expect(
			await Promise.all(
				requests.map(async (request) => `${request.method} ${pathAndQuery(request)} ${await request.clone().text()}`),
			),
		).toStrictEqual([`POST ${API}/form/${FORM_ID}/duplicate {}`]);
	});

	it('tells the user the form was copied', async () => {
		fakeApi(() => new Response(null, { status: 201 }));
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');

		await new FormulateFormDuplicateRepository(host).requestDuplicate({ unique: FORM_ID });

		expect(peek).toHaveBeenCalledWith('positive', { data: { message: 'formulate_duplicated' } });
	});

	it('gives back the problem the API reports, and says nothing of a copy', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const detail = `The form ${FORM_ID} does not exist.`;
		fakeApi(() => jsonResponse({ type: 'Error', title: 'Not found', status: 404, detail }, 404));
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');

		const { error } = await new FormulateFormDuplicateRepository(host).requestDuplicate({ unique: FORM_ID });

		expect(error?.message).toBe(detail);
		expect(peek).not.toHaveBeenCalledWith('positive', expect.anything());
	});
});
