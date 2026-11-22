import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import { describe, expect, it } from 'vitest';
import { FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from '../../tree/trees.js';
import { createMoveTargetFilter } from './move-target-filter.js';

const MOVED_FOLDER_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_FOLDER_ID = '22222222-2222-4222-8222-222222222222';
const GRANDCHILD_FOLDER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_FOLDER_ID = '44444444-4444-4444-8444-444444444444';
const FORM_ID = '55555555-5555-4555-8555-555555555555';

const formsRoot: UmbTreeRootModel = {
	unique: null,
	entityType: 'formulate-forms-root',
	name: '#formulate_forms',
	hasChildren: true,
	isFolder: true,
};

function folder(unique: string, parentUnique: string | null, entityType = 'formulate-form-folder'): UmbTreeItemModel {
	return {
		unique,
		entityType,
		name: `Folder ${unique.slice(0, 4)}`,
		hasChildren: true,
		isFolder: true,
		icon: 'icon-folder',
		parent: {
			unique: parentUnique,
			entityType: parentUnique === null ? 'formulate-forms-root' : 'formulate-form-folder',
		},
	};
}

describe('Formulate move target filter', () => {
	it('offers the top of the tree', () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form-folder', unique: MOVED_FOLDER_ID }, FORMULATE_FORMS_TREE);

		expect(canMoveTo(formsRoot)).toBe(true);
	});

	it('offers the other folders of the tree', () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form-folder', unique: MOVED_FOLDER_ID }, FORMULATE_FORMS_TREE);

		expect(canMoveTo(folder(OTHER_FOLDER_ID, null))).toBe(true);
	});

	it('does not offer the folder being moved', () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form-folder', unique: MOVED_FOLDER_ID }, FORMULATE_FORMS_TREE);

		expect(canMoveTo(folder(MOVED_FOLDER_ID, null))).toBe(false);
	});

	it('does not offer the folders inside the folder being moved, however deep', () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form-folder', unique: MOVED_FOLDER_ID }, FORMULATE_FORMS_TREE);

		// The picker shows a folder only once its parent is open, so a parent is always checked first.
		expect(canMoveTo(folder(MOVED_FOLDER_ID, null))).toBe(false);
		expect(canMoveTo(folder(CHILD_FOLDER_ID, MOVED_FOLDER_ID))).toBe(false);
		expect(canMoveTo(folder(GRANDCHILD_FOLDER_ID, CHILD_FOLDER_ID))).toBe(false);
		expect(canMoveTo(folder(OTHER_FOLDER_ID, null))).toBe(true);
	});

	it('does not offer items that are not folders', () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form', unique: FORM_ID }, FORMULATE_FORMS_TREE);
		const form: UmbTreeItemModel = {
			unique: '66666666-6666-4666-8666-666666666666',
			entityType: 'formulate-form',
			name: 'Contact',
			hasChildren: true,
			isFolder: false,
			icon: 'icon-document',
			parent: { unique: null, entityType: 'formulate-forms-root' },
		};

		expect(canMoveTo(form)).toBe(false);
	});

	it("does not offer another tree's folders or top", () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form', unique: FORM_ID }, FORMULATE_FORMS_TREE);
		const validationsRoot: UmbTreeRootModel = { ...formsRoot, entityType: 'formulate-validations-root' };

		expect(canMoveTo(folder(OTHER_FOLDER_ID, null, 'formulate-validation-folder'))).toBe(false);
		expect(canMoveTo(validationsRoot)).toBe(false);
	});

	it('offers a form every folder and the top of its tree', () => {
		const canMoveTo = createMoveTargetFilter({ entityType: 'formulate-form', unique: FORM_ID }, FORMULATE_FORMS_TREE);

		expect(canMoveTo(formsRoot)).toBe(true);
		expect(canMoveTo(folder(MOVED_FOLDER_ID, null))).toBe(true);
		expect(canMoveTo(folder(CHILD_FOLDER_ID, MOVED_FOLDER_ID))).toBe(true);
	});

	it('uses the folders and top of the tree it is given', () => {
		const canMoveTo = createMoveTargetFilter(
			{ entityType: 'formulate-validation', unique: FORM_ID },
			FORMULATE_VALIDATIONS_TREE,
		);
		const validationsRoot: UmbTreeRootModel = { ...formsRoot, entityType: 'formulate-validations-root' };

		expect(canMoveTo(validationsRoot)).toBe(true);
		expect(canMoveTo(folder(OTHER_FOLDER_ID, null, 'formulate-validation-folder'))).toBe(true);
		expect(canMoveTo(formsRoot)).toBe(false);
		expect(canMoveTo(folder(MOVED_FOLDER_ID, null))).toBe(false);
	});
});
