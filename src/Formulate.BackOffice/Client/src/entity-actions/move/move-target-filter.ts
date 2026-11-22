import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import type { FormulateTreeDefinition } from '../../tree/types.js';

/**
 * Decides which items of the move dialog's tree an item can be moved to: the top of its own tree, or
 * one of that tree's folders, except the item itself and any folder inside it.
 *
 * Tree items only know their parent, so the filter remembers the folders it has found inside the item.
 * That is enough, because the dialog shows a folder only once its parent is open, so a parent is
 * always checked before its children. (The API refuses such a move too.)
 * @param moved The item being moved.
 * @param tree The tree the item is in.
 * @returns A filter for the dialog: true when the item can be moved there.
 */
export function createMoveTargetFilter(
	moved: UmbEntityModel,
	tree: FormulateTreeDefinition,
): (item: UmbTreeItemModel | UmbTreeRootModel) => boolean {
	const inside = new Set<string>();

	if (moved.unique !== null) {
		inside.add(moved.unique);
	}

	return (item) => {
		if (item.unique === null) {
			return item.entityType === tree.rootEntityType;
		}

		if (item.entityType !== tree.folderEntityType) {
			return false;
		}

		const parentUnique = 'parent' in item ? (item.parent?.unique ?? null) : null;

		if (inside.has(item.unique) || (parentUnique !== null && inside.has(parentUnique))) {
			inside.add(item.unique);
			return false;
		}

		return true;
	};
}
