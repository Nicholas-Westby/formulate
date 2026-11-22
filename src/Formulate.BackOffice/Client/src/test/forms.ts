import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import type {
	FormFieldDefinitionModel,
	FormHandlerDefinitionModel,
	FormResponseModel,
	FormulateConfigResponseModel,
} from '../api/index.js';
import { manifests as formRepositoryManifests } from '../forms/repository/manifests.js';
import { FormulateFormDetailStore } from '../forms/repository/form-detail.store.js';
import { fakeApi, jsonResponse } from './fake-api.js';
import { API, createWorkspaceHost, DATA_VALUES_KINDS, VALIDATION_KINDS } from './kind-items.js';

// What the tests of the form designer share: the kinds of field and handler as the definitions endpoints
// give them, Formulate's configuration, and a fake API that keeps the forms it is sent.

export const FORM_ID = '4b8d2f6a-0c1e-4a3b-9d5f-7e9a1c3e5f01';
export const FIELD_ID = '0f5a3c1e-8b2d-4e6f-9a7c-1d3e5f7a9b01';
export const OTHER_FIELD_ID = '2c7e5a3d-1f4b-4c8e-a6d0-9b1d3f5a7c02';
export const HANDLER_ID = '1a6b4d2f-9c3e-4f70-8b8d-2e4f6a8c0d02';

// The kinds as the definitions endpoints give them (System.Text.Json writes GUIDs in lower case).
export const FORM_KIND = '61244083-bd75-417b-af77-dfa8f8dc2673';
export const BASIC_LAYOUT_FORM_KIND = '3a11bd58-0ac6-43d7-8f63-2f88e7c132af';
export const TEXT = '17906580-86ea-440b-bc30-9e1b099f803b';
export const DROP_DOWN = '6d3df157-1bc4-4fcf-b2b7-0a94fe719b47';
export const HEADER = '6383dd2c-68bd-482b-95db-811d09d01bc8';
export const BUTTON = 'cde8565c-5e92-4112-9a1f-7ffa1940c53c';
export const STORE_DATA = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';
// A kind no installed package defines, such as one from a package that was removed.
export const UNKNOWN_KIND = 'ffeeddcc-bbaa-4998-8776-655443322110';

/** A field definition with the features most kinds have; each kind changes what it needs. */
function fieldKind(definition: Partial<FormFieldDefinitionModel> & Pick<FormFieldDefinitionModel, 'kindId' | 'name'>) {
	return {
		icon: 'icon-document-dashed-line',
		category: 'Inputs',
		editorAlias: null,
		supportsLabel: true,
		supportsValidation: true,
		supportsCategory: true,
		isServerSideOnly: false,
		isStored: true,
		isHidden: false,
		defaultConfiguration: null,
		...definition,
	} satisfies FormFieldDefinitionModel;
}

export const FIELD_KINDS: Array<FormFieldDefinitionModel> = [
	fieldKind({ kindId: TEXT, name: 'Text', editorAlias: 'formulate-text-field' }),
	fieldKind({
		kindId: DROP_DOWN,
		name: 'Drop Down',
		icon: 'icon-formulate-drop-down',
		editorAlias: 'formulate-drop-down-field',
		defaultConfiguration: { dataValue: '00000000-0000-0000-0000-000000000000' },
	}),
	fieldKind({
		kindId: HEADER,
		name: 'Header',
		icon: 'icon-formulate-header',
		category: 'Content',
		editorAlias: 'formulate-header-field',
		supportsLabel: false,
		supportsValidation: false,
		supportsCategory: false,
		isStored: false,
		defaultConfiguration: { text: null },
	}),
	fieldKind({
		kindId: BUTTON,
		name: 'Button',
		icon: 'icon-formulate-button',
		category: 'Actions',
		editorAlias: 'formulate-button-field',
		defaultConfiguration: { buttonKind: null },
	}),
];

export const HANDLER_KINDS: Array<FormHandlerDefinitionModel> = [
	{
		kindId: STORE_DATA,
		name: 'Store Data',
		icon: 'icon-formulate-store-data',
		category: 'Persistence',
		editorAlias: 'formulate-store-data-handler',
		defaultConfiguration: null,
	},
];

export const CONFIG: FormulateConfigResponseModel = {
	buttonKinds: ['Next', 'Previous', 'Submit'],
	fieldCategories: [
		{ group: 'Personal', kind: 'Name' },
		{ group: 'Personal', kind: 'Contact' },
		{ group: 'Marketing', kind: 'Consent' },
	],
};

/** A form as the API gives it, with a Text field and a Store Data handler. */
export function contactForm(): FormResponseModel {
	return {
		id: FORM_ID,
		name: 'Contact',
		alias: 'contact',
		parentId: null,
		fields: [
			{
				id: FIELD_ID,
				kindId: TEXT,
				name: 'Name',
				alias: 'name',
				label: 'Your name',
				category: null,
				validations: [],
				configuration: null,
			},
			{
				id: OTHER_FIELD_ID,
				kindId: DROP_DOWN,
				name: 'State',
				alias: 'state',
				label: 'Your state',
				category: 'Contact',
				validations: [],
				configuration: { dataValue: '00000000-0000-0000-0000-000000000000' },
			},
		],
		handlers: [{ id: HANDLER_ID, kindId: STORE_DATA, name: 'Store', alias: 'store', enabled: true, configuration: null }],
	};
}

/**
 * A Formulate API that keeps the forms it is sent, and gives the definitions and configuration.
 * @param forms The forms the API has to begin with.
 * @param refuse An answer that replaces the API's answer to a save.
 * @param config Formulate's configuration.
 */
export function serveForms(
	forms: Array<FormResponseModel> = [],
	refuse?: () => Response,
	config: FormulateConfigResponseModel = CONFIG,
) {
	const stored = new Map(forms.map((form) => [form.id, form]));

	return fakeApi(async (request) => {
		const path = new URL(request.url).pathname.slice(API.length);

		if (path === '/definition/form-field') return jsonResponse(FIELD_KINDS);
		if (path === '/definition/form-handler') return jsonResponse(HANDLER_KINDS);
		if (path === '/definition/validation') return jsonResponse(VALIDATION_KINDS);
		if (path === '/definition/data-values') return jsonResponse(DATA_VALUES_KINDS);
		if (path === '/config') return jsonResponse(config);

		const [, , id] = path.split('/');
		if (request.method === 'POST' || request.method === 'PUT') {
			if (refuse) return refuse();
			const body = await request.clone().json();
			const form = request.method === 'POST' ? body : { ...stored.get(id), ...body, id };
			stored.set(form.id, form);
			return request.method === 'POST' ? new Response(null, { status: 201 }) : jsonResponse(form);
		}

		const form = stored.get(id);
		return form ? jsonResponse(form) : jsonResponse({ type: 'Error', title: 'Form not found', status: 404 }, 404);
	});
}

/** A back office host with what the form workspace needs (see createWorkspaceHost). */
export function createFormWorkspaceHost() {
	const workspaceHost = createWorkspaceHost();
	new FormulateFormDetailStore(workspaceHost.host);

	return workspaceHost;
}

/** Registers the form detail repository, which the workspace creates by alias. */
export function registerFormRepositories() {
	umbExtensionsRegistry.registerMany(formRepositoryManifests.filter((manifest) => !umbExtensionsRegistry.isRegistered(manifest.alias)));
}
