import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { FormulateLayoutDetailModel } from '../types.js';
import { FormulateLayoutDetailServerDataSource } from './layout-detail.server.data-source.js';
import { FORMULATE_LAYOUT_DETAIL_STORE_CONTEXT } from './layout-detail.store.js';

/** The layout details (Formulate.Repository.Detail.Layout), for its workspace and the delete action. */
export class FormulateLayoutDetailRepository extends UmbDetailRepositoryBase<FormulateLayoutDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateLayoutDetailServerDataSource, FORMULATE_LAYOUT_DETAIL_STORE_CONTEXT);
	}
}

export { FormulateLayoutDetailRepository as api };
