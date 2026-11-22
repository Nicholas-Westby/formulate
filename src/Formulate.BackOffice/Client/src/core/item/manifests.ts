import { FORMULATE_ITEM_REPOSITORY_ALIAS, FORMULATE_ITEM_STORE_ALIAS } from '../../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_ITEM_REPOSITORY_ALIAS,
		name: 'Formulate Item Repository',
		api: () => import('./item.repository.js'),
	},
	{
		type: 'itemStore',
		alias: FORMULATE_ITEM_STORE_ALIAS,
		name: 'Formulate Item Store',
		api: () => import('./item.store.js'),
	},
];
