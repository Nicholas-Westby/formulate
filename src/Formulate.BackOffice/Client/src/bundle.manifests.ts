import { manifests as core } from './core/manifests.js';
import { manifests as entrypoint } from './entrypoint/manifests.js';
import { manifests as localization } from './localization/manifests.js';
import { manifests as section } from './section/manifests.js';
import { manifests as tree } from './tree/manifests.js';

// Umbraco loads this bundle through public/umbraco-package.json and registers every manifest in it.
export const manifests: Array<UmbExtensionManifest> = [
	...entrypoint,
	...localization,
	...core,
	...section,
	...tree,
];
