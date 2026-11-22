import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbSubmittableWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { FormulateKindItemWorkspaceContext } from './kind-item-workspace.context.js';

/** The workspace of a validation or data values item, for the elements in it. */
export const FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbSubmittableWorkspaceContext,
	FormulateKindItemWorkspaceContext
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is FormulateKindItemWorkspaceContext =>
		(context as Partial<FormulateKindItemWorkspaceContext>).IS_FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT === true,
);
