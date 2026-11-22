import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbItemServerDataSourceBase } from '@umbraco-cms/backoffice/repository';
import { getFormulateItem, type FormulateItemResponseModel } from '../../api/index.js';
import { getFormulateParent, getFormulateTree } from '../../tree/trees.js';
import type { FormulateItemModel } from './types.js';

/** Reads Formulate items of any tree by their IDs, through the Management API's item endpoint. */
export class FormulateItemServerDataSource extends UmbItemServerDataSourceBase<
	FormulateItemResponseModel,
	FormulateItemModel
> {
	constructor(host: UmbControllerHost) {
		super(host, {
			getItems: (uniques) => getFormulateItem({ query: { id: uniques } }),
			mapper: toItem,
		});
	}
}

function toItem(item: FormulateItemResponseModel): FormulateItemModel {
	const tree = getFormulateTree(item.entityType);

	return {
		entityType: item.entityType,
		unique: item.id,
		name: item.name,
		icon: item.icon,
		kindId: item.kindId ?? null,
		parent: tree
			? getFormulateParent(item.entityType, item.parentId, tree)
			: { unique: item.parentId ?? null, entityType: '' },
		parentName: item.parentName ?? null,
	};
}
