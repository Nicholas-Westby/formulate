import type { FormFieldModel, FormHandlerModel } from '../api/index.js';
import type { FormulateFormEntityType } from '../constants.js';

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
	fields: Array<FormFieldModel>;
	handlers: Array<FormHandlerModel>;
}
