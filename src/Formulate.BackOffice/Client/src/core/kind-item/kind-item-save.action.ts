import { UmbSubmitWorkspaceAction } from '@umbraco-cms/backoffice/workspace';
import type { FormulateKindItemWorkspaceContext } from './kind-item-workspace.context.js';

/**
 * Umbraco's Save, which stays disabled while the item is read-only, such as legacy data values. (Umbraco 19's
 * Save reads the workspace's read-only rules itself; Umbraco 17 and 18 enable Save once an item is loaded.)
 */
export class FormulateKindItemSaveWorkspaceAction extends UmbSubmitWorkspaceAction {
	#readOnly = false;

	protected override _gotWorkspaceContext() {
		super._gotWorkspaceContext();

		const context = this._workspaceContext as Partial<FormulateKindItemWorkspaceContext> | undefined;

		this.observe(
			context?.readOnlyGuard?.permitted,
			(readOnly) => {
				this.#readOnly = readOnly === true;

				if (this.#readOnly) {
					this.disable();
				} else if (this._workspaceContext?.getUnique() !== undefined) {
					super.enable();
				}
			},
			'_formulateObserveReadOnly',
		);
	}

	/** Umbraco enables Save once the item is loaded, which must not happen to a read-only item. */
	override enable() {
		if (!this.#readOnly) {
			super.enable();
		}
	}
}

export { FormulateKindItemSaveWorkspaceAction as api };
