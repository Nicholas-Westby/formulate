import { FORMULATE_EDIT_FIELD_MODAL_ALIAS } from './edit-field/edit-field-modal.token.js';
import { FORMULATE_EDIT_HANDLER_MODAL_ALIAS } from './edit-handler/edit-handler-modal.token.js';
import { FORMULATE_PICK_KIND_MODAL_ALIAS } from './pick-kind/pick-kind-modal.token.js';

/** The dialogs of the form designer. */
export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'modal',
		alias: FORMULATE_PICK_KIND_MODAL_ALIAS,
		name: 'Formulate Pick Kind Modal',
		element: () => import('./pick-kind/pick-kind-modal.element.js'),
	},
	{
		type: 'modal',
		alias: FORMULATE_EDIT_FIELD_MODAL_ALIAS,
		name: 'Formulate Edit Field Modal',
		element: () => import('./edit-field/edit-field-modal.element.js'),
	},
	{
		type: 'modal',
		alias: FORMULATE_EDIT_HANDLER_MODAL_ALIAS,
		name: 'Formulate Edit Handler Modal',
		element: () => import('./edit-handler/edit-handler-modal.element.js'),
	},
];
