import type { UmbClassInterface } from '@umbraco-cms/backoffice/class-api';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { getFormulateTreeByTreeAliasCreateOptions, type CreateOptionModel } from '../../api/index.js';
import { isNotFoundError, reportItemGone } from '../../core/item-gone.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';

/**
 * Whether a create option is the tree's folder, which Umbraco's folder dialog creates, rather than a kind
 * of item, which its workspace creates.
 * @param option The option, as the API gives it.
 * @param tree The tree the option is for.
 * @returns True for the folder option.
 */
export function isFolderOption(option: CreateOptionModel, tree: FormulateTreeDefinition): boolean {
	return option.entityType === tree.folderEntityType;
}

/**
 * Asks the API what can be created under a parent: a folder and the kinds of items at the top of a tree
 * or in a folder, and the layout kinds under a form. The folder comes last, as in Umbraco's own create
 * dialog; the kinds keep the API's order.
 *
 * tryExecute shows the user a problem the API reports, except 401, 403 and 404. A 404 means the parent was
 * deleted elsewhere: this warns that it no longer exists and reloads its structure, so it leaves the tree.
 * @param host The controller host.
 * @param tree The parent's tree.
 * @param parent The folder or form to create in, or the tree's root (unique null).
 * @returns The options, or undefined when they could not be read.
 */
export async function requestCreateOptions(
	host: UmbClassInterface,
	tree: FormulateTreeDefinition,
	parent: UmbEntityModel,
): Promise<Array<CreateOptionModel> | undefined> {
	// The top of a tree is not an item, so it is asked for without a parent ID.
	const { data, error } = await tryExecute(
		host,
		getFormulateTreeByTreeAliasCreateOptions({
			path: { treeAlias: tree.apiAlias },
			query: parent.unique ? { parentId: parent.unique } : undefined,
		}),
	);

	if (isNotFoundError(error)) {
		await reportItemGone(host, parent);
		return undefined;
	}

	// A stable sort: only the folder moves.
	return data && [...data].sort((a, b) => Number(isFolderOption(a, tree)) - Number(isFolderOption(b, tree)));
}

/** How a create option is shown: its name (text, or a localization key starting with #), description and icon. */
export interface FormulateCreateOptionDescription {
	name: string;
	description?: string;
	icon: string;
}

/**
 * Describes a create option for the create dialog. The tree's folder uses Umbraco's own "Folder" text, as
 * the API's name for it is not translated; a kind uses the name its definition gives.
 * @param option The option, as the API gives it.
 * @param tree The tree the option is for.
 * @returns The name, description and icon to show.
 */
export function describeCreateOption(
	option: CreateOptionModel,
	tree: FormulateTreeDefinition,
): FormulateCreateOptionDescription {
	return {
		name: isFolderOption(option, tree) ? '#create_folder' : option.name,
		description: option.description ?? undefined,
		icon: option.icon,
	};
}
