import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbMenuTreeStructureWorkspaceContextBase } from '@umbraco-cms/backoffice/menu';
import { FORMULATE_DATA_VALUES_TREE, FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from './trees.js';

// Each follows the item open in one of its tree's workspaces through the tree, as Umbraco's own trees do:
// the tree's root and the item's ancestors make the breadcrumb in the workspace's footer, and the section's
// menu expands down to the item, also when the item is opened by its URL. The manifests give each one its
// tree's menu item (meta.menuItemAlias) and limit it to the workspaces on its tree's list.

/** Follows the open item through the Forms tree. */
export class FormulateFormsMenuStructureWorkspaceContext extends UmbMenuTreeStructureWorkspaceContextBase {
	constructor(host: UmbControllerHost) {
		super(host, { treeRepositoryAlias: FORMULATE_FORMS_TREE.repositoryAlias });
	}
}

/** Follows the open item through the Data Values tree. */
export class FormulateDataValuesMenuStructureWorkspaceContext extends UmbMenuTreeStructureWorkspaceContextBase {
	constructor(host: UmbControllerHost) {
		super(host, { treeRepositoryAlias: FORMULATE_DATA_VALUES_TREE.repositoryAlias });
	}
}

/** Follows the open item through the Validation Library tree. */
export class FormulateValidationsMenuStructureWorkspaceContext extends UmbMenuTreeStructureWorkspaceContextBase {
	constructor(host: UmbControllerHost) {
		super(host, { treeRepositoryAlias: FORMULATE_VALIDATIONS_TREE.repositoryAlias });
	}
}
