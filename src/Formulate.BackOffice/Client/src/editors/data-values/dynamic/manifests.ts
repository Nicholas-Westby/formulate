export const manifests: Array<UmbExtensionManifest> = [
	{
		// The editor alias of data values whose items Formulate makes itself, such as the US states.
		type: 'formulateDataValuesEditor',
		alias: 'Formulate.DataValuesEditor.Dynamic',
		name: 'Formulate Dynamic Data Values Editor',
		element: () => import('./dynamic-data-values-editor.element.js'),
		meta: { editorAlias: 'formulate-dynamic-data-values' },
	},
];
