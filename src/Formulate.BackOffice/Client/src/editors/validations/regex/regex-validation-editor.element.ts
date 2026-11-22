import { css, customElement, html, nothing, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import type { UUIInputElement } from '@umbraco-cms/backoffice/external/uui';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';
import { getPatternProblem } from './regex-pattern.js';

/**
 * The editor of the Regular Expression validation, { regex, message }: the pattern a value must match, and
 * the message shown when it does not. A pattern browsers cannot read gets a warning as it is typed; it is
 * stored all the same, as the API accepts it. Screen readers read the warning with the pattern's input, and
 * say politely when it comes, changes or goes.
 */
@customElement('formulate-regex-validation-editor')
export class FormulateRegexValidationEditorElement extends FormulateKindEditorElementBase {
	#change(settings: Record<string, unknown>) {
		this.updateValue({ ...readSettings(this.value), ...settings });
	}

	protected override async firstUpdated(changed: PropertyValues) {
		super.firstUpdated(changed);

		// The warning describes the pattern's input. uui-input keeps its input in a shadow root, which an
		// aria-describedby ID cannot reach, so the input is given the element (ARIA element reflection).
		const regex = this.shadowRoot?.querySelector<UUIInputElement>('uui-input#regex');
		await regex?.updateComplete;
		const input = regex?.shadowRoot?.querySelector('input');
		const status = this.shadowRoot?.querySelector('#pattern-status');

		if (input && status) {
			input.ariaDescribedByElements = [status];
		}
	}

	override render() {
		const settings = readSettings(this.value);
		const regex = readText(settings, 'regex');
		const problem = getPatternProblem(regex);

		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_regularExpression')}
				description=${this.localize.term('formulate_regularExpressionDescription')}>
				<div slot="editor">
					<uui-input
						id="regex"
						label=${this.localize.term('formulate_regularExpression')}
						.value=${regex}
						?readonly=${this.readonly}
						@input=${(event: Event) => this.#change({ regex: String((event.target as HTMLInputElement).value) })}></uui-input>
					<div id="pattern-status" role="status">
						${problem === undefined
							? nothing
							: html`<div id="pattern-warning">${this.localize.term('formulate_regexInvalid', problem)}</div>`}
					</div>
				</div>
			</umb-property-layout>
			<umb-property-layout
				label=${this.localize.term('formulate_errorMessage')}
				description=${this.localize.term('formulate_regexMessageDescription')}>
				<uui-input
					slot="editor"
					id="message"
					label=${this.localize.term('formulate_errorMessage')}
					.value=${readText(settings, 'message')}
					?readonly=${this.readonly}
					@input=${(event: Event) => this.#change({ message: String((event.target as HTMLInputElement).value) })}></uui-input>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			/* Full width, as Umbraco's text box property editor. */
			uui-input {
				width: 100%;
			}

			/* As Umbraco's own warnings look, such as the language workspace's. */
			#pattern-warning {
				margin-top: var(--uui-size-space-4);
				padding: var(--uui-size-space-4) var(--uui-size-space-5);
				border: 1px solid var(--uui-color-warning-standalone);
				border-radius: var(--uui-border-radius);
				background-color: var(--uui-color-warning);
				color: var(--uui-color-warning-contrast);
			}
		`,
	];
}

export { FormulateRegexValidationEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-regex-validation-editor': FormulateRegexValidationEditorElement;
	}
}
