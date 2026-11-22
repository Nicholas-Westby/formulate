import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbObjectState } from '@umbraco-cms/backoffice/observable-api';
import type { UmbEntityDetailWorkspaceContextCreateArgs } from '@umbraco-cms/backoffice/workspace';
import { FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS, FORMULATE_LAYOUT_ENTITY_TYPE, FORMULATE_LAYOUT_WORKSPACE_ALIAS } from '../../constants.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../core/definitions.context-token.js';
import { FORMULATE_LAYOUT_EDITOR_TYPE } from '../../core/kind-editor.js';
import { FormulateKindItemWorkspaceContext } from '../../core/kind-item/kind-item-workspace.context.js';
import { FormulateFormDetailRepository } from '../../forms/repository/form-detail.repository.js';
import type { FormulateFormFieldModel } from '../../forms/types.js';
import type { FormulateLayoutDetailModel } from '../types.js';

/** The form a layout lays out, as the layout's workspace read it. */
export interface FormulateLayoutFormModel {
	unique: string;
	/** The form's fields, in the form's order, as they are saved. */
	fields: ReadonlyArray<FormulateFormFieldModel>;
}

/**
 * The workspace of a layout: its name and alias, its template, and its configuration, which its kind's editor
 * edits with the fields of the layout's form.
 *
 * - The create route makes a new layout of a kind under a form (create/parent/formulate-form/{formId}/{kindId}),
 *   with the kind's default configuration and the default template.
 * - The layout's form is read through the form detail repository, for its fields. Until it has been read,
 *   and when it cannot be read (such as when it was deleted), {@link form} says so, and nothing may lay out its
 *   fields: a designer without them would drop the fields it does not know.
 * - A problem the API reports for the template shows on the template ({@link templateProblems}).
 */
export class FormulateLayoutWorkspaceContext extends FormulateKindItemWorkspaceContext<FormulateLayoutDetailModel> {
	readonly IS_FORMULATE_LAYOUT_WORKSPACE_CONTEXT = true as const;

	/** The template the layout is shown with; null for a layout saved without one, which the server shows with the default. */
	readonly templateId = this._data.createObservablePartOfCurrent((data) => data?.templateId);

	/** The problems the API reported for the template, until the template changes. */
	readonly templateProblems = this.validationContext.messages.messagesOfTypeAndPath('server', '$.templateId');

	#form = new UmbObjectState<FormulateLayoutFormModel | null | undefined>(undefined);

	/** The layout's form: undefined while it is read, null when it cannot be read. */
	readonly form = this.#form.asObservable();

	#formRepository = new FormulateFormDetailRepository(this);

	/** The latest read of the form, so an older read that ends later is ignored. */
	#formRead?: symbol;

	#destroyed = false;

	constructor(host: UmbControllerHost) {
		super(host, {
			workspaceAlias: FORMULATE_LAYOUT_WORKSPACE_ALIAS,
			entityType: FORMULATE_LAYOUT_ENTITY_TYPE,
			detailRepositoryAlias: FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS,
			editorType: FORMULATE_LAYOUT_EDITOR_TYPE,
			getDefinitions: (definitions) => definitions.getLayoutDefinitions(),
		});

		this.observe(
			this._data.createObservablePartOfCurrent((data) => data?.formUnique),
			(formUnique) => void this.#readForm(formUnique),
			'_formulateObserveFormUnique',
		);
	}

	getTemplateId() {
		return this._data.getCurrent()?.templateId ?? null;
	}

	/**
	 * Sets the template. A problem the API reported for the old template no longer holds, so it goes.
	 * @param templateId The template.
	 */
	setTemplateId(templateId: string | null) {
		this._data.updateCurrent({ templateId });
		this.validationContext.messages.removeMessagesByTypeAndPath('server', '$.templateId');
	}

	/** A new layout goes in the form it is created under, and has the default template. */
	override async createScaffold(args: UmbEntityDetailWorkspaceContextCreateArgs<FormulateLayoutDetailModel>) {
		const templateId = await this.#defaultTemplateId();

		return super.createScaffold({ ...args, preset: { formUnique: args.parent.unique, templateId, ...args.preset } });
	}

	async #defaultTemplateId(): Promise<string | null> {
		const definitions = await this.getContext(FORMULATE_DEFINITIONS_CONTEXT).catch(() => undefined);
		const templates = (await definitions?.getTemplateDefinitions()) ?? [];

		return templates.find((template) => template.isDefault)?.id ?? null;
	}

	async #readForm(formUnique: string | null | undefined) {
		const read = Symbol();
		this.#formRead = read;
		this.#form.setValue(undefined);

		if (!formUnique) {
			return;
		}

		// A form that is gone says so, and drops out of the tree (the shared detail data source).
		const { data } = await this.#formRepository.requestByUnique(formUnique);

		// The workspace may have closed, or opened another layout, meanwhile.
		if (!this.#destroyed && this.#formRead === read) {
			this.#form.setValue(data ? { unique: data.unique, fields: data.fields } : null);
		}
	}

	override destroy() {
		this.#destroyed = true;
		super.destroy();
		this.#form.destroy();
	}
}

export { FormulateLayoutWorkspaceContext as api };
