import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import {
	deleteFormulateLayoutById,
	getFormulateLayoutById,
	postFormulateLayout,
	putFormulateLayoutById,
	type LayoutResponseModel,
} from '../../api/index.js';
import { FORMULATE_LAYOUT_ENTITY_TYPE } from '../../constants.js';
import { FormulateDetailServerDataSource, newConfiguration } from '../../core/detail/detail.server.data-source.js';
import type { FormulateLayoutDetailModel } from '../types.js';

/** Reads, creates, saves and deletes layouts. A layout is created under its form. */
export class FormulateLayoutDetailServerDataSource extends FormulateDetailServerDataSource<
	FormulateLayoutDetailModel,
	LayoutResponseModel
> {
	constructor(host: UmbControllerHost) {
		super(host, {
			entityType: FORMULATE_LAYOUT_ENTITY_TYPE,
			scaffold: () => ({ name: '', alias: null, formUnique: null, kindId: '', templateId: null }),
			read: (id) => getFormulateLayoutById({ path: { id } }),
			create: (layout, parentUnique) => {
				const formId = parentUnique ?? layout.formUnique;
				if (!formId) throw new Error('A new layout needs the form it belongs to.');

				return postFormulateLayout({
					body: {
						id: layout.unique,
						formId,
						kindId: layout.kindId,
						name: layout.name,
						alias: layout.alias,
						templateId: layout.templateId,
						...newConfiguration(layout.configuration),
					},
				});
			},
			update: (layout) =>
				putFormulateLayoutById({
					path: { id: layout.unique },
					body: {
						name: layout.name,
						alias: layout.alias,
						templateId: layout.templateId,
						configuration: layout.configuration,
					},
				}),
			delete: (id) => deleteFormulateLayoutById({ path: { id } }),
			toModel: (layout) => ({
				entityType: FORMULATE_LAYOUT_ENTITY_TYPE,
				unique: layout.id,
				name: layout.name,
				alias: layout.alias ?? null,
				formUnique: layout.formId,
				kindId: layout.kindId,
				templateId: layout.templateId ?? null,
				configuration: layout.configuration,
			}),
		});
	}
}
