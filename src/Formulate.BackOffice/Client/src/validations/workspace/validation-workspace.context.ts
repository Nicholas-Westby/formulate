import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import {
	FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_VALIDATION_ENTITY_TYPE,
	FORMULATE_VALIDATION_WORKSPACE_ALIAS,
} from '../../constants.js';
import { FormulateKindItemWorkspaceContext } from '../../core/kind-item/kind-item-workspace.context.js';
import { FORMULATE_VALIDATION_EDITOR_TYPE } from '../../core/kind-editor.js';
import type { FormulateValidationDetailModel } from '../types.js';

/** The workspace of a validation: its name, alias, and configuration, edited by its kind's editor. */
export class FormulateValidationWorkspaceContext extends FormulateKindItemWorkspaceContext<FormulateValidationDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, {
			workspaceAlias: FORMULATE_VALIDATION_WORKSPACE_ALIAS,
			entityType: FORMULATE_VALIDATION_ENTITY_TYPE,
			detailRepositoryAlias: FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS,
			editorType: FORMULATE_VALIDATION_EDITOR_TYPE,
			getDefinitions: (definitions) => definitions.getValidationDefinitions(),
		});
	}
}

export { FormulateValidationWorkspaceContext as api };
