import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
	FormFieldDefinitionModel,
	FormHandlerDefinitionModel,
	FormulateConfigResponseModel,
	KindDefinitionModel,
	TemplateDefinitionModel,
} from '../api/index.js';
import { fakeApi, jsonResponse } from '../test/fake-api.js';
import { createTestHost } from '../test/test-host.js';
import { FormulateDefinitionsContext } from './definitions.context.js';

const API = '/umbraco/management/api/v1/formulate';

const FORM_FIELDS: Array<FormFieldDefinitionModel> = [
	{
		kindId: '0d3cd7a0-9e1a-4a5e-a1f3-3b5f2b4c6d01',
		name: 'Text',
		icon: 'icon-autofill',
		category: 'Input',
		editorAlias: null,
		supportsLabel: true,
		supportsValidation: true,
		supportsCategory: true,
		isServerSideOnly: false,
		isStored: true,
		isHidden: false,
	},
];

const FORM_HANDLERS: Array<FormHandlerDefinitionModel> = [
	{
		kindId: '1e4de8b1-af2b-4b6f-b204-4c603c5d7e02',
		name: 'Store Data',
		icon: 'icon-server',
		category: 'Storage',
		editorAlias: 'formulate-store-data',
	},
];

function kinds(name: string, editorAlias: string): Array<KindDefinitionModel> {
	return [{ kindId: '2f5ef9c2-b03c-4c70-8315-5d714d6e8f03', name, icon: 'icon-check', editorAlias, isLegacy: false }];
}

const VALIDATIONS = kinds('Mandatory', 'formulate-mandatory');
const DATA_VALUES = kinds('List', 'formulate-list');
const LAYOUTS = kinds('Basic', 'formulate-basic-layout');

const TEMPLATES: Array<TemplateDefinitionModel> = [
	{ id: '3a6f0ad3-c14d-4d81-9426-6e825e7f9004', name: 'Plain JavaScript', isDefault: true },
];

const CONFIG: FormulateConfigResponseModel = {
	buttonKinds: ['Submit', 'Next', 'Previous'],
	fieldCategories: [{ group: 'Personal', kind: 'Text' }],
};

const RESPONSES: Record<string, unknown> = {
	[`${API}/definition/form-field`]: FORM_FIELDS,
	[`${API}/definition/form-handler`]: FORM_HANDLERS,
	[`${API}/definition/validation`]: VALIDATIONS,
	[`${API}/definition/data-values`]: DATA_VALUES,
	[`${API}/definition/layout`]: LAYOUTS,
	[`${API}/definition/template`]: TEMPLATES,
	[`${API}/config`]: CONFIG,
};

function path(request: Request) {
	return new URL(request.url).pathname;
}

function answerFromResponses() {
	return fakeApi((request) => jsonResponse(RESPONSES[path(request)]));
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate definitions context', () => {
	it('reads nothing until a definition is first asked for, then reads it once', async () => {
		const requests = answerFromResponses();
		const context = new FormulateDefinitionsContext(createTestHost());

		expect(requests).toHaveLength(0);

		const [first, second] = await Promise.all([context.getFormFieldDefinitions(), context.getFormFieldDefinitions()]);
		const later = await context.getFormFieldDefinitions();

		expect(first).toStrictEqual(FORM_FIELDS);
		expect(second).toStrictEqual(FORM_FIELDS);
		expect(later).toStrictEqual(FORM_FIELDS);
		expect(requests.map(path)).toStrictEqual([`${API}/definition/form-field`]);
	});

	it('reads each kind of definition and the config from its own endpoint', async () => {
		const requests = answerFromResponses();
		const context = new FormulateDefinitionsContext(createTestHost());

		expect(await context.getFormHandlerDefinitions()).toStrictEqual(FORM_HANDLERS);
		expect(await context.getValidationDefinitions()).toStrictEqual(VALIDATIONS);
		expect(await context.getDataValuesDefinitions()).toStrictEqual(DATA_VALUES);
		expect(await context.getLayoutDefinitions()).toStrictEqual(LAYOUTS);
		expect(await context.getTemplateDefinitions()).toStrictEqual(TEMPLATES);
		expect(await context.getConfig()).toStrictEqual(CONFIG);
		expect(requests.map(path)).toStrictEqual([
			`${API}/definition/form-handler`,
			`${API}/definition/validation`,
			`${API}/definition/data-values`,
			`${API}/definition/layout`,
			`${API}/definition/template`,
			`${API}/config`,
		]);
	});

	it('reads a definition when its observable is first observed, then emits it', async () => {
		const requests = answerFromResponses();
		const context = new FormulateDefinitionsContext(createTestHost());
		const layouts: Array<unknown> = [];
		const configs: Array<unknown> = [];

		const layoutSubscription = context.layoutDefinitions.subscribe((value) => layouts.push(value));
		const configSubscription = context.config.subscribe((value) => configs.push(value));
		await vi.waitFor(() => {
			expect(layouts.at(-1)).toStrictEqual(LAYOUTS);
			expect(configs.at(-1)).toStrictEqual(CONFIG);
		});
		layoutSubscription.unsubscribe();
		configSubscription.unsubscribe();

		expect(requests.map(path)).toStrictEqual([`${API}/definition/layout`, `${API}/config`]);
	});

	it('tells the user when a read fails, and reads again on the next use', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		let fail = true;
		const requests = fakeApi((request) =>
			fail
				? jsonResponse({ title: 'Server error', status: 500, detail: 'The definitions could not be read.' }, 500)
				: jsonResponse(RESPONSES[path(request)]),
		);
		const host = createTestHost();
		const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
		const context = new FormulateDefinitionsContext(host);

		const afterFailure = await context.getValidationDefinitions();
		await vi.waitFor(() => expect(peek).toHaveBeenCalledWith('danger', expect.anything()));
		fail = false;
		const afterRetry = await context.getValidationDefinitions();

		expect(afterFailure).toStrictEqual([]);
		expect(afterRetry).toStrictEqual(VALIDATIONS);
		expect(requests.map(path)).toStrictEqual([`${API}/definition/validation`, `${API}/definition/validation`]);
	});
});
