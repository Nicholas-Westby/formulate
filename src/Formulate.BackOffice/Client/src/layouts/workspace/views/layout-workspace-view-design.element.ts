import { css, customElement, html, nothing, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type { KindDefinitionModel, TemplateDefinitionModel } from '../../../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../../core/definitions.context-token.js';
import { isSameGuid } from '../../../core/guid.js';
import type { FormulateKindEditorSlotElement } from '../../../core/kind-editor-slot.element.js';
import '../../../core/kind-editor-slot.element.js';
import type { FormulateKindEditorContext } from '../../../core/kind-editor.js';
import type { FormulateLayoutFormModel, FormulateLayoutWorkspaceContext } from '../layout-workspace.context.js';
import { FORMULATE_LAYOUT_WORKSPACE_CONTEXT } from '../layout-workspace.context-token.js';

/**
 * The Design view of a layout workspace: the template the layout is shown with, and the layout's
 * configuration, edited by its kind's editor with the fields of the layout's form, in a box named after the
 * kind. While the form is read, and when it cannot be read, the editor is not shown, so it cannot drop the
 * fields it would not know. A problem the API reports for the template or the configuration shows under it.
 */
@customElement('formulate-layout-workspace-view-design')
export class FormulateLayoutWorkspaceViewDesignElement extends UmbLitElement {
	#context?: FormulateLayoutWorkspaceContext;

	@state()
	private _definition?: KindDefinitionModel | null;

	@state()
	private _configuration?: unknown;

	@state()
	private _readonly = false;

	@state()
	private _templateId?: string | null;

	/** The installed templates, once they are known. */
	@state()
	private _templates?: ReadonlyArray<TemplateDefinitionModel>;

	@state()
	private _form?: FormulateLayoutFormModel | null;

	/** What the kind's editor gets besides the configuration: the form's fields and the form. */
	@state()
	private _editorContext?: FormulateKindEditorContext;

	@state()
	private _templateProblems: Array<string> = [];

	@state()
	private _configurationProblems: Array<string> = [];

	constructor() {
		super();

		this.consumeContext(FORMULATE_LAYOUT_WORKSPACE_CONTEXT, (context) => {
			this.#context = context;
			this.observe(context?.definition, (definition) => (this._definition = definition), '_observeDefinition');
			this.observe(context?.configuration, (configuration) => (this._configuration = configuration), '_observeConfiguration');
			this.observe(context?.readOnlyGuard.permitted, (readonly) => (this._readonly = readonly === true), '_observeReadOnly');
			this.observe(context?.templateId, (templateId) => (this._templateId = templateId), '_observeTemplateId');
			this.observe(
				context?.form,
				(form) => {
					this._form = form;
					this._editorContext = form ? { formFields: form.fields, formId: form.unique } : undefined;
				},
				'_observeForm',
			);
			this.observe(
				context?.templateProblems,
				(problems) => (this._templateProblems = (problems ?? []).map((problem) => problem.body)),
				'_observeTemplateProblems',
			);
			this.observe(
				context?.configurationProblems,
				(problems) => (this._configurationProblems = (problems ?? []).map((problem) => problem.body)),
				'_observeConfigurationProblems',
			);
		});

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, async (definitions) => {
			const templates = await definitions?.getTemplateDefinitions();

			if (templates) {
				this._templates = templates;
			}
		});
	}

	/**
	 * The templates to choose from. A layout saved without a template shows the default one as chosen, as the
	 * server saves it with that one; a template that is no longer installed shows as such until another is
	 * chosen.
	 */
	#templateOptions() {
		const chosen = this._templateId;
		const templates = this._templates ?? [];
		const shown = chosen ? templates.find((template) => isSameGuid(template.id, chosen)) : templates.find((template) => template.isDefault);
		const options = templates.map((template) => ({ name: template.name, value: template.id, selected: template === shown }));

		return chosen && !shown
			? [{ name: this.localize.term('formulate_templateNotInstalled', chosen), value: chosen, selected: true }, ...options]
			: options;
	}

	#onTemplateChange(event: Event) {
		this.#context?.setTemplateId(String((event.target as HTMLInputElement).value ?? '') || null);
	}

	#onConfigurationChange(event: Event) {
		this.#context?.setConfiguration((event.target as FormulateKindEditorSlotElement).value);
	}

	override render() {
		// The kind's definition is read once for all layouts; nothing shows for the moment that takes.
		if (this._definition === undefined) {
			return nothing;
		}

		return html`
			<uui-box headline=${this._definition?.name ?? this.localize.term('general_settings')}>
				${this.#renderTemplate()} ${this.#renderEditor()} ${this.#renderProblems('configuration-messages', this._configurationProblems)}
			</uui-box>
		`;
	}

	#renderTemplate() {
		const label = this.localize.term('formulate_template');

		return html`
			<umb-property-layout label=${label} description=${this.localize.term('formulate_templateDescription')}>
				<div slot="editor">
					${this._templates
						? html`<uui-select
								id="template"
								label=${label}
								.options=${this.#templateOptions()}
								?disabled=${this._readonly}
								@change=${this.#onTemplateChange}></uui-select>`
						: nothing}
					${this.#renderProblems('template-messages', this._templateProblems)}
				</div>
			</umb-property-layout>
		`;
	}

	#renderEditor() {
		// The form is being read.
		if (this._form === undefined) {
			return nothing;
		}

		if (this._form === null) {
			return html`<p id="form-missing" class="problem" role="alert">${this.localize.term('formulate_layoutFormMissing')}</p>`;
		}

		return html`
			<formulate-kind-editor-slot
				.type=${this.#context?.editorType}
				.editorAlias=${this._definition?.editorAlias ?? null}
				.value=${this._configuration}
				.context=${this._editorContext}
				?readonly=${this._readonly}
				@change=${this.#onConfigurationChange}></formulate-kind-editor-slot>
		`;
	}

	#renderProblems(id: string, problems: Array<string>) {
		if (!problems.length) {
			return nothing;
		}

		return html`
			<div id=${id} class="problem" role="alert">${problems.map((problem) => html`<div>${problem}</div>`)}</div>
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

			.problem {
				color: var(--uui-color-invalid-standalone);
			}

			#template-messages {
				margin-top: var(--uui-size-space-2);
			}

			#configuration-messages,
			#form-missing {
				margin-top: var(--uui-size-space-4);
			}
		`,
	];
}

export { FormulateLayoutWorkspaceViewDesignElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-layout-workspace-view-design': FormulateLayoutWorkspaceViewDesignElement;
	}
}
