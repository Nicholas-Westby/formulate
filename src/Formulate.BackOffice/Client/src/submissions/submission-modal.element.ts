import { css, customElement, html, ifDefined, nothing, repeat, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type { SubmissionFileModel, SubmissionResponseModel } from '../api/index.js';
import type { FormulateSubmissionModalData } from './submission-modal.token.js';
import { downloadSubmissionFile, reportProblem } from './submission-requests.js';
import { submissionEntries, submissionPage, type FormulateSubmissionEntry } from './submission-rows.js';

/**
 * The sidebar of a submission (Formulate.Modal.Submission): the page it was sent from, then every value and file
 * it stored, in full, in the form's order under the fields' current names; then those of fields no longer on the
 * form, under the names they were stored with. Each file downloads from a button named after it.
 */
@customElement('formulate-submission-modal')
export class FormulateSubmissionModalElement extends UmbModalBaseElement<FormulateSubmissionModalData, never> {
	/** The files being downloaded, by fileKey: each one's button shows it is busy, and does nothing more till then. */
	@state()
	private _downloading: ReadonlyArray<string> = [];

	async #download(submission: SubmissionResponseModel, file: SubmissionFileModel, key: string) {
		if (this._downloading.includes(key)) {
			return;
		}

		this._downloading = [...this._downloading, key];
		const error = await downloadSubmissionFile(this, submission.id, file);
		this._downloading = this._downloading.filter((downloading) => downloading !== key);

		if (error) {
			await reportProblem(this, this.localize.term('formulate_fileNotDownloaded', file.fileName), error);
		}
	}

	override render() {
		const submission = this.data?.submission;

		if (!submission) {
			return nothing;
		}

		// As the Submissions view shows the date: in the user's language and time zone.
		const date = new Date(submission.creationDate).toLocaleString(this.localize.lang());
		const page = submissionPage(submission.url);

		return html`
			<umb-body-layout headline=${this.localize.term('formulate_submissionHeadline', date)}>
				<uui-box>
					${page
						? html`
								<umb-property-layout label=${this.localize.term('formulate_submissionPage')} orientation="vertical">
									<div slot="editor">
										<a href=${page.href} target="_blank" rel="noopener noreferrer">${page.host}${page.path}</a>
									</div>
								</umb-property-layout>
							`
						: nothing}
					${repeat(
						submissionEntries(submission, this.data?.fields ?? []),
						(entry) => entry.fieldId,
						(entry) => this.#renderEntry(submission, entry),
					)}
				</uui-box>
				<uui-button slot="actions" look="primary" label=${this.localize.term('general_close')} @click=${this._rejectModal}></uui-button>
			</umb-body-layout>
		`;
	}

	#renderEntry(submission: SubmissionResponseModel, entry: FormulateSubmissionEntry) {
		return html`
			<umb-property-layout
				label=${entry.name || this.localize.term('formulate_unnamed')}
				description=${ifDefined(entry.onForm ? undefined : this.localize.term('formulate_fieldNoLongerOnForm'))}
				orientation="vertical">
				<div slot="editor">
					${entry.values.map((value) => html`<div class="value">${value}</div>`)}
					${entry.files.map((file, index) => {
						const key = fileKey(entry.fieldId, index);

						return html`
							<uui-button
								look="secondary"
								label=${this.localize.term('formulate_downloadFile', file.fileName)}
								.state=${this._downloading.includes(key) ? 'waiting' : undefined}
								@click=${() => this.#download(submission, file, key)}>
								<uui-icon name="icon-download-alt"></uui-icon>
								${file.fileName}
							</uui-button>
						`;
					})}
				</div>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			[slot='editor'] {
				display: flex;
				flex-direction: column;
				align-items: flex-start;
				gap: var(--uui-size-space-2);
			}

			/* A long page address wraps rather than widen the sidebar. */
			a {
				overflow-wrap: anywhere;
			}

			/* A value shows as it was sent, with its line breaks. */
			.value {
				white-space: pre-wrap;
				overflow-wrap: anywhere;
			}

			uui-icon {
				margin-right: var(--uui-size-space-1);
			}
		`,
	];
}

/**
 * A file of the submission, as one key: the field it was sent with, and its place in that field's files. Not its
 * name, which two files of a field can share, and the API gives a file no ID.
 * @param fieldId The ID of the file's field, as the sidebar's entry has it.
 * @param index The file's place in the entry's files.
 */
function fileKey(fieldId: string, index: number) {
	return JSON.stringify([fieldId, index]);
}

export { FormulateSubmissionModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-submission-modal': FormulateSubmissionModalElement;
	}
}
