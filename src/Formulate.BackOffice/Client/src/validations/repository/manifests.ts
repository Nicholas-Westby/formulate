import { FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS, FORMULATE_VALIDATION_DETAIL_STORE_ALIAS } from '../../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS,
		name: 'Formulate Validation Detail Repository',
		api: () => import('./validation-detail.repository.js'),
	},
	{
		type: 'store',
		alias: FORMULATE_VALIDATION_DETAIL_STORE_ALIAS,
		name: 'Formulate Validation Detail Store',
		api: () => import('./validation-detail.store.js'),
	},
];
