import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import {
	FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_DATA_VALUES_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_WORKSPACE_ALIAS,
} from '../../constants.js';
import { FormulateKindItemWorkspaceContext } from '../../core/kind-item/kind-item-workspace.context.js';
import { FORMULATE_DATA_VALUES_EDITOR_TYPE } from '../../core/kind-editor.js';
import type { FormulateDataValuesDetailModel } from '../types.js';

/**
 * The workspace of data values: their name, alias, and configuration, edited by their kind's editor. Legacy
 * data values are read-only.
 */
export class FormulateDataValuesWorkspaceContext extends FormulateKindItemWorkspaceContext<FormulateDataValuesDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, {
			workspaceAlias: FORMULATE_DATA_VALUES_WORKSPACE_ALIAS,
			entityType: FORMULATE_DATA_VALUES_ENTITY_TYPE,
			detailRepositoryAlias: FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS,
			editorType: FORMULATE_DATA_VALUES_EDITOR_TYPE,
			getDefinitions: (definitions) => definitions.getDataValuesDefinitions(),
		});
	}
}

export { FormulateDataValuesWorkspaceContext as api };
