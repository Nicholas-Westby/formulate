import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';

/** An item in a Formulate tree: a folder, form, layout, data values item or validation. */
export type FormulateTreeItemModel = UmbTreeItemModel;

/** The root of a Formulate tree. Roots exist only in the client. */
export type FormulateTreeRootModel = UmbTreeRootModel;

/** What differs between the Forms, Data Values and Validations trees. */
export interface FormulateTreeDefinition {
	/** The tree's name in the Management API routes, as in formulate/tree/{treeAlias}/root. */
	readonly apiAlias: string;

	/** The entity type of the tree's root. */
	readonly rootEntityType: string;

	/** The entity type of the tree's folders. */
	readonly folderEntityType: string;

	/** The root's name, as a localization key. */
	readonly rootName: string;
}
