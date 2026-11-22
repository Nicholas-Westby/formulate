import type { FormulateLayoutEntityType } from '../constants.js';

/** A layout, as its workspace edits it. */
export interface FormulateLayoutDetailModel {
	entityType: FormulateLayoutEntityType;
	unique: string;
	name: string;
	alias: string | null;
	/** The form the layout belongs to. A new layout gets it when it is created under the form. */
	formUnique: string | null;
	kindId: string;
	templateId: string | null;
	configuration?: unknown;
}
