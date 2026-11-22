import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailStoreBase } from '@umbraco-cms/backoffice/store';
import type { FormulateValidationDetailModel } from '../types.js';

/** Keeps the validation details that have been read or saved, for workspaces to observe. */
export class FormulateValidationDetailStore extends UmbDetailStoreBase<FormulateValidationDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_VALIDATION_DETAIL_STORE_CONTEXT.toString());
	}
}

export const FORMULATE_VALIDATION_DETAIL_STORE_CONTEXT = new UmbContextToken<FormulateValidationDetailStore>(
	'FormulateValidationDetailStore',
);

export { FormulateValidationDetailStore as api };
