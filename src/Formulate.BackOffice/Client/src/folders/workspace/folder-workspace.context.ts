import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbFolderWorkspaceEditorElement, type UmbFolderModel } from '@umbraco-cms/backoffice/tree';
import { UmbEntityNamedDetailWorkspaceContextBase } from '@umbraco-cms/backoffice/workspace';
import { FORMULATE_DATA_VALUES_TREE, FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from '../../tree/trees.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';

/**
 * Opens a folder of one Formulate tree when it is picked in the tree, as Umbraco's own folder workspaces
 * do: the folder's name in the header, which can be changed and saved. Folders are created from the
 * create dialog, so the only route is the one that edits a folder.
 */
export class FormulateFolderWorkspaceContext extends UmbEntityNamedDetailWorkspaceContextBase<UmbFolderModel> {
	constructor(host: UmbControllerHost, tree: FormulateTreeDefinition) {
		super(host, {
			workspaceAlias: tree.folderWorkspaceAlias,
			entityType: tree.folderEntityType,
			detailRepositoryAlias: tree.folderRepositoryAlias,
		});

		this.routes.setRoutes([
			{
				path: 'edit/:unique',
				component: UmbFolderWorkspaceEditorElement,
				setup: (_component, info) => this.load(info.match.params.unique!),
			},
		]);
	}
}

/** Opens the folders of the Forms tree. */
export class FormulateFormsFolderWorkspaceContext extends FormulateFolderWorkspaceContext {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_FORMS_TREE);
	}
}

/** Opens the folders of the Data Values tree. */
export class FormulateDataValuesFolderWorkspaceContext extends FormulateFolderWorkspaceContext {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_DATA_VALUES_TREE);
	}
}

/** Opens the folders of the Validation Library tree. */
export class FormulateValidationsFolderWorkspaceContext extends FormulateFolderWorkspaceContext {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_VALIDATIONS_TREE);
	}
}
