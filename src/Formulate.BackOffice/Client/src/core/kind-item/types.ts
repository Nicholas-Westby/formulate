/**
 * An item that has a kind and a configuration its kind reads, such as a validation or data values: what
 * the workspace of such an item edits.
 */
export interface FormulateKindItemDetailModel {
	entityType: string;
	unique: string;
	name: string;
	alias: string | null;
	kindId: string;
	/** The configuration, exactly as the API stores it; left out when there is none. */
	configuration?: unknown;
	/** True for an item of a legacy kind, which can no longer be changed. */
	isLegacy?: boolean;
}
