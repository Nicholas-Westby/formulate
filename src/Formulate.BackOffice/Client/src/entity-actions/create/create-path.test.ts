import { describe, expect, it } from 'vitest';
import { FORMULATE_CREATE_ROUTE_PATH, getCreatePath, readCreateRouteParams } from './create-path.js';

const FORM_KIND_ID = '2b1a4ed3-5e66-4d0e-9a73-1a3fd1d1c501';
const LAYOUT_KIND_ID = '0e6c8f8f-3f8e-4f5e-a2c4-6f1f41c4b502';
const VALIDATION_KIND_ID = '7a9d2c1e-8b3f-4a6d-9e5c-2f1b0a9c8d03';
const FOLDER_ID = '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01';
const FORM_ID = '6d2f4c8a-1b3e-4f5a-8c7d-9e0f1a2b3c02';

/** Matches a whole path against a route the way Umbraco's router does: each :name takes one segment. */
function matchRoute(route: string, path: string): Record<string, string> | undefined {
	const names: Array<string> = [];
	const pattern = route.replace(/:([^/]+)/g, (_match, name: string) => {
		names.push(name);
		return '([^/]+)';
	});
	const match = new RegExp(`^${pattern}$`).exec(path);

	return match ? Object.fromEntries(names.map((name, index) => [name, match[index + 1]!])) : undefined;
}

describe('Formulate create route', () => {
	it('builds the create route of a kind at the top of a tree, with null for the parent', () => {
		const path = getCreatePath(
			{ entityType: 'formulate-form', kindId: FORM_KIND_ID, name: 'Form', icon: 'icon-document' },
			{ entityType: 'formulate-forms-root', unique: null },
		);

		expect(path).toBe(
			`section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${FORM_KIND_ID}`,
		);
	});

	it('builds the create route of a kind in a folder', () => {
		const path = getCreatePath(
			{ entityType: 'formulate-validation', kindId: VALIDATION_KIND_ID, name: 'Regex', icon: 'icon-check' },
			{ entityType: 'formulate-validation-folder', unique: FOLDER_ID },
		);

		expect(path).toBe(
			`section/formulate/workspace/formulate-validation/create/parent/formulate-validation-folder/${FOLDER_ID}/${VALIDATION_KIND_ID}`,
		);
	});

	it('builds the create route of a layout under its form', () => {
		const path = getCreatePath(
			{ entityType: 'formulate-layout', kindId: LAYOUT_KIND_ID, name: 'Basic Layout', icon: 'icon-layout' },
			{ entityType: 'formulate-form', unique: FORM_ID },
		);

		expect(path).toBe(
			`section/formulate/workspace/formulate-layout/create/parent/formulate-form/${FORM_ID}/${LAYOUT_KIND_ID}`,
		);
	});

	it('refuses an option without a kind, as a folder is created in a dialog instead', () => {
		expect(() =>
			getCreatePath(
				{ entityType: 'formulate-form-folder', kindId: null, name: 'Folder', icon: 'icon-folder' },
				{ entityType: 'formulate-forms-root', unique: null },
			),
		).toThrow('formulate-form-folder');
	});

	it('builds paths that the route workspaces register leads back to the same parent and kind', () => {
		const workspacePath = 'section/formulate/workspace/formulate-form/';
		const parents = [
			{ entityType: 'formulate-forms-root', unique: null },
			{ entityType: 'formulate-form-folder', unique: FOLDER_ID },
		];

		for (const parent of parents) {
			const path = getCreatePath(
				{ entityType: 'formulate-form', kindId: FORM_KIND_ID, name: 'Form', icon: 'icon-document' },
				parent,
			);
			expect(path.startsWith(workspacePath)).toBe(true);

			const params = matchRoute(FORMULATE_CREATE_ROUTE_PATH, path.slice(workspacePath.length));
			expect(params).toBeDefined();
			expect(readCreateRouteParams(params!)).toStrictEqual({ parent, kindId: FORM_KIND_ID });
		}
	});

	it('reads the parent and kind of a create route at the top of a tree', () => {
		const params = readCreateRouteParams({
			parentEntityType: 'formulate-forms-root',
			parentUnique: 'null',
			kindId: FORM_KIND_ID,
		});

		expect(params).toStrictEqual({
			parent: { entityType: 'formulate-forms-root', unique: null },
			kindId: FORM_KIND_ID,
		});
	});

	it('reads the parent and kind of a create route in a folder', () => {
		const params = readCreateRouteParams({
			parentEntityType: 'formulate-form-folder',
			parentUnique: FOLDER_ID,
			kindId: FORM_KIND_ID,
		});

		expect(params).toStrictEqual({
			parent: { entityType: 'formulate-form-folder', unique: FOLDER_ID },
			kindId: FORM_KIND_ID,
		});
	});

	it('refuses a create route without a parent or a kind', () => {
		expect(() => readCreateRouteParams({ parentEntityType: 'formulate-forms-root', parentUnique: 'null' })).toThrow(
			'kindId',
		);
		expect(() => readCreateRouteParams({ parentUnique: 'null', kindId: FORM_KIND_ID })).toThrow('parentEntityType');
	});
});
