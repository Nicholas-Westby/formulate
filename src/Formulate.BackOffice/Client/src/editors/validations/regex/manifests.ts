export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'formulateValidationEditor',
		alias: 'Formulate.ValidationEditor.Regex',
		name: 'Formulate Regular Expression Validation Editor',
		element: () => import('./regex-validation-editor.element.js'),
		meta: { editorAlias: 'formulate-regex-validation' },
	},
];
