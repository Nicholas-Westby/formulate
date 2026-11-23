import type { UmbTableColumn, UmbTableConfig, UmbTableItem } from '@umbraco-cms/backoffice/components';
import { css, customElement, html, nothing, state, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import type { UUIButtonState, UUIPaginationElement } from '@umbraco-cms/backoffice/external/uui';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { umbConfirmModal, umbOpenModal } from '@umbraco-cms/backoffice/modal';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UmbPaginationManager } from '@umbraco-cms/backoffice/utils';
import {
	deleteFormulateSubmissionById,
	getFormulateSubmission,
	type FormFieldDefinitionModel,
	type SubmissionResponseModel,
} from '../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../core/definitions.context-token.js';
import { isNotFoundError } from '../core/item-gone.js';
import { isSameKind } from '../core/kind-id.js';
import { FORMULATE_FORM_WORKSPACE_CONTEXT } from '../forms/workspace/form-workspace.context-token.js';
import type { FormulateFormFieldModel } from '../forms/types.js';
import { FORMULATE_SUBMISSION_MODAL } from './submission-modal.token.js';
import { exportSubmissions, reportProblem } from './submission-requests.js';
import {
	submissionColumns,
	submissionRow,
	type FormulateSubmissionField,
	type FormulateSubmissionRow,
} from './submission-rows.js';

/** The kind of the Store Data handler, which keeps the submissions (StoreDataFormHandlerDefinition.Constants.KindId). */
const STORE_DATA_KIND_ID = '238ea920-71f4-4d8c-9cc4-33d7181c9c46';

/** How many submissions a page shows: as many as Umbraco's collections show (UmbDefaultCollectionContext). */
const PAGE_SIZE = 50;

/** A table of rows that are not picked, with no icons. */
const TABLE_CONFIG: UmbTableConfig = { allowSelection: false, hideIcon: true };

/** What a click in a row does by itself, rather than open the row's submission. */
const CONTROLS = 'a[href], button, input, select, textarea, label, uui-button, uui-action-bar';

/**
 * The Submissions view of the form workspace (Formulate.WorkspaceView.Form.Submissions): the submissions Store Data
 * kept of the form, newest first, 50 a page, as Umbraco's collections show their items. Each row shows when the
 * submission was sent, the page it was sent from, the values of the form's first four fields that store one, and its
 * files. A click on a row opens it in a sidebar, in full; Delete asks first. Export to CSV downloads all of them.
 */
@customElement('formulate-form-submissions-workspace-view')
export class FormulateFormSubmissionsWorkspaceViewElement extends UmbLitElement {
	/** The form's fields, as the workspace has them, so the columns have the fields' current names. */
	@state()
	private _fields: ReadonlyArray<FormulateFormFieldModel> = [];

	/** Whether the form keeps what visitors send: whether it has an enabled Store Data handler. */
	@state()
	private _keepsSubmissions = false;

	/** The kinds of field; undefined until they have been read. */
	@state()
	private _kinds?: ReadonlyArray<FormFieldDefinitionModel>;

	/** The page of submissions shown; undefined until it has been read. */
	@state()
	private _submissions?: ReadonlyArray<SubmissionResponseModel>;

	/**
	 * The rows of the page shown, with their values cut as the table shows them: made once for each page read, and
	 * again only when the columns change, as a visitor's value can be very long. Undefined until both the page and the
	 * kinds of field have been read.
	 */
	@state()
	private _rows?: ReadonlyArray<FormulateSubmissionRow>;

	/** The fields the table has a column for. */
	#columns: ReadonlyArray<FormulateSubmissionField> = [];

	/** How many submissions come before the page shown. */
	@state()
	private _skip = 0;

	/** How many submissions the form has in all. */
	@state()
	private _total = 0;

	/** Whether the submissions could not be read. */
	@state()
	private _failed = false;

	@state()
	private _currentPage = 1;

	@state()
	private _totalPages = 1;

	@state()
	private _exportState?: UUIButtonState;

	@state()
	private _retryState?: UUIButtonState;

	#formId?: string;
	#pagination = new UmbPaginationManager();

	/** How many reads were started, so that only the latest one's answer is shown. */
	#reads = 0;

	/** The ID of the submission each row of the table shows. */
	#rowSubmissions = new WeakMap<HTMLElement, string>();

	constructor() {
		super();
		this.#pagination.setPageSize(PAGE_SIZE);

		this.consumeContext(FORMULATE_FORM_WORKSPACE_CONTEXT, (workspace) => {
			this.observe(workspace?.fields, (fields) => (this._fields = fields ?? []), '_formulateObserveFields');
			this.observe(
				workspace?.handlers,
				(handlers) =>
					(this._keepsSubmissions = (handlers ?? []).some(
						(handler) => handler.enabled && isSameKind(handler.kindId, STORE_DATA_KIND_ID),
					)),
				'_formulateObserveHandlers',
			);
			this.observe(workspace?.unique, (unique) => this.#showForm(unique ?? undefined), '_formulateObserveUnique');
		});

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, async (definitions) => {
			this._kinds = definitions ? await definitions.getFormFieldDefinitions() : undefined;
		});
	}

	protected override willUpdate(changed: PropertyValues) {
		super.willUpdate(changed);

		if (changed.has('_submissions') || changed.has('_fields') || changed.has('_kinds')) {
			this.#columns = this._kinds ? submissionColumns(this._fields, this._kinds) : [];
			this._rows =
				this._submissions && this._kinds
					? this._submissions.map((submission) => submissionRow(submission, this.#columns))
					: undefined;
		}
	}

	/** Shows the first page of a form's submissions. */
	#showForm(formId: string | undefined) {
		if (!formId || formId === this.#formId) {
			return;
		}

		this.#formId = formId;
		this.#pagination.setCurrentPageNumber(1);
		this._submissions = undefined;
		void this.#read();
	}

	/**
	 * Reads the current page. When it is past the last page, as its submissions were deleted, the last page there
	 * is is read instead.
	 */
	async #read(): Promise<void> {
		const formId = this.#formId;

		if (!formId) {
			return;
		}

		const read = ++this.#reads;
		const skip = this.#pagination.getSkip();
		// tryExecute tells the user what went wrong.
		const { data } = await tryExecute(this, getFormulateSubmission({ query: { formId, skip, take: PAGE_SIZE } }));

		if (read !== this.#reads) {
			return;
		}

		if (!data) {
			this._failed = true;
			return;
		}

		// Moves the current page back to the last page, if it is past it.
		this.#pagination.setTotalItems(data.total);

		if (this.#pagination.getSkip() !== skip) {
			return this.#read();
		}

		this._failed = false;
		this._submissions = data.items;
		this._skip = skip;
		this._total = data.total;
		this._currentPage = this.#pagination.getCurrentPageNumber();
		this._totalPages = this.#pagination.getTotalPages();
	}

	#changePage(event: Event) {
		const page = (event.target as UUIPaginationElement).current;

		if (page === this.#pagination.getCurrentPageNumber()) {
			return;
		}

		this.#pagination.setCurrentPageNumber(page);
		this._currentPage = this.#pagination.getCurrentPageNumber();
		void this.#read();
	}

	/** When a submission was sent, as Umbraco's own tables show a date: in the user's language and time zone. */
	#dateOf(submission: SubmissionResponseModel) {
		return new Date(submission.creationDate).toLocaleString(this.localize.lang());
	}

	#open(submission: SubmissionResponseModel) {
		const fields: Array<FormulateSubmissionField> = this._fields.map(({ id, kindId, name }) => ({ id, kindId, name }));
		void umbOpenModal(this, FORMULATE_SUBMISSION_MODAL, { data: { submission, fields } }).catch(() => undefined);
	}

	async #delete(submission: SubmissionResponseModel) {
		const confirmed = await umbConfirmModal(this, {
			headline: this.localize.term('formulate_deleteSubmissionHeadline'),
			content: this.localize.term('formulate_confirmDeleteSubmission', this.#dateOf(submission)),
			color: 'danger',
			confirmLabel: this.localize.term('general_delete'),
		}).then(
			() => true,
			() => false,
		);

		if (!confirmed) {
			return;
		}

		const { error } = await tryExecute(this, deleteFormulateSubmissionById({ path: { id: submission.id } }), {
			disableNotifications: true,
		});

		// A submission someone else deleted already is gone, as asked; it just leaves the page.
		if (error && !isNotFoundError(error)) {
			await reportProblem(this, this.localize.term('formulate_submissionNotDeleted'), error);
			return;
		}

		await this.#read();
	}

	/** Reads the current page again, after it could not be read. */
	async #retry() {
		if (this._retryState === 'waiting') {
			return;
		}

		this._retryState = 'waiting';
		await this.#read();
		this._retryState = undefined;
	}

	async #export() {
		if (!this.#formId || this._exportState === 'waiting') {
			return;
		}

		this._exportState = 'waiting';
		const error = await exportSubmissions(this, this.#formId);
		this._exportState = undefined;

		if (error) {
			await reportProblem(this, this.localize.term('formulate_submissionsNotExported'), error);
		}
	}

	/** Opens a row's submission from a click anywhere on the row, but on its links and buttons. */
	#onRowRendered = (row: HTMLElement | undefined, item: UmbTableItem) => {
		if (!row) {
			return;
		}

		if (!this.#rowSubmissions.has(row)) {
			row.addEventListener('click', this.#onRowClick);
			row.style.cursor = 'pointer';
		}

		this.#rowSubmissions.set(row, item.id);
	};

	#onRowClick = (event: MouseEvent) => {
		const row = event.currentTarget as HTMLElement;
		const path = event.composedPath();
		const clicked = path.slice(0, path.indexOf(row));

		// A link or button does what it does by itself; and text that was just selected stays selected.
		if (clicked.some((target) => target instanceof Element && target.matches(CONTROLS)) || window.getSelection()?.toString()) {
			return;
		}

		const submission = this._submissions?.find((candidate) => candidate.id === this.#rowSubmissions.get(row));

		if (submission) {
			this.#open(submission);
		}
	};

	override render() {
		return html`
			<umb-body-layout header-transparent>
				${this._submissions?.length && !this._failed ? this.#renderToolbar() : nothing} ${this.#renderContent()}
			</umb-body-layout>
		`;
	}

	#renderToolbar() {
		return html`
			<div id="toolbar" slot="header">
				<uui-button
					color="default"
					look="outline"
					label=${this.localize.term('formulate_exportSubmissions')}
					.state=${this._exportState}
					@click=${() => this.#export()}></uui-button>
			</div>
		`;
	}

	#renderContent() {
		// What could not be read is not shown, and not offered for export; the pages stay, to read another.
		if (this._failed) {
			return html`
				<div id="failed" class="uui-text">
					<h4>${this.localize.term('formulate_submissionsNotRead')}</h4>
					<uui-button
						color="default"
						look="outline"
						label=${this.localize.term('general_retry')}
						.state=${this._retryState}
						@click=${() => this.#retry()}></uui-button>
				</div>
				${this.#renderPagination()}
			`;
		}

		if (!this._submissions || !this._rows) {
			return html`<umb-view-loader></umb-view-loader>`;
		}

		// A form with no Store Data handler keeps nothing, which is the usual reason it has no submissions.
		if (!this._submissions.length) {
			return html`
				<div id="empty" class="uui-text">
					<h4>${this.localize.term('formulate_noSubmissions')}</h4>
					${this._keepsSubmissions ? nothing : html`<p>${this.localize.term('formulate_noStoreDataHandler')}</p>`}
				</div>
			`;
		}

		return html`
			<umb-table
				.config=${TABLE_CONFIG}
				.columns=${this.#tableColumns(this.#columns)}
				.items=${this.#items(this.#columns, this._submissions, this._rows)}
				.onRowRendered=${this.#onRowRendered}></umb-table>
			${this.#renderPagination()}
		`;
	}

	#tableColumns(fields: ReadonlyArray<FormulateSubmissionField>): Array<UmbTableColumn> {
		return [
			{ name: this.localize.term('formulate_submissionCreated'), alias: 'created' },
			{ name: this.localize.term('formulate_submissionPage'), alias: 'page' },
			...fields.map((field) => ({ name: field.name || this.localize.term('formulate_unnamed'), alias: `field-${field.id}` })),
			{ name: this.localize.term('formulate_submissionFiles'), alias: 'files' },
			{ name: '', alias: 'actions', align: 'right' },
		];
	}

	#items(
		fields: ReadonlyArray<FormulateSubmissionField>,
		submissions: ReadonlyArray<SubmissionResponseModel>,
		rows: ReadonlyArray<FormulateSubmissionRow>,
	): Array<UmbTableItem> {
		const total = this.localize.number(this._total);

		return rows.map((row, index) => {
			const submission = submissions[index]!;
			const date = this.#dateOf(submission);
			// The row's place in the list makes its actions' names its own: two submissions can share a date.
			const position = this.localize.number(this._skip + index + 1);

			return {
				id: row.id,
				data: [
					{
						columnAlias: 'created',
						value: html`<uui-button
							compact
							label=${this.localize.term('formulate_openSubmission', position, total, date)}
							@click=${() => this.#open(submission)}
							>${date}</uui-button
						>`,
					},
					{
						columnAlias: 'page',
						value: row.page
							? html`<a href=${row.page.href} target="_blank" rel="noopener noreferrer">${row.page.host}${row.page.path}</a>`
							: nothing,
					},
					...fields.map((field, index) => ({ columnAlias: `field-${field.id}`, value: row.values[index] })),
					{ columnAlias: 'files', value: row.files },
					{
						columnAlias: 'actions',
						value: html`
							<!-- A screen reader hears which submission the action is for. -->
							<uui-action-bar>
								<uui-button
									label=${this.localize.term('general_delete')}
									aria-label=${this.localize.term('formulate_deleteSubmission', position, total, date)}
									@click=${() => this.#delete(submission)}>
									<uui-icon name="icon-trash"></uui-icon>
								</uui-button>
							</uui-action-bar>
						`,
					},
				],
			};
		});
	}

	#renderPagination() {
		if (this._totalPages <= 1) {
			return nothing;
		}

		return html`
			<uui-pagination
				.current=${this._currentPage}
				.total=${this._totalPages}
				firstlabel=${this.localize.term('general_first')}
				previouslabel=${this.localize.term('general_previous')}
				nextlabel=${this.localize.term('general_next')}
				lastlabel=${this.localize.term('general_last')}
				@change=${this.#changePage}></uui-pagination>
		`;
	}

	// As Umbraco's collections lay out their toolbar, table, empty state and pages (umb-collection-default).
	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
				height: 100%;
			}

			#toolbar {
				display: flex;
				gap: var(--uui-size-space-5);
				width: 100%;
			}

			#empty,
			#failed {
				height: 80%;
				align-content: center;
				text-align: center;
			}

			uui-button[compact] {
				text-align: left;
			}

			uui-pagination {
				display: block;
				margin-top: var(--uui-size-layout-1);
			}
		`,
	];
}

export { FormulateFormSubmissionsWorkspaceViewElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-form-submissions-workspace-view': FormulateFormSubmissionsWorkspaceViewElement;
	}
}
