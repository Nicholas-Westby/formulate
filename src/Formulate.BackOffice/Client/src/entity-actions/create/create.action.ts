import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbEntityActionBase, type MetaEntityActionDefaultKind } from '@umbraco-cms/backoffice/entity-action';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import { getFormulateTree } from '../../tree/trees.js';
import { FORMULATE_CREATE_OPTIONS_MODAL } from './create-options-modal.token.js';
import { requestCreateOptions } from './create-options.js';
import { runCreateOption } from './run-create-option.js';

/**
 * Creates something under a tree's root, a folder or a form. The API says what can be created there; the
 * create dialog lists it, unless there is only one option, which runs straight away (as Umbraco's own
 * create action does). The tree's folder is created with Umbraco's folder dialog; any other option opens
 * the workspace of its entity type on the create route, with the option's kind.
 */
export class FormulateCreateEntityAction extends UmbEntityActionBase<MetaEntityActionDefaultKind> {
	override async execute() {
		const parent: UmbEntityModel = { entityType: this.args.entityType, unique: this.args.unique };
		const tree = getFormulateTree(parent.entityType);

		if (!tree) {
			throw new Error(`Nothing can be created under ${parent.entityType}, as it is not in a Formulate tree.`);
		}

		const options = await requestCreateOptions(this, tree, parent);

		if (!options) {
			return;
		}

		const [only] = options;

		if (options.length === 1 && only) {
			await runCreateOption(this, only, tree, parent);
			return;
		}

		// The dialog runs the option picked, as Umbraco's does: it stays open behind the folder dialog, and
		// closes once a folder is created or a kind's link is followed.
		await umbOpenModal(this, FORMULATE_CREATE_OPTIONS_MODAL, { data: { parent, options } }).catch(() => undefined);
	}
}

export { FormulateCreateEntityAction as api };
