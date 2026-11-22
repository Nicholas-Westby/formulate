import type { FormulateValidationEntityType } from '../constants.js';

/** A validation, as its workspace edits it. */
export interface FormulateValidationDetailModel {
	entityType: FormulateValidationEntityType;
	unique: string;
	name: string;
	alias: string | null;
	kindId: string;
	/** The kind's settings. A new validation without them gets the kind's defaults from the API. */
	configuration?: unknown;
}
