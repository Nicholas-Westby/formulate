import { FORMULATE_HANDLER_EDITOR_TYPE } from '../../core/kind-editor.js';

export const manifests: Array<UmbExtensionManifest> = [
	{
		type: FORMULATE_HANDLER_EDITOR_TYPE,
		alias: 'Formulate.HandlerEditor.StoreData',
		name: 'Formulate Store Data Handler Editor',
		element: () => import('./store-data/store-data-handler-editor.element.js'),
		meta: { editorAlias: 'formulate-store-data-handler' },
	},
	{
		type: FORMULATE_HANDLER_EDITOR_TYPE,
		alias: 'Formulate.HandlerEditor.SendEmail',
		name: 'Formulate Email Handler Editor',
		element: () => import('./email/send-email-handler-editor.element.js'),
		meta: { editorAlias: 'formulate-send-email-handler' },
	},
	{
		type: FORMULATE_HANDLER_EDITOR_TYPE,
		alias: 'Formulate.HandlerEditor.DesignedEmail',
		name: 'Formulate Designed Email Handler Editor',
		element: () => import('./email/designed-email-handler-editor.element.js'),
		meta: { editorAlias: 'formulate-designed-email-handler' },
	},
];
