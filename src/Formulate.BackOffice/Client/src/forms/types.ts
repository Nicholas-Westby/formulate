import type { FormulateFormEntityType } from '../constants.js';

/**
 * A field of a form, as the form designer holds it: the API's field, with a missing name, alias, label or
 * category read as none (null). Its parts are always in the same order, so a field that comes back from
 * its dialog unchanged is not a change.
 */
export interface FormulateFormFieldModel {
	/** The field's ID, which no other field of the form has. */
	id: string;
	kindId: string;
	name: string | null;
	alias: string | null;
	/** What visitors see; only for kinds that support a label. */
	label: string | null;
	/** One of the field categories in Formulate's configuration; only for kinds that support one. */
	category: string | null;
	/** The IDs of the field's validations, in the order they are checked. */
	validations: Array<string>;
	/** The configuration, exactly as the API gives it; left out when there is none. */
	configuration?: unknown;
}

/** A handler of a form (what is done with a submission), as the form designer holds it. */
export interface FormulateFormHandlerModel {
	/** The handler's ID, which no other handler of the form has. */
	id: string;
	kindId: string;
	name: string | null;
	alias: string | null;
	/** Whether the handler runs when the form is submitted. */
	enabled: boolean;
	/** The configuration, exactly as the API gives it; left out when there is none. */
	configuration?: unknown;
}

/** A form, as its workspace edits it. */
export interface FormulateFormDetailModel {
	entityType: FormulateFormEntityType;
	unique: string;
	name: string;
	alias: string | null;
	/**
	 * The kind a new form is created with (from the create route), such as "Form with Basic Layout". A
	 * form's kind only matters when it is created, so it is null for a form read from the API.
	 */
	kindId: string | null;
	fields: Array<FormulateFormFieldModel>;
	handlers: Array<FormulateFormHandlerModel>;
}
