import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { Observable } from '@umbraco-cms/backoffice/external/rxjs';
import type { UmbGuardRule, UmbReadOnlyGuardManager } from '@umbraco-cms/backoffice/utils';
import type { UmbSubmittableWorkspaceContext } from '@umbraco-cms/backoffice/workspace';

/**
 * A workspace of an item with a name and an alias, such as a validation, data values or a form: what its
 * header shows and changes.
 */
export interface FormulateAliasedWorkspaceContext extends UmbSubmittableWorkspaceContext {
	readonly IS_FORMULATE_ALIASED_WORKSPACE_CONTEXT: true;
	readonly name: Observable<string | undefined>;
	readonly alias: Observable<string | null | undefined>;
	readonly isNew: Observable<boolean | undefined>;
	/** Rules that make the item read-only, when the workspace has any. */
	readonly readOnlyGuard?: UmbReadOnlyGuardManager<UmbGuardRule>;
	setName(name: string): void;
	setAlias(alias: string | null | undefined): void;
}

/** The workspace of an item with a name and an alias, for its header. */
export const FORMULATE_ALIASED_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbSubmittableWorkspaceContext,
	FormulateAliasedWorkspaceContext
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is FormulateAliasedWorkspaceContext =>
		(context as Partial<FormulateAliasedWorkspaceContext>).IS_FORMULATE_ALIASED_WORKSPACE_CONTEXT === true,
);
