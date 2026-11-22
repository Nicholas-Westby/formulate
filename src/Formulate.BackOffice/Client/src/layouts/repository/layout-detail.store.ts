import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailStoreBase } from '@umbraco-cms/backoffice/store';
import type { FormulateLayoutDetailModel } from '../types.js';

/** Keeps the layout details that have been read or saved, for workspaces to observe. */
export class FormulateLayoutDetailStore extends UmbDetailStoreBase<FormulateLayoutDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_LAYOUT_DETAIL_STORE_CONTEXT.toString());
	}
}

export const FORMULATE_LAYOUT_DETAIL_STORE_CONTEXT = new UmbContextToken<FormulateLayoutDetailStore>(
	'FormulateLayoutDetailStore',
);

export { FormulateLayoutDetailStore as api };
