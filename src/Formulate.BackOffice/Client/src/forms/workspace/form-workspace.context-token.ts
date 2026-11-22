import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbSubmittableWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { FormulateFormWorkspaceContext } from './form-workspace.context.js';

/** The workspace of a form, for the elements in it: its views and their dialogs. */
export const FORMULATE_FORM_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbSubmittableWorkspaceContext,
	FormulateFormWorkspaceContext
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is FormulateFormWorkspaceContext =>
		(context as Partial<FormulateFormWorkspaceContext>).IS_FORMULATE_FORM_WORKSPACE_CONTEXT === true,
);
