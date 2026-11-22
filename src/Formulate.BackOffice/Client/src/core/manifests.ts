import { FORMULATE_PICK_FIELDS_MODAL_ALIAS } from './pickers/pick-fields-modal.token.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'globalContext',
		alias: 'Formulate.GlobalContext.Definitions',
		name: 'Formulate Definitions Context',
		api: () => import('./definitions.context.js'),
	},
	{
		type: 'modal',
		alias: FORMULATE_PICK_FIELDS_MODAL_ALIAS,
		name: 'Formulate Pick Fields Modal',
		element: () => import('./pickers/pick-fields-modal.element.js'),
	},
];
