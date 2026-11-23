import { UMB_WORKSPACE_CONDITION_ALIAS, type ManifestWorkspaceRoutableKind } from '@umbraco-cms/backoffice/workspace';

/** What one workspace of items with kinds needs. */
export interface FormulateKindItemWorkspace {
	/** The workspace alias, such as Formulate.Workspace.Validation. */
	alias: string;
	/** The name in the aliases of its view and action, such as Validation. */
	name: string;
	/** The name in the names of its manifests, such as Data Values. */
	manifestName: string;
	entityType: string;
	/** Loads the workspace context. */
	api: ManifestWorkspaceRoutableKind['api'];
}

/**
 * The manifests of a validation or data values workspace: the routable workspace, its one Settings view,
 * and Save, as Umbraco's data type workspace has them.
 * @param workspace The workspace.
 * @returns Its manifests.
 */
export function kindItemWorkspaceManifests(workspace: FormulateKindItemWorkspace): Array<UmbExtensionManifest> {
	const inWorkspace = () => [{ alias: UMB_WORKSPACE_CONDITION_ALIAS, match: workspace.alias }];

	return [
		{
			type: 'workspace',
			kind: 'routable',
			alias: workspace.alias,
			name: `Formulate ${workspace.manifestName} Workspace`,
			api: workspace.api,
			meta: { entityType: workspace.entityType },
		},
		{
			type: 'workspaceView',
			alias: `Formulate.WorkspaceView.${workspace.name}.Settings`,
			name: `Formulate ${workspace.manifestName} Settings Workspace View`,
			element: () => import('./kind-item-workspace-view-settings.element.js'),
			meta: { label: '#general_settings', pathname: 'settings', icon: 'icon-settings' },
			conditions: inWorkspace(),
		},
		{
			type: 'workspaceAction',
			kind: 'default',
			alias: `Formulate.WorkspaceAction.${workspace.name}.Save`,
			name: `Save Formulate ${workspace.manifestName} Workspace Action`,
			api: () => import('./kind-item-save.action.js'),
			meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
			conditions: inWorkspace(),
		},
	];
}
