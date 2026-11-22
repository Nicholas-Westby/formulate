import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbItemRepositoryBase } from '@umbraco-cms/backoffice/repository';
import { FormulateItemServerDataSource } from './item.server.data-source.js';
import { FORMULATE_ITEM_STORE_CONTEXT } from './item.store.js';
import type { FormulateItemModel } from './types.js';

/**
 * Formulate items of every entity type (Formulate.Repository.Item), as Umbraco's entity actions and
 * pickers ask for them: the delete action reads the name to confirm with, for example.
 */
export class FormulateItemRepository extends UmbItemRepositoryBase<FormulateItemModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateItemServerDataSource, FORMULATE_ITEM_STORE_CONTEXT);
	}
}

export { FormulateItemRepository as api };
