export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'formulateLayoutEditor',
		alias: 'Formulate.LayoutEditor.Basic',
		name: 'Formulate Basic Layout Editor',
		element: () => import('./basic-layout.element.js'),
		meta: { editorAlias: 'formulate-layout-basic' },
	},
];
