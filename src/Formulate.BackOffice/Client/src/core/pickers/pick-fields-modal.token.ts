import { UmbModalToken } from '@umbraco-cms/backoffice/modal';

/** A field of the form the dialog offers. */
export interface FormulatePickFieldsOption {
	id: string;
	/** The field's name, or a stand-in for a field that has none. */
	name: string;
	alias: string;
	/** The icon of the field's kind; none while it is not known. */
	icon?: string;
}

/** What the dialog shows: its headline, such as "Recipient fields", and the form's fields to pick from. */
export interface FormulatePickFieldsModalData {
	headline: string;
	fields: ReadonlyArray<FormulatePickFieldsOption>;
}

/** The picked fields' IDs: those picked before, in their order, then those just picked. */
export interface FormulatePickFieldsModalValue {
	selection: Array<string>;
}

export const FORMULATE_PICK_FIELDS_MODAL_ALIAS = 'Formulate.Modal.PickFields';

/**
 * Picks fields of the form being edited, such as the fields an email includes. The fields are the form's as
 * the designer holds them, saved or not, so the dialog needs no server. As Umbraco's language picker.
 */
export const FORMULATE_PICK_FIELDS_MODAL = new UmbModalToken<FormulatePickFieldsModalData, FormulatePickFieldsModalValue>(
	FORMULATE_PICK_FIELDS_MODAL_ALIAS,
	{ modal: { type: 'sidebar', size: 'small' } },
);
