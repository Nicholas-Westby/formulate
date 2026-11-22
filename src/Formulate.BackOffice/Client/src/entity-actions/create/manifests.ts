import { FORMULATE_FORM_ENTITY_TYPE } from '../../constants.js';
import { FORMULATE_TREES } from '../../tree/trees.js';
import { FORMULATE_CREATE_OPTIONS_MODAL_ALIAS } from './create-options-modal.token.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		// Umbraco's create action kind (its label, icon and place in the menu), with Formulate's own action,
		// which asks the API what can be created.
		type: 'entityAction',
		kind: 'create',
		alias: 'Formulate.EntityAction.Create',
		name: 'Create Formulate Item Entity Action',
		api: () => import('./create.action.js'),
		forEntityTypes: [
			...FORMULATE_TREES.flatMap((tree) => [tree.rootEntityType, tree.folderEntityType]),
			// A form's layouts are created under it.
			FORMULATE_FORM_ENTITY_TYPE,
		],
	},
	{
		type: 'modal',
		alias: FORMULATE_CREATE_OPTIONS_MODAL_ALIAS,
		name: 'Formulate Create Options Modal',
		element: () => import('./create-options-modal.element.js'),
	},
];
