import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbCreateFolderEntityAction } from '@umbraco-cms/backoffice/tree';
import type { CreateOptionModel } from '../../api/index.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';
import { isFolderOption } from './create-options.js';
import { getCreatePath } from './create-path.js';

/**
 * Creates what a create option offers under the parent. The tree's folder is created with Umbraco's own
 * folder create action: its folder dialog, then a reload of the parent's children, so the folder (and the
 * parent's expand arrow) shows. A kind opens its workspace on the create route.
 * @param host The controller host.
 * @param option The option, as the API gives it.
 * @param tree The parent's tree.
 * @param parent Where the new item goes: the top of a tree (unique null), a folder, or a form for layouts.
 * @returns Whether it went ahead: false when the folder dialog was cancelled.
 */
export async function runCreateOption(
	host: UmbControllerHost,
	option: CreateOptionModel,
	tree: FormulateTreeDefinition,
	parent: UmbEntityModel,
): Promise<boolean> {
	if (!isFolderOption(option, tree)) {
		history.pushState(null, '', getCreatePath(option, parent));
		return true;
	}

	const action = new UmbCreateFolderEntityAction(host, {
		...parent,
		meta: { folderRepositoryAlias: tree.folderRepositoryAlias, icon: 'icon-folder', label: '#create_folder' },
	});

	try {
		await action.execute();
		return true;
	} catch {
		// The folder dialog was cancelled.
		return false;
	} finally {
		action.destroy();
	}
}
