import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbDataSourceResponse, UmbTargetPagedModel } from '@umbraco-cms/backoffice/repository';
import { UmbError } from '@umbraco-cms/backoffice/resources';
import {
	UmbTreeServerDataSourceBase,
	type UmbTreeAncestorsOfRequestArgs,
	type UmbTreeChildrenOfRequestArgs,
	type UmbTreeRootItemsRequestArgs,
} from '@umbraco-cms/backoffice/tree';
import {
	getFormulateTreeByTreeAliasAncestors,
	getFormulateTreeByTreeAliasChildren,
	getFormulateTreeByTreeAliasRoot,
	type FormulateTreeItemResponseModel,
	type PagedFormulateTreeItemResponseModel,
} from '../api/index.js';
import {
	FORMULATE_DATA_VALUES_TREE,
	FORMULATE_FORMS_TREE,
	FORMULATE_VALIDATIONS_TREE,
	getFormulateParent,
} from './trees.js';
import type { FormulateTreeDefinition, FormulateTreeItemModel } from './types.js';

/** How many items each request reads, unless Umbraco asks for a page of another size. */
const PAGE_SIZE = 100;

type FormulateTreeLevelPart = UmbTargetPagedModel<FormulateTreeItemResponseModel>;
type FormulateTreePaging = UmbTreeRootItemsRequestArgs['paging'];
type FormulateTreeTargetPaging = Extract<NonNullable<FormulateTreePaging>, { target: unknown }>;

/** Reads one page of a tree level. */
type ReadPage = (skip: number, take: number) => Promise<{ data: PagedFormulateTreeItemResponseModel }>;

/** Reads one of the Formulate trees from the Management API. */
export class FormulateTreeServerDataSource extends UmbTreeServerDataSourceBase<
	FormulateTreeItemResponseModel,
	FormulateTreeItemModel
> {
	constructor(host: UmbControllerHost, tree: FormulateTreeDefinition) {
		super(host, {
			getRootItems: (args) => getRootItems(tree, args),
			getChildrenOf: (args) => getChildrenOf(tree, args),
			getAncestorsOf: (args) => getAncestorsOf(tree, args),
			mapper: (item) => toTreeItem(item, tree),
		});
	}
}

export class FormulateFormsTreeServerDataSource extends FormulateTreeServerDataSource {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_FORMS_TREE);
	}
}

export class FormulateDataValuesTreeServerDataSource extends FormulateTreeServerDataSource {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_DATA_VALUES_TREE);
	}
}

export class FormulateValidationsTreeServerDataSource extends FormulateTreeServerDataSource {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_VALIDATIONS_TREE);
	}
}

async function getRootItems(tree: FormulateTreeDefinition, args: UmbTreeRootItemsRequestArgs) {
	return readLevel(args.paging, (skip, take) =>
		getFormulateTreeByTreeAliasRoot({
			path: { treeAlias: tree.apiAlias },
			query: { skip, take, foldersOnly: args.foldersOnly },
		}),
	);
}

async function getChildrenOf(tree: FormulateTreeDefinition, args: UmbTreeChildrenOfRequestArgs) {
	const parentId = args.parent.unique;

	if (parentId === null) {
		return getRootItems(tree, args);
	}

	return readLevel(args.paging, (skip, take) =>
		getFormulateTreeByTreeAliasChildren({
			path: { treeAlias: tree.apiAlias },
			query: { parentId, skip, take, foldersOnly: args.foldersOnly },
		}),
	);
}

async function getAncestorsOf(tree: FormulateTreeDefinition, args: UmbTreeAncestorsOfRequestArgs) {
	const { data } = await getFormulateTreeByTreeAliasAncestors({
		path: { treeAlias: tree.apiAlias },
		query: { descendantId: args.treeItem.unique },
	});

	return { data };
}

/**
 * Reads the part of a tree level that Umbraco asks for: a page (skip and take), or the items around a
 * target item, which Umbraco asks for to show more items ("Load more") or to open the tree at an item.
 */
async function readLevel(
	paging: FormulateTreePaging,
	readPage: ReadPage,
): Promise<UmbDataSourceResponse<FormulateTreeLevelPart>> {
	if (paging && 'target' in paging) {
		return readAroundTarget(paging, readPage);
	}

	const skip = paging?.skip ?? 0;
	const { data } = await readPage(skip, paging?.take ?? PAGE_SIZE);

	return {
		data: {
			...data,
			totalBefore: skip,
			totalAfter: Math.max(data.total - skip - data.items.length, 0),
		},
	};
}

/**
 * Reads up to takeBefore items before the target, the target itself and up to takeAfter items after
 * it, as Umbraco's siblings endpoints return them; totalBefore and totalAfter count the items outside
 * that window. The API pages by skip and take only, so this reads the level from the start, a page at
 * a time, until it has the target and the items after it.
 */
async function readAroundTarget(
	paging: FormulateTreeTargetPaging,
	readPage: ReadPage,
): Promise<UmbDataSourceResponse<FormulateTreeLevelPart>> {
	const items: Array<FormulateTreeItemResponseModel> = [];
	let total = 0;
	let targetIndex = -1;

	do {
		const { data } = await readPage(items.length, PAGE_SIZE);
		const indexInPage = data.items.findIndex((item) => item.id === paging.target.unique);

		if (targetIndex === -1 && indexInPage !== -1) {
			targetIndex = items.length + indexInPage;
		}

		total = data.total;
		items.push(...data.items);

		// The level got shorter while it was read.
		if (data.items.length === 0) {
			break;
		}
	} while (items.length < total && (targetIndex === -1 || items.length <= targetIndex + paging.takeAfter));

	if (targetIndex === -1) {
		// The same error Umbraco's own trees give. Umbraco looks for "not found" in it, then tries again
		// from the item next to the target, or loads the level from the start.
		return { error: new UmbError('Target was not found within parent') };
	}

	const start = Math.max(targetIndex - paging.takeBefore, 0);
	const end = Math.min(targetIndex + paging.takeAfter + 1, items.length);

	return {
		data: {
			items: items.slice(start, end),
			total,
			totalBefore: start,
			totalAfter: Math.max(total - end, 0),
		},
	};
}

/** Maps an API item to a tree item. The API gives only the parent's ID (see getFormulateParent). */
function toTreeItem(item: FormulateTreeItemResponseModel, tree: FormulateTreeDefinition): FormulateTreeItemModel {
	return {
		unique: item.id,
		entityType: item.entityType,
		name: item.name,
		hasChildren: item.hasChildren,
		isFolder: item.isFolder,
		icon: item.icon,
		parent: getFormulateParent(item.entityType, item.parent?.id, tree),
	};
}
