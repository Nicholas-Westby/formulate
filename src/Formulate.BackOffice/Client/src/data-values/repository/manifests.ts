import { FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS, FORMULATE_DATA_VALUES_DETAIL_STORE_ALIAS } from '../../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS,
		name: 'Formulate Data Values Detail Repository',
		api: () => import('./data-values-detail.repository.js'),
	},
	{
		type: 'store',
		alias: FORMULATE_DATA_VALUES_DETAIL_STORE_ALIAS,
		name: 'Formulate Data Values Detail Store',
		api: () => import('./data-values-detail.store.js'),
	},
];
