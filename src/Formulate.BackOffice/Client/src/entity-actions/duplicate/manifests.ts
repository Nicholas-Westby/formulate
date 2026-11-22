import {
	FORMULATE_FORM_DUPLICATE_REPOSITORY_ALIAS,
	FORMULATE_FORM_ENTITY_TYPE,
	FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
} from '../../constants.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'repository',
		alias: FORMULATE_FORM_DUPLICATE_REPOSITORY_ALIAS,
		name: 'Formulate Form Duplicate Repository',
		api: () => import('./duplicate.repository.js'),
	},
	{
		// Umbraco's own duplicate action: it copies the form through the repository, then reloads the
		// original's parent, which shows the copy.
		type: 'entityAction',
		kind: 'duplicate',
		alias: 'Formulate.EntityAction.Form.Duplicate',
		name: 'Duplicate Formulate Form Entity Action',
		forEntityTypes: [FORMULATE_FORM_ENTITY_TYPE],
		meta: {
			duplicateRepositoryAlias: FORMULATE_FORM_DUPLICATE_REPOSITORY_ALIAS,
			treeRepositoryAlias: FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
		},
	},
];
