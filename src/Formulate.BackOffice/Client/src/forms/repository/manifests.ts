import { FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS, FORMULATE_FORM_DETAIL_STORE_ALIAS } from '../../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS,
		name: 'Formulate Form Detail Repository',
		api: () => import('./form-detail.repository.js'),
	},
	{
		type: 'store',
		alias: FORMULATE_FORM_DETAIL_STORE_ALIAS,
		name: 'Formulate Form Detail Store',
		api: () => import('./form-detail.store.js'),
	},
];
