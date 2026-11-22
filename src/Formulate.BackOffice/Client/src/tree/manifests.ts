import type { ManifestWorkspaceContextMenuStructureKind } from '@umbraco-cms/backoffice/menu';
import { UMB_WORKSPACE_CONDITION_ALIAS } from '@umbraco-cms/backoffice/workspace';
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
import type { FormulateTreeDefinition } from './types.js';

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

// How a tree shows its items outside the section's menu, such as in the move dialog. Umbraco falls back
// to this view for a tree without one, but warns that the fallback goes in Umbraco 20.
const treeViews: Array<UmbExtensionManifest> = [
	{
		type: 'treeView',
		kind: 'classic',
		alias: 'Formulate.TreeView.Classic',
		name: 'Formulate Classic Tree View',
		forTrees: [FORMULATE_FORMS_TREE_ALIAS, FORMULATE_DATA_VALUES_TREE_ALIAS, FORMULATE_VALIDATIONS_TREE_ALIAS],
		meta: { label: '#tree_classicViewLabel', icon: 'icon-blockquote' },
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
		alias: FORMULATE_FORMS_TREE.menuItemAlias,
		name: 'Formulate Forms Menu Item',
		weight: 300,
		meta: { label: FORMULATE_FORMS_TREE.rootName, menus: [FORMULATE_MENU_ALIAS], treeAlias: FORMULATE_FORMS_TREE_ALIAS },
	},
	{
		type: 'menuItem',
		kind: 'tree',
		alias: FORMULATE_DATA_VALUES_TREE.menuItemAlias,
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
		alias: FORMULATE_VALIDATIONS_TREE.menuItemAlias,
		name: 'Formulate Validations Menu Item',
		weight: 100,
		meta: {
			label: FORMULATE_VALIDATIONS_TREE.rootName,
			menus: [FORMULATE_MENU_ALIAS],
			treeAlias: FORMULATE_VALIDATIONS_TREE_ALIAS,
		},
	},
];

/**
 * Shows where the open item is in its tree, as Umbraco's own trees do: a breadcrumb in the workspace's
 * footer, and the tree expanded down to the item, also when the item is opened by its URL. Both apply to
 * the workspaces on the tree's list (FORMULATE_*_TREE_WORKSPACE_ALIASES in constants.ts).
 * @param tree The tree.
 * @param name The tree's name in the aliases, such as DataValues.
 * @param api The tree's menu structure context, which reads the tree through the tree's repository.
 * @returns The workspace context and the footer app.
 */
function workspaceStructure(
	tree: FormulateTreeDefinition,
	name: string,
	api: ManifestWorkspaceContextMenuStructureKind['api'],
): Array<UmbExtensionManifest> {
	const inTreeWorkspaces = () => [{ alias: UMB_WORKSPACE_CONDITION_ALIAS, oneOf: [...tree.workspaceAliases] }];

	return [
		{
			type: 'workspaceContext',
			kind: 'menuStructure',
			alias: `Formulate.WorkspaceContext.MenuStructure.${name}`,
			name: `Formulate ${name} Menu Structure Workspace Context`,
			api,
			meta: { menuItemAlias: tree.menuItemAlias },
			conditions: inTreeWorkspaces(),
		},
		{
			type: 'workspaceFooterApp',
			kind: 'menuBreadcrumb',
			alias: `Formulate.WorkspaceFooterApp.Breadcrumb.${name}`,
			name: `Formulate ${name} Breadcrumb Workspace Footer App`,
			conditions: inTreeWorkspaces(),
		},
	];
}

/**
 * Lists what is at the top of a tree, or in one of its folders, in the root's and the folders' workspaces,
 * as Umbraco's own trees do (the Children view). Without a view, such a workspace shows only "Not found".
 * @param tree The tree.
 * @param name The tree's name in the alias, such as DataValues.
 * @returns The workspace view.
 */
function childrenView(tree: FormulateTreeDefinition, name: string): UmbExtensionManifest {
	return {
		type: 'workspaceView',
		kind: 'tree',
		alias: `Formulate.WorkspaceView.Children.${name}`,
		name: `Formulate ${name} Children Workspace View`,
		meta: { label: '#tree_children', pathname: 'children', icon: 'icon-bulleted-list', treeAlias: tree.alias },
		conditions: [{ alias: UMB_WORKSPACE_CONDITION_ALIAS, oneOf: [tree.rootWorkspaceAlias, tree.folderWorkspaceAlias] }],
	};
}

const childrenViews: Array<UmbExtensionManifest> = [
	childrenView(FORMULATE_FORMS_TREE, 'Forms'),
	childrenView(FORMULATE_DATA_VALUES_TREE, 'DataValues'),
	childrenView(FORMULATE_VALIDATIONS_TREE, 'Validations'),
];

const workspaceStructures: Array<UmbExtensionManifest> = [
	...workspaceStructure(FORMULATE_FORMS_TREE, 'Forms', () =>
		import('./menu-structure.context.js').then((module) => ({ api: module.FormulateFormsMenuStructureWorkspaceContext })),
	),
	...workspaceStructure(FORMULATE_DATA_VALUES_TREE, 'DataValues', () =>
		import('./menu-structure.context.js').then((module) => ({
			api: module.FormulateDataValuesMenuStructureWorkspaceContext,
		})),
	),
	...workspaceStructure(FORMULATE_VALIDATIONS_TREE, 'Validations', () =>
		import('./menu-structure.context.js').then((module) => ({
			api: module.FormulateValidationsMenuStructureWorkspaceContext,
		})),
	),
];

// Selecting a tree's root opens a workspace with the tree's name, as Umbraco's own trees do.
const rootWorkspaces: Array<UmbExtensionManifest> = [
	{
		type: 'workspace',
		kind: 'default',
		alias: FORMULATE_FORMS_TREE.rootWorkspaceAlias,
		name: 'Formulate Forms Root Workspace',
		meta: { entityType: FORMULATE_FORMS_ROOT_ENTITY_TYPE, headline: FORMULATE_FORMS_TREE.rootName },
	},
	{
		type: 'workspace',
		kind: 'default',
		alias: FORMULATE_DATA_VALUES_TREE.rootWorkspaceAlias,
		name: 'Formulate Data Values Root Workspace',
		meta: { entityType: FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE, headline: FORMULATE_DATA_VALUES_TREE.rootName },
	},
	{
		type: 'workspace',
		kind: 'default',
		alias: FORMULATE_VALIDATIONS_TREE.rootWorkspaceAlias,
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
	...treeViews,
	...treeItems,
	...menuItems,
	...rootWorkspaces,
	...workspaceStructures,
	...childrenViews,
	...entityActions,
];
