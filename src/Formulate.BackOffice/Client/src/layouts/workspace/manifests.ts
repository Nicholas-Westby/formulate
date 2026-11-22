import { UMB_WORKSPACE_CONDITION_ALIAS } from '@umbraco-cms/backoffice/workspace';
import { FORMULATE_LAYOUT_ENTITY_TYPE, FORMULATE_LAYOUT_WORKSPACE_ALIAS } from '../../constants.js';

const inWorkspace = () => [{ alias: UMB_WORKSPACE_CONDITION_ALIAS, match: FORMULATE_LAYOUT_WORKSPACE_ALIAS }];

// The layout workspace: one Design view, with the template and the kind's editor, and Save.
export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'workspace',
		kind: 'routable',
		alias: FORMULATE_LAYOUT_WORKSPACE_ALIAS,
		name: 'Formulate Layout Workspace',
		api: () => import('./layout-workspace.context.js'),
		meta: { entityType: FORMULATE_LAYOUT_ENTITY_TYPE },
	},
	{
		type: 'workspaceView',
		alias: 'Formulate.WorkspaceView.Layout.Design',
		name: 'Formulate Layout Design Workspace View',
		element: () => import('./views/layout-workspace-view-design.element.js'),
		meta: { label: '#general_design', pathname: 'design', icon: 'icon-layout' },
		conditions: inWorkspace(),
	},
	{
		type: 'workspaceAction',
		kind: 'default',
		alias: 'Formulate.WorkspaceAction.Layout.Save',
		name: 'Save Formulate Layout Workspace Action',
		api: () => import('../../core/kind-item/kind-item-save.action.js'),
		meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
		conditions: inWorkspace(),
	},
];
