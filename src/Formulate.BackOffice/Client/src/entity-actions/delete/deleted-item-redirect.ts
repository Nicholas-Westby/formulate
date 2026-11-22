import { UMB_ACTION_EVENT_CONTEXT, type UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbEntityDeletedEvent } from '@umbraco-cms/backoffice/entity-action';
import { UMB_SECTION_PATH_PATTERN } from '@umbraco-cms/backoffice/section';
import { FORMULATE_SECTION_PATHNAME } from '../../constants.js';
import { FormulateItemServerDataSource } from '../../core/item/item.server.data-source.js';
import { getFormulateTree } from '../../tree/trees.js';

/**
 * A Formulate workspace path: an item open on Umbraco's edit route (as tree items link to it), or a new
 * item on the create route, which names the parent it goes in.
 */
const WORKSPACE_PATH = new RegExp(
	`/section/${FORMULATE_SECTION_PATHNAME}/workspace/([^/]+)/(?:edit/([^/]+)|create/parent/([^/]+)/([^/]+)/)`,
);

/**
 * The items a Formulate workspace path needs: the item open in the workspace, or the folder or form a new
 * item is being created in.
 * @param pathname The location's path, such as /umbraco/section/formulate/workspace/formulate-form/edit/{id}.
 * @returns The items; none outside Formulate's workspaces, or for a new item at the top of a tree.
 */
export function getOpenFormulateItems(pathname: string): Array<UmbEntityModel> {
	const match = WORKSPACE_PATH.exec(pathname);

	if (!match) {
		return [];
	}

	const [, entityType, unique, parentEntityType, parentUnique] = match;

	if (unique) {
		return [{ entityType, unique: decodeURIComponent(unique) }];
	}

	return parentUnique && parentUnique !== 'null'
		? [{ entityType: parentEntityType, unique: decodeURIComponent(parentUnique) }]
		: [];
}

/**
 * Leaves a Formulate workspace for the section's start when what it shows has been deleted: the open item
 * itself, or the folder or form it was in, as deleting a folder deletes everything in it and deleting a
 * form deletes its layouts. The same goes for a new item whose folder or form is deleted.
 * Runs for the whole back office (Formulate.GlobalContext.DeletedItemRedirect).
 */
export class FormulateDeletedItemRedirectController extends UmbControllerBase {
	#actionEventContext?: UmbActionEventContext;
	#itemSource = new FormulateItemServerDataSource(this);

	constructor(host: UmbControllerHost) {
		super(host);

		this.consumeContext(UMB_ACTION_EVENT_CONTEXT, (context) => {
			this.#actionEventContext?.removeEventListener(UmbEntityDeletedEvent.TYPE, this.#onDeleted);
			this.#actionEventContext = context;
			this.#actionEventContext?.addEventListener(UmbEntityDeletedEvent.TYPE, this.#onDeleted);
		});
	}

	#onDeleted = async (event: Event) => {
		const deleted = event as UmbEntityDeletedEvent;

		if (!getFormulateTree(deleted.getEntityType())) {
			return;
		}

		const pathname = window.location.pathname;
		const open = getOpenFormulateItems(pathname);

		if (!open.length || !(await this.#isAnyGone(open, deleted.getUnique()))) {
			return;
		}

		// Leave the location alone if the user went elsewhere while the API was asked.
		if (window.location.pathname === pathname) {
			// The workspace's own URL is gone for good, so it is replaced, as Umbraco does after a delete.
			history.replaceState(null, '', UMB_SECTION_PATH_PATTERN.generateAbsolute({ sectionName: FORMULATE_SECTION_PATHNAME }));
		}
	};

	async #isAnyGone(open: Array<UmbEntityModel>, deletedUnique: string | null) {
		const uniques = open.map((item) => item.unique?.toLowerCase() ?? '');

		if (deletedUnique && uniques.includes(deletedUnique.toLowerCase())) {
			return true;
		}

		// Something the open items were in may have been deleted. Ask which of them still exist.
		const { data } = await this.#itemSource.getItems(uniques);

		if (!data) {
			return false;
		}

		const found = data.map((item) => item.unique.toLowerCase());

		return uniques.some((unique) => !found.includes(unique));
	}

	override destroy() {
		this.#actionEventContext?.removeEventListener(UmbEntityDeletedEvent.TYPE, this.#onDeleted);
		super.destroy();
	}
}

export { FormulateDeletedItemRedirectController as api };
