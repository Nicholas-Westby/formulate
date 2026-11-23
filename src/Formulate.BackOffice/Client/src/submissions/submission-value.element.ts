import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';

/**
 * The longest word, in characters, that a value keeps whole. A value with a longer one (an email address, a file
 * name, a page's address) may break anywhere; a value of shorter words, such as "Support", wraps only between them.
 */
export const LONGEST_WHOLE_WORD = 12;

/**
 * A value in the submissions table, in the Page, field and Files columns, as a person reads it at a glance. It wraps,
 * breaking a long word (an email address, a file name, a page's address) anywhere it must, so no value pushes the
 * table past its box, and it shows at most three lines, ending with "…" when they cut it. A value whose words are all
 * short wraps only between them, so a narrow table never splits a word like "Support": a table makes a column no
 * narrower than the longest word its values keep whole. Its lines are at most 16em long: a table shares its width
 * out by how long each column's values are on one line, so one long value would otherwise take the width the other
 * columns need. Three such lines hold the 100 characters the table keeps of a value. Hovering a value the lines cut
 * shows it as a title; the sidebar shows every value in full. The table draws its cells in a shadow root of its own,
 * where the view's styles do not reach, so the value brings its own. The text goes in its slot.
 */
@customElement('formulate-submission-value')
export class FormulateSubmissionValueElement extends UmbLitElement {
	/** Marks a value that has a word too long to keep whole, as the text changes (the table reuses its cells). */
	#observer = new MutationObserver(() => this.#markLongWord());

	constructor() {
		super();
		// Whether the lines cut the value depends on how wide the window makes the column, so it is measured on hover.
		this.addEventListener('mouseenter', () => this.#titleWhenCut());
	}

	override connectedCallback() {
		super.connectedCallback();
		this.#markLongWord();
		this.#observer.observe(this, { childList: true, characterData: true, subtree: true });
	}

	override disconnectedCallback() {
		super.disconnectedCallback();
		this.#observer.disconnect();
	}

	#markLongWord() {
		const words = (this.textContent ?? '').split(/\s+/);
		this.toggleAttribute('long-word', words.some((word) => [...word].length > LONGEST_WHOLE_WORD));
	}

	#titleWhenCut() {
		if (this.scrollHeight > this.clientHeight) {
			this.title = this.textContent?.trim() ?? '';
		} else {
			this.removeAttribute('title');
		}
	}

	override render() {
		return html`<slot></slot>`;
	}

	static override styles = css`
		:host {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
			overflow: hidden;
			overflow-wrap: break-word;
			max-width: 16em;
		}

		:host([long-word]) {
			overflow-wrap: anywhere;
		}
	`;
}

export { FormulateSubmissionValueElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-submission-value': FormulateSubmissionValueElement;
	}
}
