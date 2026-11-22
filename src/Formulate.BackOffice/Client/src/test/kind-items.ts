import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbEntityDeletedEvent, UmbRequestReloadChildrenOfEntityEvent } from '@umbraco-cms/backoffice/entity-action';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { UMB_VALIDATION_CONTEXT } from '@umbraco-cms/backoffice/validation';
import { vi } from 'vitest';
import type { KindDefinitionModel } from '../api/index.js';
import { FormulateDefinitionsContext } from '../core/definitions.context.js';
import { FormulateDataValuesDetailStore } from '../data-values/repository/data-values-detail.store.js';
import { manifests as dataValuesRepositoryManifests } from '../data-values/repository/manifests.js';
import { manifests as validationRepositoryManifests } from '../validations/repository/manifests.js';
import { FormulateValidationDetailStore } from '../validations/repository/validation-detail.store.js';
import { fakeApi, jsonResponse, pathAndQuery } from './fake-api.js';
import { createTestHost, type FormulateTestHostElement } from './test-host.js';

// What the tests of the validation and data values workspaces share: the kinds, a fake API that keeps
// what is saved, and a back office host with the contexts a workspace needs.

export const API = '/umbraco/management/api/v1/formulate';
export const ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';
export const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';

// The kinds as the definitions endpoints give them (System.Text.Json writes GUIDs in lower case).
export const MANDATORY = '93957a02-6339-44a1-9323-8e8cd754680b';
export const REGEX = 'ac9a464f-6f3f-4af9-a3b2-9c85ff0c5580';
export const LIST = '3106d817-abfc-4d46-a9b1-aba8b8f87f39';
export const US_STATES = '6cffc488-670e-4cc7-b965-a5f3676ba333';
export const LEGACY = 'bbf66f6a-8f7d-4aba-9d5b-194a46084ec2';

export const VALIDATION_KINDS: Array<KindDefinitionModel> = [
	{
		kindId: MANDATORY,
		name: 'Mandatory',
		icon: 'icon-check',
		editorAlias: 'formulate-mandatory-validation',
		isLegacy: false,
		defaultConfiguration: { message: null, clientSideOnly: false },
	},
	{
		kindId: REGEX,
		name: 'Regular Expression',
		icon: 'icon-check',
		editorAlias: 'formulate-regex-validation',
		isLegacy: false,
		defaultConfiguration: { regex: null, message: null },
	},
];

export const DATA_VALUES_KINDS: Array<KindDefinitionModel> = [
	{
		kindId: LIST,
		name: 'List',
		icon: 'icon-bulleted-list',
		editorAlias: 'formulate-list-data-values',
		isLegacy: false,
		defaultConfiguration: { items: [] },
	},
	{
		kindId: US_STATES,
		name: 'List of States and Territories in the United States',
		icon: 'icon-globe',
		editorAlias: 'formulate-dynamic-data-values',
		isLegacy: false,
		defaultConfiguration: null,
	},
	{ kindId: LEGACY, name: 'Legacy', icon: 'icon-block', editorAlias: 'formulate-legacy-data-value', isLegacy: true },
];

export const REGEX_VALIDATION = { id: ID, name: 'Zip code', alias: 'zipCode', parentId: null, kindId: REGEX, configuration: { regex: '^\\d{5}$', message: 'Enter a zip code.' } };

/**
 * A Formulate API that keeps what is saved: the definitions, then validations and data values by ID.
 * @param items The items the API has to begin with.
 * @param refuse An answer that replaces the API's answer to a save.
 */
export function serve(items: Array<{ id: string } & Record<string, unknown>> = [], refuse?: () => Response) {
	const stored = new Map(items.map((item) => [item.id, item]));

	return fakeApi(async (request) => {
		const path = new URL(request.url).pathname.slice(API.length);

		if (path === '/definition/validation') return jsonResponse(VALIDATION_KINDS);
		if (path === '/definition/data-values') return jsonResponse(DATA_VALUES_KINDS);

		const [, , id] = path.split('/');
		if (request.method === 'POST' || request.method === 'PUT') {
			if (refuse) return refuse();
			const body = await request.clone().json();
			const item = request.method === 'POST' ? body : { ...stored.get(id), ...body };
			stored.set(item.id ?? id, item);
			return request.method === 'POST' ? new Response(null, { status: 201 }) : jsonResponse(item);
		}

		const item = stored.get(id);
		return item ? jsonResponse(item) : jsonResponse({ type: 'Error', title: 'Item not found', status: 404 }, 404);
	});
}

/** Each save sent to the API, as [method and path, JSON body]. */
export async function describeSaves(requests: Array<Request>) {
	const saves = requests.filter((request) => request.method === 'POST' || request.method === 'PUT');
	return Promise.all(saves.map(async (request) => [`${request.method} ${pathAndQuery(request)}`, await request.clone().json()]));
}

/**
 * A back office host with what a workspace needs, which records the reloads of children it is asked for and
 * the items announced as deleted.
 */
export function createWorkspaceHost() {
	const host = createTestHost();
	const peek = vi.spyOn(new UmbNotificationContext(host), 'peek');
	const events = new UmbActionEventContext(host);
	new FormulateDefinitionsContext(host);
	new FormulateValidationDetailStore(host);
	new FormulateDataValuesDetailStore(host);
	const reloadedChildren: Array<string> = [];
	events.addEventListener(UmbRequestReloadChildrenOfEntityEvent.TYPE, (event) => {
		const reload = event as UmbRequestReloadChildrenOfEntityEvent;
		reloadedChildren.push(`${reload.getEntityType()} ${reload.getUnique()}`);
	});
	const deleted: Array<string> = [];
	events.addEventListener(UmbEntityDeletedEvent.TYPE, (event) => {
		const entity = event as UmbEntityDeletedEvent;
		deleted.push(`${entity.getEntityType()} ${entity.getUnique()}`);
	});

	return { host, peek, events, reloadedChildren, deleted };
}

/** The validation messages of the workspace on a host, as the workspace's elements see them. */
export async function getMessages(host: FormulateTestHostElement) {
	const validation = await host.getContext(UMB_VALIDATION_CONTEXT);
	return (validation?.messages.getMessages() ?? []).map(({ type, path, body }) => ({ type, path, body }));
}

/** Waits for the next value of an observable that is not undefined. */
export function firstDefined<T>(observable: { subscribe: (next: (value: T) => void) => { unsubscribe: () => void } }) {
	return new Promise<T>((resolve) => {
		const subscription = observable.subscribe((value) => {
			if (value !== undefined) {
				queueMicrotask(() => subscription.unsubscribe());
				resolve(value);
			}
		});
	});
}

const contexts: Array<{ destroy: () => void }> = [];

/** Keeps a context to destroy after the test, so its listeners do not reach the next test. */
export function keep<T extends { destroy: () => void }>(context: T): T {
	contexts.push(context);
	return context;
}

/** Destroys the contexts kept by {@link keep}. */
export function destroyKept() {
	contexts.splice(0).forEach((context) => context.destroy());
}

/** Registers the detail repositories the workspaces create by alias. */
export function registerKindItemRepositories() {
	const manifests = [...validationRepositoryManifests, ...dataValuesRepositoryManifests];
	umbExtensionsRegistry.registerMany(manifests.filter((manifest) => !umbExtensionsRegistry.isRegistered(manifest.alias)));
}
