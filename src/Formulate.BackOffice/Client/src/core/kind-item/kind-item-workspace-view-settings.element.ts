import { css, customElement, html, nothing, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type { KindDefinitionModel } from '../../api/index.js';
import type { FormulateKindEditorSlotElement } from '../kind-editor-slot.element.js';
import type { FormulateKindEditorType } from '../kind-editor.js';
import '../kind-editor-slot.element.js';
import type { FormulateKindItemWorkspaceContext } from './kind-item-workspace.context.js';
import { FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT } from './kind-item-workspace.context-token.js';

/**
 * The Settings view of a validation or data values workspace: the item's configuration, edited by its kind's
 * editor in a box named after the kind, as Umbraco's data type workspace shows a property editor's settings.
 * A problem the API reports for the configuration shows under the editor until the configuration changes.
 */
@customElement('formulate-kind-item-workspace-view-settings')
export class FormulateKindItemWorkspaceViewSettingsElement extends UmbLitElement {
	#context?: FormulateKindItemWorkspaceContext;

	@state()
	private _editorType?: FormulateKindEditorType;

	@state()
	private _definition?: KindDefinitionModel | null;

	@state()
	private _configuration?: unknown;

	@state()
	private _readonly = false;

	@state()
	private _problems: Array<string> = [];

	constructor() {
		super();

		this.consumeContext(FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT, (context) => {
			this.#context = context;
			this._editorType = context?.editorType;
			this.observe(context?.definition, (definition) => (this._definition = definition), '_observeDefinition');
			this.observe(context?.configuration, (configuration) => (this._configuration = configuration), '_observeConfiguration');
			this.observe(context?.readOnlyGuard.permitted, (readonly) => (this._readonly = readonly === true), '_observeReadOnly');
			this.observe(
				context?.configurationProblems,
				(problems) => (this._problems = (problems ?? []).map((problem) => problem.body)),
				'_observeProblems',
			);
		});
	}

	#onChange(event: Event) {
		this.#context?.setConfiguration((event.target as FormulateKindEditorSlotElement).value);
	}

	override render() {
		// The kind's definition is read once for all items; nothing shows for the moment that takes.
		if (this._definition === undefined) {
			return nothing;
		}

		return html`
			<uui-box headline=${this._definition?.name ?? this.localize.term('general_settings')}>
				<formulate-kind-editor-slot
					.type=${this._editorType}
					.editorAlias=${this._definition?.editorAlias ?? null}
					.value=${this._configuration}
					?readonly=${this._readonly}
					@change=${this.#onChange}></formulate-kind-editor-slot>
				${this.#renderProblems()}
			</uui-box>
		`;
	}

	#renderProblems() {
		if (!this._problems.length) {
			return nothing;
		}

		return html`
			<div id="configuration-messages" role="alert">
				${this._problems.map((problem) => html`<div>${problem}</div>`)}
			</div>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
				margin: var(--uui-size-layout-1);
				padding-bottom: var(--uui-size-layout-1);
			}

			#configuration-messages {
				margin-top: var(--uui-size-space-4);
				color: var(--uui-color-invalid-standalone);
			}
		`,
	];
}

export { FormulateKindItemWorkspaceViewSettingsElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-kind-item-workspace-view-settings': FormulateKindItemWorkspaceViewSettingsElement;
	}
}
