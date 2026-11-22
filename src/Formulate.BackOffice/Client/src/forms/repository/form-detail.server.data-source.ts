import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import {
	deleteFormulateFormById,
	getFormulateFormById,
	postFormulateForm,
	putFormulateFormById,
	type FormResponseModel,
} from '../../api/index.js';
import { FORMULATE_FORM_ENTITY_TYPE } from '../../constants.js';
import { FormulateDetailServerDataSource } from '../../core/detail/detail.server.data-source.js';
import type { FormulateFormDetailModel } from '../types.js';

/** Reads, creates, saves and deletes forms. Deleting a form deletes its layouts. */
export class FormulateFormDetailServerDataSource extends FormulateDetailServerDataSource<
	FormulateFormDetailModel,
	FormResponseModel
> {
	constructor(host: UmbControllerHost) {
		super(host, {
			entityType: FORMULATE_FORM_ENTITY_TYPE,
			scaffold: () => ({ name: '', alias: null, kindId: null, fields: [], handlers: [] }),
			read: (id) => getFormulateFormById({ path: { id } }),
			create: (form, parentUnique) => {
				if (!form.kindId) throw new Error('A new form needs the kind to create it with.');

				// The top of the tree is not an item, so a form there is sent without a parent ID.
				return postFormulateForm({
					body: {
						id: form.unique,
						...(parentUnique ? { parentId: parentUnique } : {}),
						kindId: form.kindId,
						name: form.name,
						alias: form.alias,
						fields: form.fields,
						handlers: form.handlers,
					},
				});
			},
			update: (form) =>
				putFormulateFormById({
					path: { id: form.unique },
					body: { name: form.name, alias: form.alias, fields: form.fields, handlers: form.handlers },
				}),
			delete: (id) => deleteFormulateFormById({ path: { id } }),
			toModel: (form) => ({
				entityType: FORMULATE_FORM_ENTITY_TYPE,
				unique: form.id,
				name: form.name,
				alias: form.alias ?? null,
				kindId: null,
				fields: form.fields,
				handlers: form.handlers,
			}),
		});
	}
}
