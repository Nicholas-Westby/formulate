import { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import type { FormulateFormFieldModel, FormulateFormHandlerModel } from '../../types.js';

/** The handler to edit, and the form it is on, for its kind's editor. */
export interface FormulateEditHandlerModalData {
	/** The handler; the dialog edits a copy of it. */
	handler: FormulateFormHandlerModel;
	/** Whether the handler is being added, so its alias follows its name until it is unlocked. */
	isNew?: boolean;
	/** The form's fields, for kind editors that use them, such as the fields an email includes. */
	formFields: ReadonlyArray<FormulateFormFieldModel>;
	/** The form's ID. */
	formId?: string;
}

/** The edited handler. */
export interface FormulateEditHandlerModalValue {
	handler: FormulateFormHandlerModel;
}

export const FORMULATE_EDIT_HANDLER_MODAL_ALIAS = 'Formulate.Modal.EditHandler';

/** Edits a handler of a form: what is done with each submission. */
export const FORMULATE_EDIT_HANDLER_MODAL = new UmbModalToken<FormulateEditHandlerModalData, FormulateEditHandlerModalValue>(
	FORMULATE_EDIT_HANDLER_MODAL_ALIAS,
	{ modal: { type: 'sidebar', size: 'medium' } },
);
