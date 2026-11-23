import { css, customElement, html, property } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';

/**
 * When a submission was sent, in the first column of the submissions table, as a button that opens the submission in
 * a sidebar. It looks like the name links of Umbraco's collections, as UmbTextStyles show a link, but it is a button:
 * it opens a sidebar, not a page. The table draws its cells in a shadow root of its own, where the view's styles do
 * not reach, so the button brings its own. The date goes in its slot.
 */
@customElement('formulate-submission-open-button')
export class FormulateSubmissionOpenButtonElement extends UmbLitElement {
	/** What the button does, for those who hear it, such as "Open submission 3 of 120, from …". */
	@property({ reflect: true })
	label = '';

	override render() {
		return html`<button type="button" aria-label=${this.label}><slot></slot></button>`;
	}

	static override styles = css`
		button {
			padding: 0;
			border: 0;
			background: none;
			font: inherit;
			color: var(--uui-color-interactive);
			text-align: left;
			text-decoration: underline;
			white-space: nowrap;
			cursor: pointer;
		}

		button:hover,
		button:focus {
			color: var(--uui-color-interactive-emphasis);
		}

		button:focus-visible {
			outline: 2px solid var(--uui-color-focus);
			outline-offset: 2px;
			border-radius: var(--uui-border-radius);
		}
	`;
}

export { FormulateSubmissionOpenButtonElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-submission-open-button': FormulateSubmissionOpenButtonElement;
	}
}
