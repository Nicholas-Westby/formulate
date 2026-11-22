import { FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS, FORMULATE_LAYOUT_DETAIL_STORE_ALIAS } from '../../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS,
		name: 'Formulate Layout Detail Repository',
		api: () => import('./layout-detail.repository.js'),
	},
	{
		type: 'store',
		alias: FORMULATE_LAYOUT_DETAIL_STORE_ALIAS,
		name: 'Formulate Layout Detail Store',
		api: () => import('./layout-detail.store.js'),
	},
];
