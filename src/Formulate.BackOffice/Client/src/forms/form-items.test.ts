import { describe, expect, it } from 'vitest';
import {
	newFormField,
	newFormHandler,
	toFormField,
	toFormFieldRequest,
	toFormHandler,
	toFormHandlerRequest,
} from './form-items.js';

const FIELD_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
const HANDLER_ID = '1a6b4d2f-9c3e-4f70-8b8d-2e4f6a8c0d02';
const TEXT_KIND = '17906580-86ea-440b-bc30-9e1b099f803b';
const DROP_DOWN_KIND = '6d3df157-1bc4-4fcf-b2b7-0a94fe719b47';
const MANDATORY_ID = '5c2e8a41-7d3b-4f19-a6e0-3b9d1f7c2a03';
// A kind no installed package defines, such as one from a package that was removed.
const UNKNOWN_KIND = 'ffeeddcc-bbaa-4998-8776-655443322110';

describe('Formulate form fields, as the form designer holds them', () => {
	it('keep every part of a field the API gives, in one order, whatever order it came in', () => {
		const field = toFormField({
			configuration: { dataValue: '7a9c1e3f-5b7d-4f91-a3c5-e7f9b1d3f504' },
			validations: [MANDATORY_ID],
			category: 'Personal',
			label: 'Your state',
			alias: 'state',
			name: 'State',
			kindId: DROP_DOWN_KIND,
			id: FIELD_ID,
		});

		expect(JSON.stringify(field)).toBe(
			JSON.stringify({
				id: FIELD_ID,
				kindId: DROP_DOWN_KIND,
				name: 'State',
				alias: 'state',
				label: 'Your state',
				category: 'Personal',
				validations: [MANDATORY_ID],
				configuration: { dataValue: '7a9c1e3f-5b7d-4f91-a3c5-e7f9b1d3f504' },
			}),
		);
	});

	it('read a missing name, alias, label, category or validations as none, and leave no configuration out', () => {
		expect(toFormField({ id: FIELD_ID, kindId: TEXT_KIND, validations: undefined as unknown as Array<string> })).toStrictEqual({
			id: FIELD_ID,
			kindId: TEXT_KIND,
			name: null,
			alias: null,
			label: null,
			category: null,
			validations: [],
		});
		expect(toFormField({ id: FIELD_ID, kindId: TEXT_KIND, validations: [], configuration: null })).not.toHaveProperty(
			'configuration',
		);
	});

	it("send a field of an unknown kind back as it came, with all of its configuration", () => {
		const configuration = { columns: [{ width: 2, children: ['a', { deep: true }] }], hint: null, count: 0, flag: false };
		const api = {
			id: FIELD_ID,
			kindId: UNKNOWN_KIND,
			name: 'Signature',
			alias: 'signature',
			label: null,
			category: null,
			validations: [MANDATORY_ID],
			configuration,
		};

		expect(toFormFieldRequest(toFormField(api))).toStrictEqual(api);
		// A configuration that is not an object, which only its kind can read, is kept too.
		expect(toFormFieldRequest(toFormField({ ...api, configuration: 'v1:raw' })).configuration).toBe('v1:raw');
	});

	it('send no configuration for a field without one, rather than an explicit null', () => {
		const request = toFormFieldRequest(toFormField({ id: FIELD_ID, kindId: TEXT_KIND, validations: [] }));

		expect(request).toStrictEqual({
			id: FIELD_ID,
			kindId: TEXT_KIND,
			name: null,
			alias: null,
			label: null,
			category: null,
			validations: [],
		});
		expect('configuration' in request).toBe(false);
	});

	it("start a new field of a kind with a new ID and its own copy of the kind's default configuration", () => {
		const defaultConfiguration = { dataValue: '00000000-0000-0000-0000-000000000000' };
		const first = newFormField({ kindId: DROP_DOWN_KIND, defaultConfiguration });
		const second = newFormField({ kindId: DROP_DOWN_KIND, defaultConfiguration });

		expect(first).toStrictEqual({
			id: first.id,
			kindId: DROP_DOWN_KIND,
			name: null,
			alias: null,
			label: null,
			category: null,
			validations: [],
			configuration: { dataValue: '00000000-0000-0000-0000-000000000000' },
		});
		expect(first.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(second.id).not.toBe(first.id);
		expect(first.configuration).not.toBe(defaultConfiguration);
		expect(first.configuration).not.toBe(second.configuration);
	});

	it('start a new field of a kind without a default configuration with none', () => {
		expect(newFormField({ kindId: TEXT_KIND, defaultConfiguration: null })).not.toHaveProperty('configuration');
		expect(newFormField({ kindId: TEXT_KIND })).not.toHaveProperty('configuration');
	});
});

describe('Formulate form handlers, as the form designer holds them', () => {
	it('keep every part of a handler the API gives, in one order, and send it back the same', () => {
		const handler = toFormHandler({
			configuration: { recipients: ['a@example.com'] },
			enabled: false,
			alias: 'notify',
			name: 'Notify',
			kindId: UNKNOWN_KIND,
			id: HANDLER_ID,
		});

		expect(JSON.stringify(handler)).toBe(
			JSON.stringify({
				id: HANDLER_ID,
				kindId: UNKNOWN_KIND,
				name: 'Notify',
				alias: 'notify',
				enabled: false,
				configuration: { recipients: ['a@example.com'] },
			}),
		);
		expect(toFormHandlerRequest(handler)).toStrictEqual({
			id: HANDLER_ID,
			kindId: UNKNOWN_KIND,
			name: 'Notify',
			alias: 'notify',
			enabled: false,
			configuration: { recipients: ['a@example.com'] },
		});
	});

	it('read a missing name or alias as none, and send no configuration for a handler without one', () => {
		const handler = toFormHandler({ id: HANDLER_ID, kindId: UNKNOWN_KIND, enabled: true, configuration: null });

		expect(handler).toStrictEqual({ id: HANDLER_ID, kindId: UNKNOWN_KIND, name: null, alias: null, enabled: true });
		expect('configuration' in toFormHandlerRequest(handler)).toBe(false);
	});

	it('start a new handler enabled, with a new ID and its own copy of the default configuration', () => {
		const defaultConfiguration = { fields: [] };
		const handler = newFormHandler({ kindId: UNKNOWN_KIND, defaultConfiguration });

		expect(handler).toStrictEqual({
			id: handler.id,
			kindId: UNKNOWN_KIND,
			name: null,
			alias: null,
			enabled: true,
			configuration: { fields: [] },
		});
		expect(handler.configuration).not.toBe(defaultConfiguration);
		expect(newFormHandler({ kindId: UNKNOWN_KIND, defaultConfiguration: null })).not.toHaveProperty('configuration');
	});
});
