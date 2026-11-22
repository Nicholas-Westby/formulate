import type { UmbInputWithAliasElement } from '@umbraco-cms/backoffice/components';
import { css, customElement, html, query, state, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { umbFocus, UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbBindServerValidationToFormControl, umbBindToValidation } from '@umbraco-cms/backoffice/validation';
import {
	FORMULATE_ALIASED_WORKSPACE_CONTEXT,
	type FormulateAliasedWorkspaceContext,
} from './aliased-workspace.context-token.js';

/**
 * Any alias. The API accepts every alias, and Formulate 3 did too, so Umbraco's pattern (a letter, then
 * letters, digits, - and _) must not stop an older item from being saved.
 */
export const FORMULATE_ANY_ALIAS_PATTERN = '[\\s\\S]*';

/**
 * The header of a validation, data values or form workspace: the name and alias, as Umbraco's content type and
 * user group workspaces show them. The alias follows the name for a new item until it is unlocked. A
 * problem the API reports for the name or alias shows under the input until that value changes.
 */
@customElement('formulate-kind-item-workspace-header')
export class FormulateKindItemWorkspaceHeaderElement extends UmbLitElement {
	#context?: FormulateAliasedWorkspaceContext;
	#aliasBinder?: UmbBindServerValidationToFormControl;

	@state()
	private _name = '';

	@state()
	private _alias = '';

	@state()
	private _isNew = false;

	@state()
	private _readonly = false;

	@query('umb-input-with-alias')
	private _input?: UmbInputWithAliasElement;

	constructor() {
		super();

		this.consumeContext(FORMULATE_ALIASED_WORKSPACE_CONTEXT, (context) => {
			this.#context = context;
			this.observe(context?.name, (name) => (this._name = name ?? ''), '_observeName');
			this.observe(context?.alias, (alias) => (this._alias = alias ?? ''), '_observeAlias');
			this.observe(context?.isNew, (isNew) => (this._isNew = isNew === true), '_observeIsNew');
			this.observe(context?.readOnlyGuard?.permitted, (readonly) => (this._readonly = readonly === true), '_observeReadOnly');
		});
	}

	protected override firstUpdated(changed: PropertyValues) {
		super.firstUpdated(changed);

		// umbBindToValidation binds the name; the API can name the alias too, which shares the input.
		if (this._input) {
			this.#aliasBinder = new UmbBindServerValidationToFormControl(this, this._input, '$.alias');
			this.#aliasBinder.value = this._alias;
		}
	}

	protected override updated(changed: PropertyValues) {
		super.updated(changed);

		// A changed alias clears what the API said about the old one.
		if (changed.has('_alias') && this.#aliasBinder) {
			this.#aliasBinder.value = this._alias;
		}
	}

	#onChange(event: Event) {
		const input = event.target as UmbInputWithAliasElement;
		this.#context?.setName(String(input.value ?? ''));
		this.#context?.setAlias(input.alias);
	}

	override render() {
		return html`
			<umb-form-validation-message id="validation">
				<umb-input-with-alias
					id="name"
					label=${this.localize.term('placeholders_entername')}
					.value=${this._name}
					.alias=${this._alias}
					alias-pattern=${FORMULATE_ANY_ALIAS_PATTERN}
					.autocomplete=${'off'}
					?auto-generate-alias=${this._isNew}
					?readonly=${this._readonly}
					required
					@change=${this.#onChange}
					${umbBindToValidation(this, '$.name', this._name)}
					${umbFocus()}></umb-input-with-alias>
			</umb-form-validation-message>
		`;
	}

	static override styles = [
		css`
			:host {
				display: contents;
			}

			#validation {
				flex: 1 1 auto;
			}
		`,
	];
}

export default FormulateKindItemWorkspaceHeaderElement;

declare global {
	interface HTMLElementTagNameMap {
		'formulate-kind-item-workspace-header': FormulateKindItemWorkspaceHeaderElement;
	}
}
