export const manifests: Array<UmbExtensionManifest> = [
	{
		type: 'localization',
		alias: 'Formulate.Localization.En',
		name: 'Formulate English',
		meta: { culture: 'en' },
		js: () => import('./en.js'),
	},
];
