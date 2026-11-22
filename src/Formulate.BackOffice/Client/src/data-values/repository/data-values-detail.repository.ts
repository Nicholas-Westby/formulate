import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { FormulateDataValuesDetailModel } from '../types.js';
import { FormulateDataValuesDetailServerDataSource } from './data-values-detail.server.data-source.js';
import { FORMULATE_DATA_VALUES_DETAIL_STORE_CONTEXT } from './data-values-detail.store.js';

/** The data values details (Formulate.Repository.Detail.DataValues), for its workspace and the delete action. */
export class FormulateDataValuesDetailRepository extends UmbDetailRepositoryBase<FormulateDataValuesDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateDataValuesDetailServerDataSource, FORMULATE_DATA_VALUES_DETAIL_STORE_CONTEXT);
	}
}

export { FormulateDataValuesDetailRepository as api };
