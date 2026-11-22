import { UMB_ACTION_EVENT_CONTEXT } from '@umbraco-cms/backoffice/action';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import {
	UmbEntityActionBase,
	UmbRequestReloadChildrenOfEntityEvent,
	UmbRequestReloadStructureForEntityEvent,
} from '@umbraco-cms/backoffice/entity-action';
import { createExtensionApiByAlias } from '@umbraco-cms/backoffice/extension-registry';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import {
	UMB_TREE_PICKER_MODAL,
	type MetaEntityActionMoveToKind,
	type UmbMoveRepository,
	type UmbTreeRepository,
} from '@umbraco-cms/backoffice/tree';
import { linkEntityExpansionEntries } from '@umbraco-cms/backoffice/utils';
import { getFormulateTree } from '../../tree/trees.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';
import { createMoveTargetFilter } from './move-target-filter.js';

/**
 * Moves a folder, form, validation or data values item to another folder of its tree, or to the top of
 * the tree. Like Umbraco's own move action, it lets the user pick the destination in the tree, with the
 * item's folder open. Unlike it (on Umbraco 17 and 18), it also reloads the destination, so the item
 * shows there straight away; only folders of the item's own tree, outside the item, can be picked.
 */
export class FormulateMoveToEntityAction extends UmbEntityActionBase<MetaEntityActionMoveToKind> {
	override async execute() {
		const { unique, entityType } = this.args;

		if (!unique) {
			throw new Error('An item without a unique cannot be moved.');
		}

		const tree = getFormulateTree(entityType);

		if (!tree) {
			throw new Error(`${entityType} is not in a Formulate tree, so it cannot be moved in one.`);
		}

		const ancestors = await this.#requestAncestors(unique);
		const value = await umbOpenModal(this, UMB_TREE_PICKER_MODAL, {
			data: {
				headline: '#actions_move',
				confirmLabel: '#general_move',
				treeAlias: this.args.meta.treeAlias,
				foldersOnly: this.args.meta.foldersOnly,
				expandTreeRoot: true,
				treeExpansion: ancestors.length ? linkEntityExpansionEntries(ancestors) : undefined,
				pickableFilter: createMoveTargetFilter({ unique, entityType }, tree),
			},
		}).catch(() => undefined);

		// The picker was cancelled.
		if (!value) {
			return;
		}

		const destinationUnique = value.selection[0];

		if (destinationUnique === undefined) {
			throw new Error('No destination was picked.');
		}

		const moveRepository = await createExtensionApiByAlias<UmbMoveRepository>(this, this.args.meta.moveRepositoryAlias);
		const { error } = await moveRepository.requestMoveTo({ unique, destination: { unique: destinationUnique } });

		if (error) {
			throw error;
		}

		await this.#reload({ unique, entityType }, this.#getDestination(tree, destinationUnique));
	}

	/** The folders the item is in, from the top of the tree down, so the picker can open them. */
	async #requestAncestors(unique: string): Promise<Array<UmbEntityModel>> {
		try {
			const treeRepository = await createExtensionApiByAlias<UmbTreeRepository>(
				this,
				this.args.meta.treeRepositoryAlias,
			);
			const { data } = await treeRepository.requestTreeItemAncestors({
				treeItem: { unique, entityType: this.args.entityType },
			});

			// The ancestors end with the item itself, which is not opened.
			return data?.filter((item) => item.unique !== unique) ?? [];
		} catch {
			// Opening the item's folders is a convenience: without them, the picker still works.
			return [];
		}
	}

	#getDestination(tree: FormulateTreeDefinition, unique: string | null): UmbEntityModel {
		return { unique, entityType: unique === null ? tree.rootEntityType : tree.folderEntityType };
	}

	async #reload(moved: UmbEntityModel, destination: UmbEntityModel) {
		const actionEventContext = await this.getContext(UMB_ACTION_EVENT_CONTEXT);

		if (!actionEventContext) {
			throw new Error('The action event context is missing, so the tree cannot be reloaded.');
		}

		// The old parent drops the item, and the destination shows it (with an expand arrow, if it had
		// nothing in it before).
		actionEventContext.dispatchEvent(new UmbRequestReloadStructureForEntityEvent(moved));
		actionEventContext.dispatchEvent(new UmbRequestReloadChildrenOfEntityEvent(destination));
	}
}

export { FormulateMoveToEntityAction as api };
