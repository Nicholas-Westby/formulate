import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';

/** A Formulate item of any tree, as pickers and entity actions show it. */
export interface FormulateItemModel {
	entityType: string;
	unique: string;
	name: string;
	icon: string;
	/** The kind of a form, layout, validation or data values item; null for folders and kindless items. */
	kindId: string | null;
	/** Where the item is: the top of its tree (unique null), a folder, or for a layout its form. */
	parent: UmbEntityModel;
	/** The parent's name; null at the top of a tree. */
	parentName: string | null;
}
