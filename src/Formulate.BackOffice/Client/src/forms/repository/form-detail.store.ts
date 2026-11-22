import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailStoreBase } from '@umbraco-cms/backoffice/store';
import type { FormulateFormDetailModel } from '../types.js';

/** Keeps the form details that have been read or saved, for workspaces to observe. */
export class FormulateFormDetailStore extends UmbDetailStoreBase<FormulateFormDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_FORM_DETAIL_STORE_CONTEXT.toString());
	}
}

export const FORMULATE_FORM_DETAIL_STORE_CONTEXT = new UmbContextToken<FormulateFormDetailStore>(
	'FormulateFormDetailStore',
);

export { FormulateFormDetailStore as api };
