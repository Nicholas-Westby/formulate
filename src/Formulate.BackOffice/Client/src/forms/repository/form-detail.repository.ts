import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { FormulateFormDetailModel } from '../types.js';
import { FormulateFormDetailServerDataSource } from './form-detail.server.data-source.js';
import { FORMULATE_FORM_DETAIL_STORE_CONTEXT } from './form-detail.store.js';

/** The form details (Formulate.Repository.Detail.Form), for its workspace and the delete action. */
export class FormulateFormDetailRepository extends UmbDetailRepositoryBase<FormulateFormDetailModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateFormDetailServerDataSource, FORMULATE_FORM_DETAIL_STORE_CONTEXT);
	}
}

export { FormulateFormDetailRepository as api };
