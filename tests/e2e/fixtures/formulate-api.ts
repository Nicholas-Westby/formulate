import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { callManagementApi } from './management-api.ts';

/** The built-in kinds of validations and data values, by the IDs the API gives them. */
export const KINDS = {
	mandatory: '93957a02-6339-44a1-9323-8e8cd754680b',
	regex: 'ac9a464f-6f3f-4af9-a3b2-9c85ff0c5580',
	list: '3106d817-abfc-4d46-a9b1-aba8b8f87f39',
	pairList: '753a9598-8044-48e3-9bc6-200ac39e1d27',
	usStates: '6cffc488-670e-4cc7-b965-a5f3676ba333',
	legacy: 'bbf66f6a-8f7d-4aba-9d5b-194a46084ec2',
} as const;

/** A validation or data values item, as the API takes it. */
export interface KindItem {
	name: string;
	kindId: string;
	parentId?: string;
	alias?: string;
	configuration?: unknown;
}

/** Creates a folder through the API, at the top of a tree or in another folder. */
export async function createFolder(page: Page, treeAlias: string, name: string, parentId?: string): Promise<string> {
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/folder', { id, treeAlias, name, ...(parentId ? { parentId } : {}) });

	return id;
}

/** Creates a validation or data values item through the API. */
export async function createKindItem(page: Page, type: 'validation' | 'data-values', item: KindItem): Promise<string> {
	const id = randomUUID();
	await callManagementApi(page, 'POST', `/formulate/${type}`, { id, ...item });

	return id;
}

/** Deletes whatever the tests left at the top of a tree, through the API. */
export async function emptyTree(page: Page, treeAlias: string) {
	const { items } = await callManagementApi<{ items: Array<{ id: string; entityType: string }> }>(
		page,
		'GET',
		`/formulate/tree/${treeAlias}/root?skip=0&take=100`,
	);

	for (const item of items) {
		const type = item.entityType.endsWith('-folder') ? 'folder' : item.entityType.replace('formulate-', '');
		await callManagementApi(page, 'DELETE', `/formulate/${type}/${item.id}`);
	}
}

/**
 * Stores legacy data values at the top of the Data Values tree, as an older Formulate left them: the API
 * creates none, so the site's file of new List data values is copied with the Legacy kind and a new ID.
 * @param page A page showing the back office.
 * @param name The name of the legacy data values.
 * @returns Their ID.
 */
export async function storeLegacyDataValues(page: Page, name: string): Promise<string> {
	const folder = join(process.env.FORMULATE_E2E_RUN_FOLDER!, 'Formulate', 'DataValues');
	const fileOf = (id: string) => join(folder, `${id.replaceAll('-', '')}.dataValue`);
	const templateId = await createKindItem(page, 'data-values', {
		name: 'Legacy template',
		kindId: KINDS.list,
		configuration: { items: [{ value: 'Red' }] },
	});
	const template = readFileSync(fileOf(templateId), 'utf8');
	await callManagementApi(page, 'DELETE', `/formulate/data-values/${templateId}`);

	// Each ID the file holds, with or without dashes.
	const id = randomUUID();
	const anyForm = (guid: string) => new RegExp(guid.replaceAll('-', '-?'), 'gi');
	const legacy = template
		.replace(anyForm(templateId), (match) => (match.includes('-') ? id : id.replaceAll('-', '')))
		.replace(anyForm(KINDS.list), (match) => (match.includes('-') ? KINDS.legacy : KINDS.legacy.replaceAll('-', '')))
		.replace('"Legacy template"', JSON.stringify(name));
	writeFileSync(fileOf(id), legacy);

	return id;
}
