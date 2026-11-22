import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import {
	FORMULATE_DATA_VALUES_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_FOLDER_REPOSITORY_ALIAS,
	FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_DATA_VALUES_MENU_ITEM_ALIAS,
	FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_ROOT_WORKSPACE_ALIAS,
	FORMULATE_DATA_VALUES_TREE_ALIAS,
	FORMULATE_DATA_VALUES_TREE_API_ALIAS,
	FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS,
	FORMULATE_DATA_VALUES_TREE_WORKSPACE_ALIASES,
	FORMULATE_FORM_ENTITY_TYPE,
	FORMULATE_FORM_FOLDER_ENTITY_TYPE,
	FORMULATE_FORMS_FOLDER_REPOSITORY_ALIAS,
	FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_FORMS_MENU_ITEM_ALIAS,
	FORMULATE_FORMS_ROOT_ENTITY_TYPE,
	FORMULATE_FORMS_ROOT_WORKSPACE_ALIAS,
	FORMULATE_FORMS_TREE_ALIAS,
	FORMULATE_FORMS_TREE_API_ALIAS,
	FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
	FORMULATE_FORMS_TREE_WORKSPACE_ALIASES,
	FORMULATE_LAYOUT_ENTITY_TYPE,
	FORMULATE_VALIDATION_ENTITY_TYPE,
	FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_FOLDER_REPOSITORY_ALIAS,
	FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_VALIDATIONS_MENU_ITEM_ALIAS,
	FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_ROOT_WORKSPACE_ALIAS,
	FORMULATE_VALIDATIONS_TREE_ALIAS,
	FORMULATE_VALIDATIONS_TREE_API_ALIAS,
	FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS,
	FORMULATE_VALIDATIONS_TREE_WORKSPACE_ALIASES,
} from '../constants.js';
import type { FormulateTreeDefinition } from './types.js';

/** Folders, forms and the forms' layouts. */
export const FORMULATE_FORMS_TREE: FormulateTreeDefinition = {
	apiAlias: FORMULATE_FORMS_TREE_API_ALIAS,
	alias: FORMULATE_FORMS_TREE_ALIAS,
	repositoryAlias: FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
	folderRepositoryAlias: FORMULATE_FORMS_FOLDER_REPOSITORY_ALIAS,
	rootWorkspaceAlias: FORMULATE_FORMS_ROOT_WORKSPACE_ALIAS,
	folderWorkspaceAlias: FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS,
	workspaceAliases: FORMULATE_FORMS_TREE_WORKSPACE_ALIASES,
	menuItemAlias: FORMULATE_FORMS_MENU_ITEM_ALIAS,
	rootEntityType: FORMULATE_FORMS_ROOT_ENTITY_TYPE,
	folderEntityType: FORMULATE_FORM_FOLDER_ENTITY_TYPE,
	itemEntityTypes: [FORMULATE_FORM_ENTITY_TYPE, FORMULATE_LAYOUT_ENTITY_TYPE],
	rootName: '#formulate_forms',
};

/** Folders and data values (the lists of choices fields can use). */
export const FORMULATE_DATA_VALUES_TREE: FormulateTreeDefinition = {
	apiAlias: FORMULATE_DATA_VALUES_TREE_API_ALIAS,
	alias: FORMULATE_DATA_VALUES_TREE_ALIAS,
	repositoryAlias: FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS,
	folderRepositoryAlias: FORMULATE_DATA_VALUES_FOLDER_REPOSITORY_ALIAS,
	rootWorkspaceAlias: FORMULATE_DATA_VALUES_ROOT_WORKSPACE_ALIAS,
	folderWorkspaceAlias: FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS,
	workspaceAliases: FORMULATE_DATA_VALUES_TREE_WORKSPACE_ALIASES,
	menuItemAlias: FORMULATE_DATA_VALUES_MENU_ITEM_ALIAS,
	rootEntityType: FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
	folderEntityType: FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
	itemEntityTypes: [FORMULATE_DATA_VALUES_ENTITY_TYPE],
	rootName: '#formulate_dataValues',
};

/** Folders and validations (the validation library). */
export const FORMULATE_VALIDATIONS_TREE: FormulateTreeDefinition = {
	apiAlias: FORMULATE_VALIDATIONS_TREE_API_ALIAS,
	alias: FORMULATE_VALIDATIONS_TREE_ALIAS,
	repositoryAlias: FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS,
	folderRepositoryAlias: FORMULATE_VALIDATIONS_FOLDER_REPOSITORY_ALIAS,
	rootWorkspaceAlias: FORMULATE_VALIDATIONS_ROOT_WORKSPACE_ALIAS,
	folderWorkspaceAlias: FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS,
	workspaceAliases: FORMULATE_VALIDATIONS_TREE_WORKSPACE_ALIASES,
	menuItemAlias: FORMULATE_VALIDATIONS_MENU_ITEM_ALIAS,
	rootEntityType: FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
	folderEntityType: FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
	itemEntityTypes: [FORMULATE_VALIDATION_ENTITY_TYPE],
	rootName: '#formulate_validationLibrary',
};

/** The three trees. */
export const FORMULATE_TREES: ReadonlyArray<FormulateTreeDefinition> = [
	FORMULATE_FORMS_TREE,
	FORMULATE_DATA_VALUES_TREE,
	FORMULATE_VALIDATIONS_TREE,
];

/**
 * Finds the tree that holds an entity type: its root, its folders or its other items.
 * @param entityType The entity type.
 * @returns The tree, or undefined for an entity type that is not Formulate's.
 */
export function getFormulateTree(entityType: string): FormulateTreeDefinition | undefined {
	return FORMULATE_TREES.find(
		(tree) =>
			tree.rootEntityType === entityType ||
			tree.folderEntityType === entityType ||
			tree.itemEntityTypes.includes(entityType),
	);
}

/**
 * The parent of an item that the API gives only the parent's ID of. Its entity type comes from where the
 * item is: a layout's parent is its form, any other item's parent is a folder of its tree, and an item
 * without a parent is at the top of its tree.
 * @param entityType The item's entity type.
 * @param parentId The ID of the item's parent; null or undefined at the top of the tree.
 * @param tree The item's tree.
 * @returns The parent.
 */
export function getFormulateParent(
	entityType: string,
	parentId: string | null | undefined,
	tree: FormulateTreeDefinition,
): UmbEntityModel {
	if (!parentId) {
		return { unique: null, entityType: tree.rootEntityType };
	}

	return {
		unique: parentId,
		entityType: entityType === FORMULATE_LAYOUT_ENTITY_TYPE ? FORMULATE_FORM_ENTITY_TYPE : tree.folderEntityType,
	};
}
