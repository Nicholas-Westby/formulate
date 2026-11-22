import { UMB_WORKSPACE_CONDITION_ALIAS } from '@umbraco-cms/backoffice/workspace';
import { FORMULATE_FORM_ENTITY_TYPE, FORMULATE_FORM_WORKSPACE_ALIAS } from '../../constants.js';

const inWorkspace = () => [{ alias: UMB_WORKSPACE_CONDITION_ALIAS, match: FORMULATE_FORM_WORKSPACE_ALIAS }];

/** The form workspace (the form designer): its Fields and Handlers views, and Save. */
export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'workspace',
		kind: 'routable',
		alias: FORMULATE_FORM_WORKSPACE_ALIAS,
		name: 'Formulate Form Workspace',
		api: () => import('./form-workspace.context.js'),
		meta: { entityType: FORMULATE_FORM_ENTITY_TYPE },
	},
	{
		type: 'workspaceView',
		alias: 'Formulate.WorkspaceView.Form.Fields',
		name: 'Formulate Form Fields Workspace View',
		element: () => import('./views/form-fields-workspace-view.element.js'),
		// The first view, which the workspace opens on.
		weight: 200,
		meta: { label: '#formulate_fields', pathname: 'fields', icon: 'icon-thumbnail-list' },
		conditions: inWorkspace(),
	},
	{
		type: 'workspaceView',
		alias: 'Formulate.WorkspaceView.Form.Handlers',
		name: 'Formulate Form Handlers Workspace View',
		element: () => import('./views/form-handlers-workspace-view.element.js'),
		weight: 100,
		meta: { label: '#formulate_handlers', pathname: 'handlers', icon: 'icon-lightning' },
		conditions: inWorkspace(),
	},
	{
		type: 'workspaceAction',
		kind: 'default',
		alias: 'Formulate.WorkspaceAction.Form.Save',
		name: 'Save Formulate Form Workspace Action',
		api: () => import('../../core/kind-item/kind-item-save.action.js'),
		meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
		conditions: inWorkspace(),
	},
];
