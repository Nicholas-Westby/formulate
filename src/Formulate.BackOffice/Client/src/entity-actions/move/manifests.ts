import {
	FORMULATE_DATA_VALUES_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_MOVE_REPOSITORY_ALIAS,
	FORMULATE_FOLDER_MOVE_REPOSITORY_ALIAS,
	FORMULATE_FORM_ENTITY_TYPE,
	FORMULATE_FORM_MOVE_REPOSITORY_ALIAS,
	FORMULATE_VALIDATION_ENTITY_TYPE,
	FORMULATE_VALIDATION_MOVE_REPOSITORY_ALIAS,
} from '../../constants.js';
import { FORMULATE_DATA_VALUES_TREE, FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from '../../tree/trees.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';

const repositories: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_FORM_MOVE_REPOSITORY_ALIAS,
		name: 'Formulate Form Move Repository',
		api: () => import('./move.repository.js').then((module) => ({ api: module.FormulateFormMoveRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_FOLDER_MOVE_REPOSITORY_ALIAS,
		name: 'Formulate Folder Move Repository',
		api: () => import('./move.repository.js').then((module) => ({ api: module.FormulateFolderMoveRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_VALIDATION_MOVE_REPOSITORY_ALIAS,
		name: 'Formulate Validation Move Repository',
		api: () => import('./move.repository.js').then((module) => ({ api: module.FormulateValidationMoveRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_DATA_VALUES_MOVE_REPOSITORY_ALIAS,
		name: 'Formulate Data Values Move Repository',
		api: () => import('./move.repository.js').then((module) => ({ api: module.FormulateDataValuesMoveRepository })),
	},
];

/**
 * Umbraco's move action kind (its label, icon and place in the menu), with Formulate's own action, which
 * offers only the folders of the item's tree and reloads the destination.
 */
function moveAction(
	alias: string,
	name: string,
	entityType: string,
	tree: FormulateTreeDefinition,
	moveRepositoryAlias: string,
): UmbExtensionManifest {
	return {
		type: 'entityAction',
		kind: 'moveTo',
		alias,
		name,
		api: () => import('./move.action.js'),
		forEntityTypes: [entityType],
		meta: {
			treeAlias: tree.alias,
			treeRepositoryAlias: tree.repositoryAlias,
			moveRepositoryAlias,
			foldersOnly: true,
		},
	};
}

// Layouts do not move: a layout's parent is its form.
const entityActions: Array<UmbExtensionManifest> = [
	...[FORMULATE_FORMS_TREE, FORMULATE_DATA_VALUES_TREE, FORMULATE_VALIDATIONS_TREE].map((tree) =>
		moveAction(
			`Formulate.EntityAction.Folder.MoveTo.${tree.apiAlias}`,
			`Move Formulate Folder (${tree.apiAlias}) Entity Action`,
			tree.folderEntityType,
			tree,
			FORMULATE_FOLDER_MOVE_REPOSITORY_ALIAS,
		),
	),
	moveAction(
		'Formulate.EntityAction.Form.MoveTo',
		'Move Formulate Form Entity Action',
		FORMULATE_FORM_ENTITY_TYPE,
		FORMULATE_FORMS_TREE,
		FORMULATE_FORM_MOVE_REPOSITORY_ALIAS,
	),
	moveAction(
		'Formulate.EntityAction.Validation.MoveTo',
		'Move Formulate Validation Entity Action',
		FORMULATE_VALIDATION_ENTITY_TYPE,
		FORMULATE_VALIDATIONS_TREE,
		FORMULATE_VALIDATION_MOVE_REPOSITORY_ALIAS,
	),
	moveAction(
		'Formulate.EntityAction.DataValues.MoveTo',
		'Move Formulate Data Values Entity Action',
		FORMULATE_DATA_VALUES_ENTITY_TYPE,
		FORMULATE_DATA_VALUES_TREE,
		FORMULATE_DATA_VALUES_MOVE_REPOSITORY_ALIAS,
	),
];

export const manifests: Array<UmbExtensionManifest> = [...repositories, ...entityActions];
