import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbSubmittableWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { FormulateLayoutWorkspaceContext } from './layout-workspace.context.js';

/** The workspace of a layout, for the elements in it. */
export const FORMULATE_LAYOUT_WORKSPACE_CONTEXT = new UmbContextToken<UmbSubmittableWorkspaceContext, FormulateLayoutWorkspaceContext>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is FormulateLayoutWorkspaceContext =>
		(context as Partial<FormulateLayoutWorkspaceContext>).IS_FORMULATE_LAYOUT_WORKSPACE_CONTEXT === true,
);
