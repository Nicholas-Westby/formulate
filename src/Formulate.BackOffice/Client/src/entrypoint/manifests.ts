export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'backofficeEntryPoint',
		alias: 'Formulate.EntryPoint',
		name: 'Formulate Entry Point',
		js: () => import('./entrypoint.js'),
	},
];
