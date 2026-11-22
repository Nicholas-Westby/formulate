import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbArrayState } from '@umbraco-cms/backoffice/observable-api';
import {
	UmbEntityNamedDetailWorkspaceContextBase,
	UmbWorkspaceIsNewRedirectController,
	type UmbRoutableWorkspaceContext,
	type UmbSubmittableWorkspaceContext,
} from '@umbraco-cms/backoffice/workspace';
import {
	FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS,
	FORMULATE_FORM_ENTITY_TYPE,
	FORMULATE_FORM_WORKSPACE_ALIAS,
} from '../../constants.js';
import { FormulateKindItemWorkspaceEditorElement } from '../../core/kind-item/kind-item-workspace-editor.element.js';
import { findFieldProblem } from '../../core/kind-item/problem-field.js';
import { FORMULATE_CREATE_ROUTE_PATH, readCreateRouteParams } from '../../entity-actions/create/create-path.js';
import { toFormField, toFormHandler } from '../form-items.js';
import type { FormulateFormDetailModel, FormulateFormFieldModel, FormulateFormHandlerModel } from '../types.js';

/**
 * The workspace of a form (Formulate.Workspace.Form): the form designer. It edits the form's name and alias
 * in its header, and its fields and handlers in its Fields and Handlers views. The fields and handlers are
 * held in array states that follow the form as it is loaded, changed or reset, so a view can observe them,
 * and every change to them is a change to the form, which Save sends and leaving the workspace asks about.
 *
 * - The create route (create/parent/{parentEntityType}/{parentUnique}/{kindId}) starts a form of the kind,
 *   such as "Form with Basic Layout", whose kind the API takes when the form is first saved; the workspace
 *   then moves to the form's edit route.
 * - A field or handler given back unchanged (in any order of its parts) is not a change.
 * - A problem the API reports for the name or alias shows on that input.
 */
export class FormulateFormWorkspaceContext
	extends UmbEntityNamedDetailWorkspaceContextBase<FormulateFormDetailModel>
	implements UmbRoutableWorkspaceContext, UmbSubmittableWorkspaceContext
{
	readonly IS_FORMULATE_FORM_WORKSPACE_CONTEXT = true;

	/** Its header shows and changes its name and alias. */
	readonly IS_FORMULATE_ALIASED_WORKSPACE_CONTEXT = true as const;

	readonly alias = this._data.createObservablePartOfCurrent((data) => data?.alias);

	#fields = new UmbArrayState<FormulateFormFieldModel>([], (field) => field.id);

	/** The form's fields, in the order the form shows them. */
	readonly fields = this.#fields.asObservable();

	#handlers = new UmbArrayState<FormulateFormHandlerModel>([], (handler) => handler.id);

	/** The form's handlers, in the order they run. */
	readonly handlers = this.#handlers.asObservable();

	constructor(host: UmbControllerHost) {
		super(host, {
			workspaceAlias: FORMULATE_FORM_WORKSPACE_ALIAS,
			entityType: FORMULATE_FORM_ENTITY_TYPE,
			detailRepositoryAlias: FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS,
		});

		// The lists follow the form as it is loaded, changed, reset or its changes discarded.
		this.observe(
			this._data.createObservablePartOfCurrent((data) => data?.fields ?? []),
			(fields) => this.#fields.setValue(fields),
			'_formulateObserveFields',
		);
		this.observe(
			this._data.createObservablePartOfCurrent((data) => data?.handlers ?? []),
			(handlers) => this.#handlers.setValue(handlers),
			'_formulateObserveHandlers',
		);

		this.routes.setRoutes([
			{
				path: FORMULATE_CREATE_ROUTE_PATH,
				component: FormulateKindItemWorkspaceEditorElement,
				setup: async (_component, info) => {
					const { parent, kindId } = readCreateRouteParams(info.match.params);
					await this.create(parent, kindId);

					new UmbWorkspaceIsNewRedirectController(
						this,
						this,
						this.getHostElement().shadowRoot!.querySelector('umb-router-slot')!,
					);
				},
			},
			{
				path: 'edit/:unique',
				component: FormulateKindItemWorkspaceEditorElement,
				setup: (_component, info) => {
					void this.load(info.match.params.unique!);
				},
			},
		]);
	}

	/**
	 * Starts a new form of a kind. The API takes the kind when the form is first saved: a "Form with Basic
	 * Layout" then gets its layout.
	 * @param parent The folder the form goes in, or the tree's root (unique null).
	 * @param kindId The form's kind.
	 * @returns The new form.
	 */
	async create(parent: UmbEntityModel, kindId: string) {
		return this.createScaffold({ parent, preset: { kindId } });
	}

	getAlias() {
		return this._data.getCurrent()?.alias;
	}

	/**
	 * Sets the alias; an empty alias is stored as none.
	 * @param alias The alias.
	 */
	setAlias(alias: string | null | undefined) {
		this._data.updateCurrent({ alias: alias || null });
	}

	getFields(): ReadonlyArray<FormulateFormFieldModel> {
		return this.#fields.getValue();
	}

	/**
	 * Adds a field.
	 * @param field The new field.
	 * @param index Where it goes; at the end when left out.
	 */
	addField(field: FormulateFormFieldModel, index = -1) {
		this.#fields.appendOneAt(toFormField(field), index);
		this.#storeFields();
	}

	/**
	 * Replaces a field with its edited copy, in its place. A copy that has not changed changes nothing.
	 * @param field The edited field, with the ID of the field it replaces.
	 */
	updateField(field: FormulateFormFieldModel) {
		if (this.#fields.getHasOne(field.id)) {
			this.#fields.appendOne(toFormField(field));
			this.#storeFields();
		}
	}

	removeField(id: string) {
		this.#fields.removeOne(id);
		this.#storeFields();
	}

	/**
	 * Puts the fields in a new order, such as after one is dragged.
	 * @param fields The form's fields, in their new order.
	 */
	setFields(fields: ReadonlyArray<FormulateFormFieldModel>) {
		this.#fields.setValue(fields.map(toFormField));
		this.#storeFields();
	}

	/**
	 * Moves a field to another place.
	 * @param id The field.
	 * @param index Its new place (0 for the first).
	 */
	moveField(id: string, index: number) {
		this.setFields(moveTo(this.getFields(), (field) => field.id === id, index));
	}

	getHandlers(): ReadonlyArray<FormulateFormHandlerModel> {
		return this.#handlers.getValue();
	}

	/**
	 * Adds a handler.
	 * @param handler The new handler.
	 * @param index Where it goes; at the end when left out.
	 */
	addHandler(handler: FormulateFormHandlerModel, index = -1) {
		this.#handlers.appendOneAt(toFormHandler(handler), index);
		this.#storeHandlers();
	}

	/**
	 * Replaces a handler with its edited copy, in its place. A copy that has not changed changes nothing.
	 * @param handler The edited handler, with the ID of the handler it replaces.
	 */
	updateHandler(handler: FormulateFormHandlerModel) {
		if (this.#handlers.getHasOne(handler.id)) {
			this.#handlers.appendOne(toFormHandler(handler));
			this.#storeHandlers();
		}
	}

	/**
	 * Switches a handler on or off.
	 * @param id The handler.
	 * @param enabled Whether it runs when the form is submitted.
	 */
	setHandlerEnabled(id: string, enabled: boolean) {
		this.#handlers.updateOne(id, { enabled });
		this.#storeHandlers();
	}

	removeHandler(id: string) {
		this.#handlers.removeOne(id);
		this.#storeHandlers();
	}

	/**
	 * Puts the handlers in a new order.
	 * @param handlers The form's handlers, in their new order.
	 */
	setHandlers(handlers: ReadonlyArray<FormulateFormHandlerModel>) {
		this.#handlers.setValue(handlers.map(toFormHandler));
		this.#storeHandlers();
	}

	/**
	 * Moves a handler to another place.
	 * @param id The handler.
	 * @param index Its new place (0 for the first).
	 */
	moveHandler(id: string, index: number) {
		this.setHandlers(moveTo(this.getHandlers(), (handler) => handler.id === id, index));
	}

	#storeFields() {
		this._data.updateCurrent({ fields: [...this.#fields.getValue()] });
	}

	#storeHandlers() {
		this._data.updateCurrent({ handlers: [...this.#handlers.getValue()] });
	}

	override async submit() {
		try {
			await super.submit();
		} catch (error) {
			const problem = findFieldProblem(error);

			// The input clears the message once its value changes (umbBindToValidation).
			if (problem) {
				this.validationContext.messages.addMessage('server', problem.path, problem.message);
			}

			throw error;
		}
	}

	override destroy() {
		super.destroy();
		this.#fields.destroy();
		this.#handlers.destroy();
	}
}

/**
 * A list with one of its items moved to another place.
 * @param items The list.
 * @param isItem Finds the item.
 * @param index Its new place.
 * @returns The new list; the same items when the item is not in the list.
 */
function moveTo<T>(items: ReadonlyArray<T>, isItem: (item: T) => boolean, index: number): Array<T> {
	const next = [...items];
	const from = next.findIndex(isItem);

	if (from >= 0) {
		next.splice(index, 0, ...next.splice(from, 1));
	}

	return next;
}

export { FormulateFormWorkspaceContext as api };
