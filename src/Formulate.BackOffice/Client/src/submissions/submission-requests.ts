import type { UmbClassInterface } from '@umbraco-cms/backoffice/class-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { blobDownload } from '@umbraco-cms/backoffice/utils';
import { getFormulateSubmissionByIdFileByFieldId, getFormulateSubmissionExport, type SubmissionFileModel } from '../api/index.js';

/** The name the export is saved as: the one the server gives it (SubmissionsController.Export). */
const EXPORT_FILE_NAME = 'submissions.csv';

// Downloads go through the generated client, which Umbraco's auth context signs in, into a blob that core's
// blobDownload saves. Each is read as a blob as it is: read as text, the export would lose its byte order mark, which
// tells Excel that the file is UTF-8. tryExecute's own notification is turned off, as it says nothing about a 404;
// the caller says what failed instead (reportProblem).

/**
 * Downloads a file a visitor sent with a submission, by the name Store Data stored it under. The server finds the
 * file from that name in the stored submission, never from the path.
 * @param host The controller host.
 * @param submissionId The submission's ID.
 * @param file The file, as the submission lists it.
 * @returns The problem, when the file could not be downloaded.
 */
export async function downloadSubmissionFile(host: UmbClassInterface, submissionId: string, file: SubmissionFileModel) {
	const { data, error } = await tryExecute(
		host,
		getFormulateSubmissionByIdFileByFieldId({
			path: { id: submissionId, fieldId: file.fieldId },
			query: { fileName: file.fileName },
			parseAs: 'blob',
		}),
		{ disableNotifications: true },
	);

	if (data) {
		blobDownload(data, file.fileName, 'application/octet-stream');
	}

	return error;
}

/**
 * Downloads all of a form's submissions as CSV, as the server writes it.
 * @param host The controller host.
 * @param formId The form's ID.
 * @returns The problem, when the submissions could not be exported.
 */
export async function exportSubmissions(host: UmbClassInterface, formId: string) {
	const { data, error } = await tryExecute(host, getFormulateSubmissionExport({ query: { formId }, parseAs: 'blob' }), {
		disableNotifications: true,
	});

	if (data) {
		blobDownload(data, EXPORT_FILE_NAME, 'text/csv');
	}

	return error;
}

/**
 * Tells the user that something could not be done, and why, as the API explained it.
 * @param host The controller host, inside the back office.
 * @param headline What could not be done.
 * @param problem The problem the request gave.
 */
export async function reportProblem(host: UmbClassInterface, headline: string, problem: Error) {
	const notifications = await host.getContext(UMB_NOTIFICATION_CONTEXT).catch(() => undefined);
	notifications?.peek('danger', { data: { headline, message: problem.message } });
}
