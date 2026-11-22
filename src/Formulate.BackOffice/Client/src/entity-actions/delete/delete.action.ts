import { UMB_ACTION_EVENT_CONTEXT } from '@umbraco-cms/backoffice/action';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import {
	UmbDeleteEntityAction,
	UmbRequestReloadChildrenOfEntityEvent,
	type MetaEntityActionDeleteKind,
} from '@umbraco-cms/backoffice/entity-action';
import { createExtensionApiByAlias } from '@umbraco-cms/backoffice/extension-registry';
import type { UmbItemRepository } from '@umbraco-cms/backoffice/repository';
import { isNotFoundError, reportItemGone } from '../../core/item-gone.js';
import type { FormulateItemModel } from '../../core/item/types.js';

/**
 * Umbraco's delete action for Formulate items and folders: it confirms with the item's name, deletes it
 * through the detail repository and says so. Unlike it, this says when the item no longer exists, as
 * someone deleted it elsewhere (Umbraco's action only throws "Item not found."), and announces it as
 * deleted, and it reloads the parent's children after the delete, so a parent left empty loses its expand
 * arrow even while it is collapsed.
 */
export class FormulateDeleteEntityAction extends UmbDeleteEntityAction<MetaEntityActionDeleteKind> {
	override async execute() {
		const unique = this.args.unique;

		if (!unique) {
			throw new Error('Cannot delete an item without a unique identifier.');
		}

		const { item, error } = await this.#requestItem(unique);

		// When the item cannot be read at all, Umbraco's action reports the problem as it does. When it is gone,
		// it is as good as deleted: a workspace that shows it leaves.
		if (!error && !item) {
			await reportItemGone(this, { entityType: this.args.entityType, unique }, { deleted: true });
			return;
		}

		try {
			await super.execute();
		} catch (deleteError) {
			// Deleted elsewhere while the dialog was open: the data source has said so and dropped it.
			if (isNotFoundError(deleteError)) {
				return;
			}

			throw deleteError;
		}

		if (item) {
			await this.#reloadChildrenOf(item.parent);
		}
	}

	async #requestItem(unique: string) {
		const repository = await createExtensionApiByAlias<UmbItemRepository<FormulateItemModel>>(
			this,
			this.args.meta.itemRepositoryAlias,
		);
		const { data, error } = await repository.requestItems([unique]);

		return { item: data?.find((candidate) => candidate.unique === unique), error };
	}

	async #reloadChildrenOf(parent: UmbEntityModel) {
		const events = await this.getContext(UMB_ACTION_EVENT_CONTEXT);
		events?.dispatchEvent(new UmbRequestReloadChildrenOfEntityEvent(parent));
	}
}

export { FormulateDeleteEntityAction as api };
