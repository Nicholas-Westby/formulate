export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'formulateDataValuesEditor',
		alias: 'Formulate.DataValuesEditor.PairList',
		name: 'Formulate Pair List Data Values Editor',
		element: () => import('./pair-list-data-values-editor.element.js'),
		meta: { editorAlias: 'formulate-data-value-pair-list' },
	},
];
