import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import { css, html, type TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { FormulateLiveRegion } from '../live-region.js';

/** The announcements of the moves, and the ones that say where a row is instead of its place in the list. */
const PLACE_TERMS = {
	formulate_itemPickedUp: 'formulate_itemPickedUpAt',
	formulate_itemMoved: 'formulate_itemMovedTo',
	formulate_itemPutDown: 'formulate_itemPutDownAt',
	formulate_itemPutBack: 'formulate_itemPutBackAt',
} as const;

/** What the keyboard sorter needs of the list it sorts. */
export interface FormulateKeyboardSorterArgs {
	/** The keys of the rows, in their order. */
	getKeys(): ReadonlyArray<string>;
	/**
	 * Stores a row's new place; the list then shows its rows in their new order. It may refuse a place the row
	 * cannot go to by returning false, such as one above the first of several lists that the rows move through.
	 */
	move(key: string, to: number): void | boolean;
	/** The handle of a row, as the list shows it, to keep the focus on it. */
	getHandle(key: string): HTMLElement | null | undefined;
	/** Whether the rows can be moved. */
	isReadonly(): boolean;
	/**
	 * Where a row is, for the announcements of the moves, such as "row 2, cell 1, place 1 of 3". Without it,
	 * the announcements give the row's place in the list, such as "item 2 of 5".
	 */
	describePlace?(key: string): string;
}

/**
 * Lets the keyboard move the rows of a sortable list, whose handles also drag them (Umbraco's sorter): the up
 * and down arrow keys move a row, and Enter or Space picks it up and puts it down, as in other keyboard
 * sortable lists; while it is picked up, Escape puts it back where it was. Each keyboard move is announced
 * to screen readers. The list renders each row's handle with {@link renderHandle}, and the hint and the
 * announcements once with {@link renderStatus}; it includes {@link FORMULATE_SORTABLE_STYLES} in its styles
 * and marks a picked up row with the data-picked-up attribute.
 */
export class FormulateKeyboardSorter extends UmbControllerBase {
	#host: UmbLitElement;
	#args: FormulateKeyboardSorterArgs;

	/** The row picked up with the keyboard, if any. */
	#pickedUp?: string;

	/** Where the picked up row was when it was picked up, so Escape can put it back. */
	#pickedUpFrom?: number;

	/** Whether a row is being moved, which takes its handle out of the page for a moment. */
	#moving = false;

	/** What the last keyboard move did, for screen readers: said again when the same move is made twice. */
	#announcement: FormulateLiveRegion;

	constructor(host: UmbLitElement, args: FormulateKeyboardSorterArgs) {
		super(host);
		this.#host = host;
		this.#args = args;
		this.#announcement = new FormulateLiveRegion(host);
	}

	/** The row picked up with the keyboard, if any. */
	get pickedUp() {
		return this.#pickedUp;
	}

	/** Puts down the row picked up with the keyboard, such as when the list becomes read-only. */
	putDown() {
		if (this.#pickedUp !== undefined) {
			this.#pickedUp = undefined;
			this.#pickedUpFrom = undefined;
			this.#host.requestUpdate();
		}
	}

	/** Puts down the picked up row if it is no longer in the list, such as when it was removed. */
	putDownIfGone() {
		if (this.#pickedUp !== undefined && !this.#args.getKeys().includes(this.#pickedUp)) {
			this.putDown();
		}
	}

	/**
	 * The handle of a row: a button for the keyboard, and what drags the row.
	 * @param key The row.
	 * @param label What the button does, such as "Move Name".
	 * @returns The handle.
	 */
	renderHandle(key: string, label: string): TemplateResult {
		const hint = this.#host.localize.term('formulate_moveHint');

		return html`<span
			class="handle"
			role="button"
			tabindex="0"
			aria-label=${label}
			aria-describedby="move-hint"
			aria-keyshortcuts="ArrowUp ArrowDown"
			aria-pressed=${this.#pickedUp === key ? 'true' : 'false'}
			title=${hint}
			@click=${() => this.#pickUpOrPutDown(key)}
			@keydown=${(event: KeyboardEvent) => this.#onKeydown(event, key)}
			@focusout=${() => this.#onFocusOut(key)}>
			<uui-icon name="icon-grip"></uui-icon>
		</span>`;
	}

	/** The hint the handles point to, and the announcements of the moves, for screen readers. */
	renderStatus(): TemplateResult {
		return html`<span id="move-hint" hidden>${this.#host.localize.term('formulate_moveHint')}</span>
			<div id="announcement" role="status">${this.#announcement.text}</div>`;
	}

	#indexOf(key: string) {
		return this.#args.getKeys().indexOf(key);
	}

	/**
	 * Moves a row to another place, keeping the focus on its handle.
	 * @returns Whether the row moved.
	 */
	async #moveTo(key: string, to: number): Promise<boolean> {
		const from = this.#indexOf(key);

		if (from < 0 || to < 0 || to >= this.#args.getKeys().length || to === from) {
			return false;
		}

		this.#moving = true;

		try {
			if (this.#args.move(key, to) === false) {
				return false;
			}

			// Moving the row takes it out of the page for a moment, which loses the focus.
			await this.#host.updateComplete;
			this.#args.getHandle(key)?.focus();
		} finally {
			this.#moving = false;
		}

		return true;
	}

	async #move(key: string, offset: number) {
		const to = this.#indexOf(key) + offset;

		if (!this.#args.isReadonly() && (await this.#moveTo(key, to))) {
			this.#announce('formulate_itemMoved', key, to);
		}
	}

	#pickUpOrPutDown(key: string) {
		const index = this.#indexOf(key);

		if (this.#args.isReadonly() || index < 0) {
			return;
		}

		if (this.#pickedUp === key) {
			this.putDown();
			this.#announce('formulate_itemPutDown', key, index);
		} else {
			this.#pickedUp = key;
			this.#pickedUpFrom = index;
			this.#announce('formulate_itemPickedUp', key, index);
		}
	}

	async #putBack(key: string) {
		const to = this.#pickedUpFrom ?? this.#indexOf(key);
		this.putDown();
		await this.#moveTo(key, to);
		this.#announce('formulate_itemPutBack', key, this.#indexOf(key));
	}

	/**
	 * Says what a keyboard move did: with where the row is, when the list describes its places, or else with the
	 * row's place (1 for the first) and the number of rows.
	 */
	#announce(term: keyof typeof PLACE_TERMS, key: string, index: number) {
		const place = this.#args.describePlace?.(key);

		this.#announcement.say(
			place === undefined
				? this.#host.localize.term(term, index + 1, this.#args.getKeys().length)
				: this.#host.localize.term(PLACE_TERMS[term], place),
		);
		// The list shows the row that is picked up or put down.
		this.#host.requestUpdate();
	}

	#onKeydown(event: KeyboardEvent, key: string) {
		switch (event.key) {
			case 'ArrowUp':
			case 'ArrowDown':
				event.preventDefault();
				void this.#move(key, event.key === 'ArrowUp' ? -1 : 1);
				break;
			case 'Enter':
			case ' ':
				// The handle is a button, so these press it.
				event.preventDefault();
				this.#pickUpOrPutDown(key);
				break;
			case 'Escape':
				if (this.#pickedUp === key) {
					// It cancels the move only, not a dialog the list is in.
					event.preventDefault();
					event.stopPropagation();
					void this.#putBack(key);
				}
				break;
		}
	}

	#onFocusOut(key: string) {
		// A row being moved takes its handle out of the page for a moment, which is not leaving it.
		if (!this.#moving && this.#pickedUp === key) {
			this.putDown();
		}
	}
}

/**
 * The styles of a list sorted with {@link FormulateKeyboardSorter}: its handles, its announcements (for
 * screen readers only) and where a dragged row (class row) goes, as Umbraco's sortable lists show it.
 */
export const FORMULATE_SORTABLE_STYLES = css`
	.handle {
		display: inline-flex;
		flex: 0 0 var(--uui-size-6);
		align-items: center;
		justify-content: center;
		align-self: stretch;
		border-radius: var(--uui-border-radius);
		cursor: grab;
	}

	.handle:active {
		cursor: grabbing;
	}

	.handle:focus-visible {
		outline: 2px solid var(--uui-color-focus);
	}

	/* A row picked up with the keyboard, as a selected item looks. */
	[data-picked-up] .handle {
		background-color: var(--uui-color-selected);
		color: var(--uui-color-selected-contrast);
	}

	/* For screen readers only. */
	#announcement {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.row[drag-placeholder] {
		position: relative;
	}

	.row[drag-placeholder] > * {
		visibility: hidden;
	}

	.row[drag-placeholder]::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: var(--uui-border-radius);
		border: 1px dashed var(--uui-color-divider-emphasis);
	}
`;
