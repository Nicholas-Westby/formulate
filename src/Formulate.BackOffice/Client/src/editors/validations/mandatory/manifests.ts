export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'formulateValidationEditor',
		alias: 'Formulate.ValidationEditor.Mandatory',
		name: 'Formulate Mandatory Validation Editor',
		element: () => import('./mandatory-validation-editor.element.js'),
		meta: { editorAlias: 'formulate-mandatory-validation' },
	},
];
