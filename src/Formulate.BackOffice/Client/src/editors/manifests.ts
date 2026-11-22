import { manifests as dynamic } from './data-values/dynamic/manifests.js';
import { manifests as legacy } from './data-values/legacy/manifests.js';
import { manifests as list } from './data-values/list/manifests.js';
import { manifests as pairList } from './data-values/pair-list/manifests.js';
import { manifests as fields } from './fields/manifests.js';
import { manifests as handlers } from './handlers/manifests.js';
import { manifests as basicLayout } from './layouts/basic/manifests.js';
import { manifests as mandatory } from './validations/mandatory/manifests.js';
import { manifests as regex } from './validations/regex/manifests.js';

// The editors of Formulate's own kinds. Each is found by the editor alias its server definition gives.
export const manifests: Array<UmbExtensionManifest> = [
	...mandatory,
	...regex,
	...list,
	...pairList,
	...dynamic,
	...legacy,
	...fields,
	...handlers,
	...basicLayout,
];
