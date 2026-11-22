import { manifests as create } from './create/manifests.js';
import { manifests as deleteActions } from './delete/manifests.js';
import { manifests as duplicate } from './duplicate/manifests.js';
import { manifests as move } from './move/manifests.js';

export const manifests: Array<UmbExtensionManifest> = [...create, ...deleteActions, ...move, ...duplicate];
