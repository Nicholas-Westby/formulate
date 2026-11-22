import {
	FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_DATA_VALUES_ENTITY_TYPE,
	FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_FORM_ENTITY_TYPE,
	FORMULATE_ITEM_REPOSITORY_ALIAS,
	FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_LAYOUT_ENTITY_TYPE,
	FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_VALIDATION_ENTITY_TYPE,
} from '../../constants.js';

// Umbraco's delete kind, with Formulate's action: it confirms with the item's name and deletes it through
// the detail repository, says when the item no longer exists, and reloads the parent's children.
// (Folders are deleted by the folder actions, with the same action.)
const deleteAction = () => import('./delete.action.js');

const deleteActions: Array<UmbExtensionManifest> = [
	{
		type: 'entityAction',
		kind: 'delete',
		alias: 'Formulate.EntityAction.Form.Delete',
		name: 'Delete Formulate Form Entity Action',
		api: deleteAction,
		forEntityTypes: [FORMULATE_FORM_ENTITY_TYPE],
		meta: {
			detailRepositoryAlias: FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS,
			itemRepositoryAlias: FORMULATE_ITEM_REPOSITORY_ALIAS,
			// Deleting a form deletes its layouts.
			confirm: { message: '#formulate_confirmDeleteForm' },
		},
	},
	{
		type: 'entityAction',
		kind: 'delete',
		alias: 'Formulate.EntityAction.Layout.Delete',
		name: 'Delete Formulate Layout Entity Action',
		api: deleteAction,
		forEntityTypes: [FORMULATE_LAYOUT_ENTITY_TYPE],
		meta: {
			detailRepositoryAlias: FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS,
			itemRepositoryAlias: FORMULATE_ITEM_REPOSITORY_ALIAS,
		},
	},
	{
		type: 'entityAction',
		kind: 'delete',
		alias: 'Formulate.EntityAction.Validation.Delete',
		name: 'Delete Formulate Validation Entity Action',
		api: deleteAction,
		forEntityTypes: [FORMULATE_VALIDATION_ENTITY_TYPE],
		meta: {
			detailRepositoryAlias: FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS,
			itemRepositoryAlias: FORMULATE_ITEM_REPOSITORY_ALIAS,
		},
	},
	{
		type: 'entityAction',
		kind: 'delete',
		alias: 'Formulate.EntityAction.DataValues.Delete',
		name: 'Delete Formulate Data Values Entity Action',
		api: deleteAction,
		forEntityTypes: [FORMULATE_DATA_VALUES_ENTITY_TYPE],
		meta: {
			detailRepositoryAlias: FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS,
			itemRepositoryAlias: FORMULATE_ITEM_REPOSITORY_ALIAS,
		},
	},
];

export const manifests: Array<UmbExtensionManifest> = [
	...deleteActions,
	{
		// Leaves a workspace whose item was deleted, also when it went with its folder or form.
		type: 'globalContext',
		alias: 'Formulate.GlobalContext.DeletedItemRedirect',
		name: 'Formulate Deleted Item Redirect',
		api: () => import('./deleted-item-redirect.js'),
	},
];
