import { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import type { FormulateFormFieldModel } from '../../types.js';

/** The field to edit, and the form it is on, for its kind's editor. */
export interface FormulateEditFieldModalData {
	/** The field; the dialog edits a copy of it. */
	field: FormulateFormFieldModel;
	/** Whether the field is being added, so its alias follows its name until it is unlocked. */
	isNew?: boolean;
	/** The form's fields, for kind editors that refer to other fields. */
	formFields: ReadonlyArray<FormulateFormFieldModel>;
	/** The form's ID. */
	formId?: string;
}

/** The edited field. */
export interface FormulateEditFieldModalValue {
	field: FormulateFormFieldModel;
}

export const FORMULATE_EDIT_FIELD_MODAL_ALIAS = 'Formulate.Modal.EditField';

/** Edits a field of a form, as Umbraco's property settings edit a property of a document type. */
export const FORMULATE_EDIT_FIELD_MODAL = new UmbModalToken<FormulateEditFieldModalData, FormulateEditFieldModalValue>(
	FORMULATE_EDIT_FIELD_MODAL_ALIAS,
	{ modal: { type: 'sidebar', size: 'medium' } },
);
