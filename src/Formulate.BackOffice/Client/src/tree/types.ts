import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';

/** An item in a Formulate tree: a folder, form, layout, data values item or validation. */
export type FormulateTreeItemModel = UmbTreeItemModel;

/** The root of a Formulate tree. Roots exist only in the client. */
export type FormulateTreeRootModel = UmbTreeRootModel;

/** What differs between the Forms, Data Values and Validations trees. */
export interface FormulateTreeDefinition {
	/** The tree's name in the Management API routes, as in formulate/tree/{treeAlias}/root. */
	readonly apiAlias: string;

	/** The alias of the tree's extension, as pickers that show the tree need it. */
	readonly alias: string;

	/** The alias of the tree's repository. */
	readonly repositoryAlias: string;

	/** The alias of the repository of the tree's folders. */
	readonly folderRepositoryAlias: string;

	/** The alias of the workspace that opens the tree's root. */
	readonly rootWorkspaceAlias: string;

	/** The alias of the workspace that opens the tree's folders. */
	readonly folderWorkspaceAlias: string;

	/** The workspaces of the tree's items, which show the tree's breadcrumb and expand the tree to their item. */
	readonly workspaceAliases: ReadonlyArray<string>;

	/** The alias of the section menu's item that shows the tree. */
	readonly menuItemAlias: string;

	/** The entity type of the tree's root. */
	readonly rootEntityType: string;

	/** The entity type of the tree's folders. */
	readonly folderEntityType: string;

	/** The entity types of the other items in the tree. */
	readonly itemEntityTypes: ReadonlyArray<string>;

	/** The root's name, as a localization key. */
	readonly rootName: string;
}
