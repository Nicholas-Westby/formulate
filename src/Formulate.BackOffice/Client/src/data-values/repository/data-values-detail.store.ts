import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailStoreBase } from '@umbraco-cms/backoffice/store';
import type { FormulateDataValuesDetailModel } from '../types.js';

/** Keeps the data values details that have been read or saved, for workspaces to observe. */
export class FormulateDataValuesDetailStore extends UmbDetailStoreBase<FormulateDataValuesDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_DATA_VALUES_DETAIL_STORE_CONTEXT.toString());
	}
}

export const FORMULATE_DATA_VALUES_DETAIL_STORE_CONTEXT = new UmbContextToken<FormulateDataValuesDetailStore>(
	'FormulateDataValuesDetailStore',
);

export { FormulateDataValuesDetailStore as api };
