import {
	FORMULATE_DATA_VALUES_FOLDER_REPOSITORY_ALIAS,
	FORMULATE_FOLDER_STORE_ALIAS,
	FORMULATE_FORMS_FOLDER_REPOSITORY_ALIAS,
	FORMULATE_ITEM_REPOSITORY_ALIAS,
	FORMULATE_VALIDATIONS_FOLDER_REPOSITORY_ALIAS,
} from '../constants.js';
import { FORMULATE_TREES } from '../tree/trees.js';
import { manifests as workspaceManifests } from './workspace/manifests.js';

const repositories: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_FORMS_FOLDER_REPOSITORY_ALIAS,
		name: 'Formulate Forms Folder Repository',
		api: () => import('./folder.repository.js').then((module) => ({ api: module.FormulateFormsFolderRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_DATA_VALUES_FOLDER_REPOSITORY_ALIAS,
		name: 'Formulate Data Values Folder Repository',
		api: () =>
			import('./folder.repository.js').then((module) => ({ api: module.FormulateDataValuesFolderRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_VALIDATIONS_FOLDER_REPOSITORY_ALIAS,
		name: 'Formulate Validations Folder Repository',
		api: () =>
			import('./folder.repository.js').then((module) => ({ api: module.FormulateValidationsFolderRepository })),
	},
	{
		type: 'store',
		alias: FORMULATE_FOLDER_STORE_ALIAS,
		name: 'Formulate Folder Store',
		api: () => import('./folder.store.js'),
	},
];

// Folders are created from the create dialog (its Folder option runs Umbraco's folder create action), as
// in Umbraco's own trees, so there is no separate "Create folder" action.
const entityActions: Array<UmbExtensionManifest> = FORMULATE_TREES.flatMap((tree): Array<UmbExtensionManifest> => [
	{
		type: 'entityAction',
		kind: 'folderUpdate',
		alias: `Formulate.EntityAction.Folder.Rename.${tree.apiAlias}`,
		name: `Rename Formulate Folder (${tree.apiAlias}) Entity Action`,
		forEntityTypes: [tree.folderEntityType],
		meta: { folderRepositoryAlias: tree.folderRepositoryAlias },
	},
	{
		// Umbraco's own delete action, which confirms with a localized text. Deleting a Formulate folder
		// deletes everything in it, so the text says so.
		type: 'entityAction',
		kind: 'folderDelete',
		alias: `Formulate.EntityAction.Folder.Delete.${tree.apiAlias}`,
		name: `Delete Formulate Folder (${tree.apiAlias}) Entity Action`,
		api: () => import('@umbraco-cms/backoffice/entity-action').then((module) => ({ api: module.UmbDeleteEntityAction })),
		forEntityTypes: [tree.folderEntityType],
		meta: {
			folderRepositoryAlias: tree.folderRepositoryAlias,
			detailRepositoryAlias: tree.folderRepositoryAlias,
			itemRepositoryAlias: FORMULATE_ITEM_REPOSITORY_ALIAS,
			confirm: { message: '#formulate_confirmDeleteFolder' },
		},
	},
]);

export const manifests: Array<UmbExtensionManifest> = [...repositories, ...entityActions, ...workspaceManifests];
