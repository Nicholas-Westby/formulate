import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import type { CreateOptionModel } from '../../api/index.js';

/** What the create dialog lists: the options the API gives for the parent, which they are created under. */
export interface FormulateCreateOptionsModalData {
	parent: UmbEntityModel;
	options: Array<CreateOptionModel>;
}

/** The option that was created or followed. */
export interface FormulateCreateOptionsModalValue {
	option: CreateOptionModel;
}

export const FORMULATE_CREATE_OPTIONS_MODAL_ALIAS = 'Formulate.Modal.CreateOptions';

/** The create dialog: what can be created under a root, folder or form. */
export const FORMULATE_CREATE_OPTIONS_MODAL = new UmbModalToken<
	FormulateCreateOptionsModalData,
	FormulateCreateOptionsModalValue
>(FORMULATE_CREATE_OPTIONS_MODAL_ALIAS, { modal: { type: 'dialog' } });
