import { FORMULATE_VALIDATION_ENTITY_TYPE, FORMULATE_VALIDATION_WORKSPACE_ALIAS } from '../../constants.js';
import { kindItemWorkspaceManifests } from '../../core/kind-item/manifests.js';

export const manifests: Array<UmbExtensionManifest> = kindItemWorkspaceManifests({
	alias: FORMULATE_VALIDATION_WORKSPACE_ALIAS,
	name: 'Validation',
	label: 'Validation',
	entityType: FORMULATE_VALIDATION_ENTITY_TYPE,
	api: () => import('./validation-workspace.context.js'),
});
