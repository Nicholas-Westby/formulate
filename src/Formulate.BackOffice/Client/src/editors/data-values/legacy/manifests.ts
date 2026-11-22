export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'formulateDataValuesEditor',
		alias: 'Formulate.DataValuesEditor.Legacy',
		name: 'Formulate Legacy Data Values Editor',
		element: () => import('./legacy-data-values-editor.element.js'),
		meta: { editorAlias: 'formulate-legacy-data-value' },
	},
];
