import { UMB_WORKSPACE_CONDITION_ALIAS } from '@umbraco-cms/backoffice/workspace';
import {
	FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_FORM_FOLDER_ENTITY_TYPE,
	FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS,
} from '../../constants.js';

const workspaces: Array<UmbExtensionManifest> = [
	{
		type: 'workspace',
		kind: 'routable',
		alias: FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS,
		name: 'Formulate Forms Folder Workspace',
		api: () =>
			import('./folder-workspace.context.js').then((module) => ({ api: module.FormulateFormsFolderWorkspaceContext })),
		meta: { entityType: FORMULATE_FORM_FOLDER_ENTITY_TYPE },
	},
	{
		type: 'workspace',
		kind: 'routable',
		alias: FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS,
		name: 'Formulate Data Values Folder Workspace',
		api: () =>
			import('./folder-workspace.context.js').then((module) => ({
				api: module.FormulateDataValuesFolderWorkspaceContext,
			})),
		meta: { entityType: FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE },
	},
	{
		type: 'workspace',
		kind: 'routable',
		alias: FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS,
		name: 'Formulate Validations Folder Workspace',
		api: () =>
			import('./folder-workspace.context.js').then((module) => ({
				api: module.FormulateValidationsFolderWorkspaceContext,
			})),
		meta: { entityType: FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE },
	},
];

const workspaceActions: Array<UmbExtensionManifest> = [
	{
		type: 'workspaceAction',
		kind: 'default',
		alias: 'Formulate.WorkspaceAction.Folder.Save',
		name: 'Save Formulate Folder Workspace Action',
		api: () => import('@umbraco-cms/backoffice/workspace').then((module) => ({ api: module.UmbSubmitWorkspaceAction })),
		meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
		conditions: [
			{
				alias: UMB_WORKSPACE_CONDITION_ALIAS,
				oneOf: [
					FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS,
					FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS,
					FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS,
				],
			},
		],
	},
];

export const manifests: Array<UmbExtensionManifest> = [...workspaces, ...workspaceActions];
