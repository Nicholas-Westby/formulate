import {
	FORMULATE_DATA_VALUES_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_TREE_ALIAS,
	FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS,
	FORMULATE_FORM_ENTITY_TYPE,
	FORMULATE_FORM_FOLDER_ENTITY_TYPE,
	FORMULATE_FORMS_ROOT_ENTITY_TYPE,
	FORMULATE_FORMS_TREE_ALIAS,
	FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
	FORMULATE_LAYOUT_ENTITY_TYPE,
	FORMULATE_MENU_ALIAS,
	FORMULATE_VALIDATION_ENTITY_TYPE,
	FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_TREE_ALIAS,
	FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS,
} from '../constants.js';
import { FORMULATE_DATA_VALUES_TREE, FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from './trees.js';

const repositories: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
		name: 'Formulate Forms Tree Repository',
		api: () => import('./tree.repository.js').then((module) => ({ api: module.FormulateFormsTreeRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS,
		name: 'Formulate Data Values Tree Repository',
		api: () => import('./tree.repository.js').then((module) => ({ api: module.FormulateDataValuesTreeRepository })),
	},
	{
		type: 'repository',
		alias: FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS,
		name: 'Formulate Validations Tree Repository',
		api: () => import('./tree.repository.js').then((module) => ({ api: module.FormulateValidationsTreeRepository })),
	},
];

const trees: Array<UmbExtensionManifest> = [
	{
		type: 'tree',
		kind: 'default',
		alias: FORMULATE_FORMS_TREE_ALIAS,
		name: 'Formulate Forms Tree',
		meta: { repositoryAlias: FORMULATE_FORMS_TREE_REPOSITORY_ALIAS },
	},
	{
		type: 'tree',
		kind: 'default',
		alias: FORMULATE_DATA_VALUES_TREE_ALIAS,
		name: 'Formulate Data Values Tree',
		meta: { repositoryAlias: FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS },
	},
	{
		type: 'tree',
		kind: 'default',
		alias: FORMULATE_VALIDATIONS_TREE_ALIAS,
		name: 'Formulate Validations Tree',
		meta: { repositoryAlias: FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS },
	},
];

const treeItems: Array<UmbExtensionManifest> = [
	{
		type: 'treeItem',
		kind: 'default',
		alias: 'Formulate.TreeItem.Forms',
		name: 'Formulate Forms Tree Item',
		forEntityTypes: [
			FORMULATE_FORMS_ROOT_ENTITY_TYPE,
			FORMULATE_FORM_FOLDER_ENTITY_TYPE,
			FORMULATE_FORM_ENTITY_TYPE,
			FORMULATE_LAYOUT_ENTITY_TYPE,
		],
	},
	{
		type: 'treeItem',
		kind: 'default',
		alias: 'Formulate.TreeItem.DataValues',
		name: 'Formulate Data Values Tree Item',
		forEntityTypes: [
			FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
			FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
			FORMULATE_DATA_VALUES_ENTITY_TYPE,
		],
	},
	{
		type: 'treeItem',
		kind: 'default',
		alias: 'Formulate.TreeItem.Validations',
		name: 'Formulate Validations Tree Item',
		forEntityTypes: [
			FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
			FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
			FORMULATE_VALIDATION_ENTITY_TYPE,
		],
	},
];

// The section's menu shows the three trees, in this order.
const menuItems: Array<UmbExtensionManifest> = [
	{
		type: 'menuItem',
		kind: 'tree',
		alias: 'Formulate.MenuItem.Forms',
		name: 'Formulate Forms Menu Item',
		weight: 300,
		meta: { label: FORMULATE_FORMS_TREE.rootName, menus: [FORMULATE_MENU_ALIAS], treeAlias: FORMULATE_FORMS_TREE_ALIAS },
	},
	{
		type: 'menuItem',
		kind: 'tree',
		alias: 'Formulate.MenuItem.DataValues',
		name: 'Formulate Data Values Menu Item',
		weight: 200,
		meta: {
			label: FORMULATE_DATA_VALUES_TREE.rootName,
			menus: [FORMULATE_MENU_ALIAS],
			treeAlias: FORMULATE_DATA_VALUES_TREE_ALIAS,
		},
	},
	{
		type: 'menuItem',
		kind: 'tree',
		alias: 'Formulate.MenuItem.Validations',
		name: 'Formulate Validations Menu Item',
		weight: 100,
		meta: {
			label: FORMULATE_VALIDATIONS_TREE.rootName,
			menus: [FORMULATE_MENU_ALIAS],
			treeAlias: FORMULATE_VALIDATIONS_TREE_ALIAS,
		},
	},
];

// Selecting a tree's root opens a workspace with the tree's name, as Umbraco's own trees do.
const rootWorkspaces: Array<UmbExtensionManifest> = [
	{
		type: 'workspace',
		kind: 'default',
		alias: 'Formulate.Workspace.FormsRoot',
		name: 'Formulate Forms Root Workspace',
		meta: { entityType: FORMULATE_FORMS_ROOT_ENTITY_TYPE, headline: FORMULATE_FORMS_TREE.rootName },
	},
	{
		type: 'workspace',
		kind: 'default',
		alias: 'Formulate.Workspace.DataValuesRoot',
		name: 'Formulate Data Values Root Workspace',
		meta: { entityType: FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE, headline: FORMULATE_DATA_VALUES_TREE.rootName },
	},
	{
		type: 'workspace',
		kind: 'default',
		alias: 'Formulate.Workspace.ValidationsRoot',
		name: 'Formulate Validations Root Workspace',
		meta: { entityType: FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE, headline: FORMULATE_VALIDATIONS_TREE.rootName },
	},
];

const entityActions: Array<UmbExtensionManifest> = [
	{
		type: 'entityAction',
		kind: 'reloadTreeItemChildren',
		alias: 'Formulate.EntityAction.ReloadTreeItemChildren',
		name: 'Reload Formulate Tree Item Children Entity Action',
		forEntityTypes: [
			FORMULATE_FORMS_ROOT_ENTITY_TYPE,
			FORMULATE_FORM_FOLDER_ENTITY_TYPE,
			FORMULATE_FORM_ENTITY_TYPE,
			FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
			FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
			FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
			FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
		],
	},
];

export const manifests: Array<UmbExtensionManifest> = [
	...repositories,
	...trees,
	...treeItems,
	...menuItems,
	...rootWorkspaces,
	...entityActions,
];
