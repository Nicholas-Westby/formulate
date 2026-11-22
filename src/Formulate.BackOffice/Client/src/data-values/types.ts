import type { FormulateDataValuesEntityType } from '../constants.js';

/** A data values item (a list of choices), as its workspace edits it. */
export interface FormulateDataValuesDetailModel {
	entityType: FormulateDataValuesEntityType;
	unique: string;
	name: string;
	alias: string | null;
	kindId: string;
	/** Data values of a kind from before Formulate 4 can be read, but not changed. */
	isLegacy: boolean;
	/** The kind's settings. New data values without them get the kind's defaults from the API. */
	configuration?: unknown;
}
