import { UMB_ACTION_EVENT_CONTEXT } from '@umbraco-cms/backoffice/action';
import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbEntityDeletedEvent, UmbRequestReloadStructureForEntityEvent } from '@umbraco-cms/backoffice/entity-action';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { UmbApiError } from '@umbraco-cms/backoffice/resources';
import { UMB_ENTITY_DETAIL_WORKSPACE_CONTEXT } from '@umbraco-cms/backoffice/workspace';

/**
 * Whether an error is the API's answer that what was asked for does not exist (a 404).
 * @param error The error a request gave, if any.
 * @returns True for a 404.
 */
export function isNotFoundError(error: unknown): boolean {
	// isUmbApiError reads the error's name, so it needs an error to look at.
	return !!error && UmbApiError.isUmbApiError(error) && error.status === 404;
}

/** How to report an item that is gone. */
export interface FormulateItemGoneOptions {
	/**
	 * Whether the item itself was asked for (read, saved or deleted), so it is gone for good: it is then
	 * announced as deleted (UmbEntityDeletedEvent), and a workspace that shows it leaves, as after a delete.
	 * Such a workspace's unsaved changes are let go first, as there is nothing left to save them to, so it
	 * leaves without asking whether to discard them.
	 */
	deleted?: boolean;
}

/** Finds the contexts a report needs from where it is made, then goes. */
class FormulateItemGoneReport extends UmbControllerBase {}

/**
 * Says that an item no longer exists, as someone deleted it elsewhere, and reloads its structure so the
 * tree drops it. Umbraco shows nothing for a 404 (tryExecute leaves out 401, 403 and 404), so Formulate
 * says it wherever the API cannot find an item the user works on.
 * @param host The controller host, inside the back office.
 * @param item The item that is gone.
 * @param options How to report it.
 */
export async function reportItemGone(
	host: UmbControllerHost,
	item: UmbEntityModel,
	options: FormulateItemGoneOptions = {},
): Promise<void> {
	const report = new FormulateItemGoneReport(host);

	try {
		// getContext rejects when a context is missing, which must not hide the original problem.
		const [notifications, events, workspace] = await Promise.all([
			report.getContext(UMB_NOTIFICATION_CONTEXT).catch(() => undefined),
			report.getContext(UMB_ACTION_EVENT_CONTEXT).catch(() => undefined),
			options.deleted ? report.getContext(UMB_ENTITY_DETAIL_WORKSPACE_CONTEXT).catch(() => undefined) : undefined,
		]);
		const localize = new UmbLocalizationController(report);
		notifications?.peek('warning', { data: { message: localize.term('formulate_itemNotFound') } });
		events?.dispatchEvent(new UmbRequestReloadStructureForEntityEvent({ entityType: item.entityType, unique: item.unique }));

		if (!options.deleted) {
			return;
		}

		// Umbraco asks before leaving a workspace with unsaved changes; these cannot be saved anywhere.
		const showsItem = workspace?.getEntityType() === item.entityType && workspace.getUnique() === item.unique;

		if (workspace && showsItem && workspace.getHasUnpersistedChanges()) {
			workspace.setData(workspace.getPersistedData());
		}

		events?.dispatchEvent(new UmbEntityDeletedEvent({ entityType: item.entityType, unique: item.unique }));
	} finally {
		report.destroy();
	}
}
