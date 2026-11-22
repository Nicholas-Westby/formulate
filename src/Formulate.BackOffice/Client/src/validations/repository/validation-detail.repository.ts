import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { FormulateValidationDetailModel } from '../types.js';
import { FormulateValidationDetailServerDataSource } from './validation-detail.server.data-source.js';
import { FORMULATE_VALIDATION_DETAIL_STORE_CONTEXT } from './validation-detail.store.js';

/** The validation details (Formulate.Repository.Detail.Validation), for its workspace and the delete action. */
export class FormulateValidationDetailRepository extends UmbDetailRepositoryBase<FormulateValidationDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateValidationDetailServerDataSource, FORMULATE_VALIDATION_DETAIL_STORE_CONTEXT);
	}
}

export { FormulateValidationDetailRepository as api };
