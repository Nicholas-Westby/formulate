export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'globalContext',
		alias: 'Formulate.GlobalContext.Definitions',
		name: 'Formulate Definitions Context',
		api: () => import('./definitions.context.js'),
	},
];
