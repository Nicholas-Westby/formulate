import { manifests as item } from './core/item/manifests.js';
import { manifests as core } from './core/manifests.js';
import { manifests as dataValues } from './data-values/repository/manifests.js';
import { manifests as dataValuesWorkspace } from './data-values/workspace/manifests.js';
import { manifests as editors } from './editors/manifests.js';
import { manifests as entityActions } from './entity-actions/manifests.js';
import { manifests as entrypoint } from './entrypoint/manifests.js';
import { manifests as folders } from './folders/manifests.js';
import { manifests as formModals } from './forms/modals/manifests.js';
import { manifests as forms } from './forms/repository/manifests.js';
import { manifests as formWorkspace } from './forms/workspace/manifests.js';
import { manifests as layouts } from './layouts/repository/manifests.js';
import { manifests as layoutWorkspace } from './layouts/workspace/manifests.js';
import { manifests as localization } from './localization/manifests.js';
import { manifests as formLayoutPicker } from './property-editors/form-layout-picker/manifests.js';
import { manifests as section } from './section/manifests.js';
import { manifests as tree } from './tree/manifests.js';
import { manifests as validations } from './validations/repository/manifests.js';
import { manifests as validationWorkspace } from './validations/workspace/manifests.js';

// Umbraco loads this bundle through public/umbraco-package.json and registers every manifest in it.
export const manifests: Array<UmbExtensionManifest> = [
	...entrypoint,
	...localization,
	...core,
	...item,
	...section,
	...tree,
	...folders,
	...forms,
	...formWorkspace,
	...formModals,
	...layouts,
	...layoutWorkspace,
	...validations,
	...validationWorkspace,
	...dataValues,
	...dataValuesWorkspace,
	...editors,
	...entityActions,
	...formLayoutPicker,
];
