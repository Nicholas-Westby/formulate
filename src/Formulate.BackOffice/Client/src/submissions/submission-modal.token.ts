import { UmbModalToken } from '@umbraco-cms/backoffice/modal';
import type { SubmissionResponseModel } from '../api/index.js';
import type { FormulateSubmissionField } from './submission-rows.js';

/** What the sidebar shows: a submission, and the form's fields in order, to name and order its values by. */
export interface FormulateSubmissionModalData {
	submission: SubmissionResponseModel;
	fields: ReadonlyArray<FormulateSubmissionField>;
}

export const FORMULATE_SUBMISSION_MODAL_ALIAS = 'Formulate.Modal.Submission';

/** Shows a submission in full, in a sidebar, as Umbraco's own detail sidebars do. */
export const FORMULATE_SUBMISSION_MODAL = new UmbModalToken<FormulateSubmissionModalData, never>(FORMULATE_SUBMISSION_MODAL_ALIAS, {
	modal: { type: 'sidebar', size: 'medium' },
});
