import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import {
	deleteFormulateDataValuesById,
	getFormulateDataValuesById,
	postFormulateDataValues,
	putFormulateDataValuesById,
	type DataValuesResponseModel,
} from '../../api/index.js';
import { FORMULATE_DATA_VALUES_ENTITY_TYPE } from '../../constants.js';
import { FormulateDetailServerDataSource, newConfiguration } from '../../core/detail/detail.server.data-source.js';
import type { FormulateDataValuesDetailModel } from '../types.js';

/** Reads, creates, saves and deletes data values. */
export class FormulateDataValuesDetailServerDataSource extends FormulateDetailServerDataSource<
	FormulateDataValuesDetailModel,
	DataValuesResponseModel
> {
	constructor(host: UmbControllerHost) {
		super(host, {
			entityType: FORMULATE_DATA_VALUES_ENTITY_TYPE,
			scaffold: () => ({ name: '', alias: null, kindId: '', isLegacy: false }),
			read: (id) => getFormulateDataValuesById({ path: { id } }),
			// The top of the tree is not an item, so data values there are sent without a parent ID.
			create: (dataValues, parentUnique) =>
				postFormulateDataValues({
					body: {
						id: dataValues.unique,
						...(parentUnique ? { parentId: parentUnique } : {}),
						kindId: dataValues.kindId,
						name: dataValues.name,
						alias: dataValues.alias,
						...newConfiguration(dataValues.configuration),
					},
				}),
			update: (dataValues) =>
				putFormulateDataValuesById({
					path: { id: dataValues.unique },
					body: { name: dataValues.name, alias: dataValues.alias, configuration: dataValues.configuration },
				}),
			delete: (id) => deleteFormulateDataValuesById({ path: { id } }),
			toModel: (dataValues) => ({
				entityType: FORMULATE_DATA_VALUES_ENTITY_TYPE,
				unique: dataValues.id,
				name: dataValues.name,
				alias: dataValues.alias ?? null,
				kindId: dataValues.kindId,
				isLegacy: dataValues.isLegacy,
				configuration: dataValues.configuration,
			}),
		});
	}
}
