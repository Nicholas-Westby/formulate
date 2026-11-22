import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbTreeRepositoryBase, type UmbTreeDataSource } from '@umbraco-cms/backoffice/tree';
import {
	FormulateDataValuesTreeServerDataSource,
	FormulateFormsTreeServerDataSource,
	FormulateValidationsTreeServerDataSource,
} from './tree.server.data-source.js';
import { FORMULATE_DATA_VALUES_TREE, FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from './trees.js';
import type { FormulateTreeDefinition, FormulateTreeItemModel, FormulateTreeRootModel } from './types.js';

type FormulateTreeDataSourceConstructor = new (host: UmbControllerHost) => UmbTreeDataSource<FormulateTreeItemModel>;

/** The repository behind one of the Formulate trees. */
export class FormulateTreeRepository extends UmbTreeRepositoryBase<FormulateTreeItemModel, FormulateTreeRootModel> {
	#tree: FormulateTreeDefinition;

	constructor(
		host: UmbControllerHost,
		dataSource: FormulateTreeDataSourceConstructor,
		tree: FormulateTreeDefinition,
	) {
		super(host, dataSource);
		this.#tree = tree;
	}

	/**
	 * The root is built in the client, as the API has no root item. Like Umbraco's own roots, it reads
	 * the first item of the tree to learn whether there is anything to expand.
	 */
	override async requestTreeRoot() {
		const { data: firstItem } = await this._treeSource.getRootItems({ paging: { skip: 0, take: 1 } });
		const data: FormulateTreeRootModel = {
			unique: null,
			entityType: this.#tree.rootEntityType,
			name: this.#tree.rootName,
			hasChildren: firstItem ? firstItem.total > 0 : false,
			isFolder: true,
		};

		return { data };
	}
}

export class FormulateFormsTreeRepository extends FormulateTreeRepository {
	constructor(host: UmbControllerHost) {
		super(host, FormulateFormsTreeServerDataSource, FORMULATE_FORMS_TREE);
	}
}

export class FormulateDataValuesTreeRepository extends FormulateTreeRepository {
	constructor(host: UmbControllerHost) {
		super(host, FormulateDataValuesTreeServerDataSource, FORMULATE_DATA_VALUES_TREE);
	}
}

export class FormulateValidationsTreeRepository extends FormulateTreeRepository {
	constructor(host: UmbControllerHost) {
		super(host, FormulateValidationsTreeServerDataSource, FORMULATE_VALIDATIONS_TREE);
	}
}
