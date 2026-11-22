export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'formulateDataValuesEditor',
		alias: 'Formulate.DataValuesEditor.List',
		name: 'Formulate List Data Values Editor',
		element: () => import('./list-data-values-editor.element.js'),
		meta: { editorAlias: 'formulate-list-data-values' },
	},
];
