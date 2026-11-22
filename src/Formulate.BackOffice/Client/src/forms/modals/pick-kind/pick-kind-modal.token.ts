import { UmbModalToken } from '@umbraco-cms/backoffice/modal';

/** A kind the dialog offers. */
export interface FormulatePickKindOption {
	kindId: string;
	name: string;
	icon: string;
	/** The category the kind is listed under, such as Inputs. */
	category: string;
}

/** What the dialog shows: its headline, such as "Add field", and the kinds to pick from. */
export interface FormulatePickKindModalData {
	headline: string;
	kinds: ReadonlyArray<FormulatePickKindOption>;
}

/** The kind that was picked. */
export interface FormulatePickKindModalValue {
	kindId: string;
}

export const FORMULATE_PICK_KIND_MODAL_ALIAS = 'Formulate.Modal.PickKind';

/** Picks the kind of a new field or handler, as Umbraco's "Select editor" dialog picks a property editor. */
export const FORMULATE_PICK_KIND_MODAL = new UmbModalToken<FormulatePickKindModalData, FormulatePickKindModalValue>(
	FORMULATE_PICK_KIND_MODAL_ALIAS,
	{ modal: { type: 'sidebar', size: 'medium' } },
);
