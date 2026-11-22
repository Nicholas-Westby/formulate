import { css, customElement, html, nothing, repeat } from '@umbraco-cms/backoffice/external/lit';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UmbSelectionManager } from '@umbraco-cms/backoffice/utils';
import type {
	FormulatePickFieldsModalData,
	FormulatePickFieldsModalValue,
	FormulatePickFieldsOption,
} from './pick-fields-modal.token.js';

/**
 * The dialog that picks fields of a form (Formulate.Modal.PickFields), laid out as Umbraco's language picker:
 * each field as a menu item that is picked or not, with its alias beside its name, then Submit or Close. The
 * fields picked when it opens show as picked. An item is named with the alias too, as two fields can share a name.
 */
@customElement('formulate-pick-fields-modal')
export class FormulatePickFieldsModalElement extends UmbModalBaseElement<FormulatePickFieldsModalData, FormulatePickFieldsModalValue> {
	#selection = new UmbSelectionManager<string>(this);

	override connectedCallback() {
		super.connectedCallback();
		this.#selection.setSelectable(true);
		this.#selection.setMultiple(true);
		this.#selection.setSelection(this.value?.selection ?? []);
		this.observe(this.#selection.selection, (selection) => (this.value = { selection: [...selection] }), '_observeSelection');
	}

	override render() {
		const fields = this.data?.fields ?? [];

		return html`
			<umb-body-layout headline=${this.data?.headline ?? ''}>
				<uui-box>
					${fields.length
						? repeat(fields, (field) => field.id, (field) => this.#renderField(field))
						: html`<p id="no-fields">${this.localize.term('formulate_noFieldsToPick')}</p>`}
				</uui-box>
				<div slot="actions">
					<uui-button id="close" label=${this.localize.term('general_close')} @click=${this._rejectModal}></uui-button>
					<uui-button
						id="submit"
						label=${this.localize.term('general_submit')}
						look="primary"
						color="positive"
						@click=${this._submitModal}></uui-button>
				</div>
			</umb-body-layout>
		`;
	}

	#renderField(field: FormulatePickFieldsOption) {
		return html`
			<uui-menu-item
				label=${this.localize.term('formulate_fieldAndAlias', field.name, field.alias)}
				selectable
				?selected=${this.value?.selection.includes(field.id)}
				@selected=${() => this.#selection.select(field.id)}
				@deselected=${() => this.#selection.deselect(field.id)}>
				${field.icon ? html`<umb-icon slot="icon" name=${field.icon}></umb-icon>` : nothing}
				<span slot="label" class="label">
					<span class="name">${field.name}</span>
					${field.alias ? html`<span class="alias">${field.alias}</span>` : nothing}
				</span>
			</uui-menu-item>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			.label {
				display: flex;
				align-items: baseline;
				gap: var(--uui-size-space-3);
				min-width: 0;
			}

			/* The name's color, lighter, so it stays readable on a selected item too. */
			.alias {
				color: inherit;
				opacity: 0.75;
				font-size: var(--uui-type-small-size);
			}

			#no-fields {
				margin: 0;
			}
		`,
	];
}

export { FormulatePickFieldsModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-pick-fields-modal': FormulatePickFieldsModalElement;
	}
}
