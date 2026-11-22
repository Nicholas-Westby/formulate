import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import {
	deleteFormulateValidationById,
	getFormulateValidationById,
	postFormulateValidation,
	putFormulateValidationById,
	type ValidationResponseModel,
} from '../../api/index.js';
import { FORMULATE_VALIDATION_ENTITY_TYPE } from '../../constants.js';
import { FormulateDetailServerDataSource, newConfiguration } from '../../core/detail/detail.server.data-source.js';
import type { FormulateValidationDetailModel } from '../types.js';

/** Reads, creates, saves and deletes validations. */
export class FormulateValidationDetailServerDataSource extends FormulateDetailServerDataSource<
	FormulateValidationDetailModel,
	ValidationResponseModel
> {
	constructor(host: UmbControllerHost) {
		super(host, {
			entityType: FORMULATE_VALIDATION_ENTITY_TYPE,
			scaffold: () => ({ name: '', alias: null, kindId: '' }),
			read: (id) => getFormulateValidationById({ path: { id } }),
			// The top of the tree is not an item, so a validation there is sent without a parent ID.
			create: (validation, parentUnique) =>
				postFormulateValidation({
					body: {
						id: validation.unique,
						...(parentUnique ? { parentId: parentUnique } : {}),
						kindId: validation.kindId,
						name: validation.name,
						alias: validation.alias,
						...newConfiguration(validation.configuration),
					},
				}),
			update: (validation) =>
				putFormulateValidationById({
					path: { id: validation.unique },
					body: { name: validation.name, alias: validation.alias, configuration: validation.configuration },
				}),
			delete: (id) => deleteFormulateValidationById({ path: { id } }),
			toModel: (validation) => ({
				entityType: FORMULATE_VALIDATION_ENTITY_TYPE,
				unique: validation.id,
				name: validation.name,
				alias: validation.alias ?? null,
				kindId: validation.kindId,
				configuration: validation.configuration,
			}),
		});
	}
}
