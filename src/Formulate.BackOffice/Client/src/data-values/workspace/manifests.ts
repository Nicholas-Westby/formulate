import { FORMULATE_DATA_VALUES_ENTITY_TYPE, FORMULATE_DATA_VALUES_WORKSPACE_ALIAS } from '../../constants.js';
import { kindItemWorkspaceManifests } from '../../core/kind-item/manifests.js';

export const manifests: Array<UmbExtensionManifest> = kindItemWorkspaceManifests({
	alias: FORMULATE_DATA_VALUES_WORKSPACE_ALIAS,
	name: 'DataValues',
	label: 'Data Values',
	entityType: FORMULATE_DATA_VALUES_ENTITY_TYPE,
	api: () => import('./data-values-workspace.context.js'),
});
