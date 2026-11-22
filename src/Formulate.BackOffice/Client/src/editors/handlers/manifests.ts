import { FORMULATE_HANDLER_EDITOR_TYPE } from '../../core/kind-editor.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: FORMULATE_HANDLER_EDITOR_TYPE,
		alias: 'Formulate.HandlerEditor.StoreData',
		name: 'Formulate Store Data Handler Editor',
		element: () => import('./store-data/store-data-handler-editor.element.js'),
		meta: { editorAlias: 'formulate-store-data-handler' },
	},
];
