export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'propertyEditorUi',
		alias: 'Formulate.PropertyEditorUi.FormLayoutPicker',
		name: 'Formulate Form Layout Picker Property Editor UI',
		element: () => import('./form-layout-picker.element.js'),
		meta: {
			label: 'Formulate Form Layout Picker',
			propertyEditorSchemaAlias: 'Formulate.FormLayoutPicker',
			icon: 'icon-layout',
			group: 'pickers',
		},
	},
];
