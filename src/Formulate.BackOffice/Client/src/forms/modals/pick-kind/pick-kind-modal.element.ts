import { css, customElement, html, repeat, state } from '@umbraco-cms/backoffice/external/lit';
import { umbFocus } from '@umbraco-cms/backoffice/lit-element';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type {
	FormulatePickKindModalData,
	FormulatePickKindModalValue,
	FormulatePickKindOption,
} from './pick-kind-modal.token.js';

/** The kinds of one category. */
interface FormulateKindGroup {
	category: string;
	kinds: Array<FormulatePickKindOption>;
}

/**
 * Groups kinds by their category, in the order the categories first come, keeping the kinds' order.
 * @param kinds The kinds.
 * @returns The groups.
 */
function groupByCategory(kinds: ReadonlyArray<FormulatePickKindOption>): Array<FormulateKindGroup> {
	const groups = new Map<string, FormulateKindGroup>();

	for (const kind of kinds) {
		const group = groups.get(kind.category) ?? { category: kind.category, kinds: [] };
		group.kinds.push(kind);
		groups.set(kind.category, group);
	}

	return [...groups.values()];
}

/**
 * The dialog that picks the kind of a new field or handler (Formulate.Modal.PickKind), laid out as Umbraco's
 * "Select editor" dialog: a filter, then the kinds as buttons with their icon and name, grouped by
 * category. The buttons are in the page's tab order, so the keyboard picks a kind as the mouse does.
 */
@customElement('formulate-pick-kind-modal')
export class FormulatePickKindModalElement extends UmbModalBaseElement<FormulatePickKindModalData, FormulatePickKindModalValue> {
	@state()
	private _filter = '';

	#pick(kind: FormulatePickKindOption) {
		this.value = { kindId: kind.kindId };
		this._submitModal();
	}

	override render() {
		const filter = this._filter.trim().toLocaleLowerCase();
		const kinds = (this.data?.kinds ?? []).filter((kind) => !filter || kind.name.toLocaleLowerCase().includes(filter));
		const groups = groupByCategory(kinds);

		return html`
			<umb-body-layout headline=${this.data?.headline ?? ''} class="uui-text">
				<uui-box>
					<uui-input
						type="search"
						id="filter"
						label=${this.localize.term('placeholders_filter')}
						placeholder=${this.localize.term('placeholders_filter')}
						@input=${(event: Event) => (this._filter = String((event.target as HTMLInputElement).value ?? ''))}
						${umbFocus()}>
						<div slot="prepend"><uui-icon name="search"></uui-icon></div>
					</uui-input>
					${groups.length
						? repeat(
								groups,
								(group) => group.category,
								(group) => html`
									<div class="category">
										<h5 class="category-name">${group.category}</h5>
										<ul class="item-grid">
											${repeat(group.kinds, (kind) => kind.kindId, (kind) => this.#renderKind(kind))}
										</ul>
									</div>
								`,
							)
						: html`<p id="nothing-found">${this.localize.term('formulate_noKindsFound')}</p>`}
				</uui-box>
				<uui-button slot="actions" id="close" label=${this.localize.term('general_close')} @click=${this._rejectModal}></uui-button>
			</umb-body-layout>
		`;
	}

	#renderKind(kind: FormulatePickKindOption) {
		return html`
			<li class="item">
				<uui-button label=${kind.name} @click=${() => this.#pick(kind)}>
					<div class="item-content">
						<umb-icon name=${kind.icon} class="icon"></umb-icon>
						<span class="label">${kind.name}</span>
					</div>
				</uui-button>
			</li>
		`;
	}

	// As Umbraco's "Select editor" dialog. Its headlines and lists are not in a box of their own, so the
	// headlines and lists here take back what Umbraco's text styles give a first child and a list.
	static override styles = [
		UmbTextStyles,
		css`
			#filter {
				width: 100%;
				margin-bottom: var(--uui-size-space-4);
			}

			uui-input [slot='prepend'] {
				display: flex;
				align-items: center;
			}

			.category h5.category-name {
				margin-top: var(--uui-size-layout-1);
			}

			.category ul.item-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
				margin: 0;
				padding: 0;
			}

			.category:not(:last-child) ul.item-grid {
				padding-bottom: var(--uui-size-space-5);
			}

			.item {
				list-style: none;
				height: 100%;
				width: 100%;
				border: 1px solid transparent;
				border-radius: var(--uui-border-radius);
				box-sizing: border-box;
				color: var(--uui-color-interactive);
			}

			.item:hover {
				background: var(--uui-color-surface-emphasis);
				color: var(--uui-color-interactive-emphasis);
				cursor: pointer;
			}

			.item uui-button {
				--uui-button-padding-left-factor: 0;
				--uui-button-padding-right-factor: 0;
				--uui-button-padding-top-factor: 0;
				--uui-button-padding-bottom-factor: 0;
				width: 100%;
				height: 100%;
			}

			.item-content {
				text-align: center;
				box-sizing: border-box;
				padding: var(--uui-size-space-2);
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: flex-start;
				height: 100%;
				width: 100%;
				word-break: break-word;
			}

			.icon {
				font-size: 2em;
				margin-bottom: var(--uui-size-space-2);
			}

			.label {
				max-width: 100%;
				min-width: 0;
				overflow: hidden;
				padding-bottom: 0.1em;
			}
		`,
	];
}

export { FormulatePickKindModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-pick-kind-modal': FormulatePickKindModalElement;
	}
}
