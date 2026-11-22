import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbItemStoreBase } from '@umbraco-cms/backoffice/store';
import type { FormulateItemModel } from './types.js';

/** Keeps the Formulate items that have been read, so pickers and entity actions can observe them. */
export class FormulateItemStore extends UmbItemStoreBase<FormulateItemModel> {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_ITEM_STORE_CONTEXT.toString());
	}
}

export const FORMULATE_ITEM_STORE_CONTEXT = new UmbContextToken<FormulateItemStore>('FormulateItemStore');

export { FormulateItemStore as api };
