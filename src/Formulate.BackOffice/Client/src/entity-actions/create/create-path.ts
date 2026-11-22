import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbPathPattern } from '@umbraco-cms/backoffice/router';
import { UMB_WORKSPACE_PATH_PATTERN } from '@umbraco-cms/backoffice/workspace';
import type { CreateOptionModel } from '../../api/index.js';
import { FORMULATE_SECTION_PATHNAME } from '../../constants.js';

/**
 * The route each Formulate workspace registers to create something new, below its own path
 * (section/formulate/workspace/{entityType}/). The parent's unique is "null" at the top of a tree.
 */
export const FORMULATE_CREATE_ROUTE_PATH = 'create/parent/:parentEntityType/:parentUnique/:kindId';

/** The parameters of the create route, as the workspace's router gives them. */
export interface FormulateCreateRouteParams {
	parentEntityType: string;
	parentUnique: string;
	kindId: string;
}

const FORMULATE_CREATE_PATH_PATTERN = new UmbPathPattern<
	{ parentEntityType: string; parentUnique: string | null; kindId: string },
	{ sectionName: string; entityType: string }
>(FORMULATE_CREATE_ROUTE_PATH, UMB_WORKSPACE_PATH_PATTERN);

/**
 * The path that opens the workspace of a create option, to create that kind under the parent.
 * @param option A create option of a kind, as the API lists them (folders have no kind and no workspace).
 * @param parent Where the new item goes: the top of a tree (unique null), a folder, or a form for layouts.
 * @returns The path, such as section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/{kindId}.
 */
export function getCreatePath(option: CreateOptionModel, parent: UmbEntityModel): string {
	if (!option.kindId) {
		throw new Error(`The ${option.entityType} create option has no kind, so it has no workspace to open.`);
	}

	return FORMULATE_CREATE_PATH_PATTERN.generateAbsolute({
		sectionName: FORMULATE_SECTION_PATHNAME,
		entityType: option.entityType,
		parentEntityType: parent.entityType,
		parentUnique: parent.unique,
		kindId: option.kindId,
	});
}

/**
 * Reads where to create and which kind from the create route's parameters.
 * @param params The route's parameters.
 * @returns The parent (unique null at the top of a tree) and the kind ID.
 */
export function readCreateRouteParams(params: Partial<FormulateCreateRouteParams>): {
	parent: UmbEntityModel;
	kindId: string;
} {
	const { parentEntityType, parentUnique, kindId } = params;

	if (!parentEntityType || !parentUnique) {
		throw new Error('The create route needs a parentEntityType and a parentUnique.');
	}

	if (!kindId) {
		throw new Error('The create route needs a kindId.');
	}

	return {
		parent: { entityType: parentEntityType, unique: parentUnique === 'null' ? null : parentUnique },
		kindId,
	};
}
