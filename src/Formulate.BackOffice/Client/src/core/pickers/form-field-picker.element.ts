import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { css, customElement, html, nothing, property } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type { FormFieldDefinitionModel } from '../../api/index.js';
import { isSameGuid } from '../guid.js';
import { findField, FormulateFormFieldKinds, pickFormFields, type FormulatePickableField } from './form-field-kinds.js';
import type { FormulatePickFieldsModalData } from './pick-fields-modal.token.js';

/**
 * Picks fields of the form being edited, such as the fields an email includes: the value is the picked
 * fields' IDs, as they are stored. Each picked field shows as a ref (its name, its alias under it, its kind's
 * icon) with a Remove button, and Choose opens a dialog of the form's fields. A field that is no longer on
 * the form says so, with its ID, and can be removed. The fields come from the form as the designer holds it,
 * so fields that are not saved yet can be picked. A setting that only some fields fit, such as the fields an
 * email can write a line for, gives offers: the dialog leaves out the other fields, except those picked already.
 */
@customElement('formulate-form-field-picker')
export class FormulateFormFieldPickerElement extends UmbLitElement {
	/** The form's fields. */
	@property({ attribute: false })
	fields: ReadonlyArray<FormulatePickableField> = [];

	/** The IDs of the picked fields, as they are stored. */
	@property({ attribute: false })
	value: ReadonlyArray<string> = [];

	/** The headline of the dialog, such as the name of the setting. */
	@property()
	headline = '';

	/** Whether nothing may be changed. */
	@property({ type: Boolean, reflect: true })
	readonly = false;

	/**
	 * Which fields the dialog offers, by each field and the definition of its kind (undefined when the kind is not
	 * installed); a field picked already is offered all the same. Until the kinds are known, every field is.
	 */
	@property({ attribute: false })
	offers?: (field: FormulatePickableField, definition: FormFieldDefinitionModel | undefined) => boolean;

	#kinds = new FormulateFormFieldKinds(this);

	/**
	 * Lets the user pick in the dialog. Overridden by tests.
	 * @param data What the dialog shows.
	 * @param selection The IDs of the fields picked now.
	 * @returns The dialog's whole selection, or undefined when it was closed without one.
	 */
	protected pickIds(data: FormulatePickFieldsModalData, selection: Array<string>): Promise<Array<string> | undefined> {
		return pickFormFields(this, data, selection);
	}

	#store(ids: Array<string>) {
		this.value = ids;
		this.dispatchEvent(new UmbChangeEvent());
	}

	async #choose() {
		const current = this.value ?? [];
		// The dialog knows the fields by the form's own IDs, which may be written another way than the stored ones.
		const selection = current.map((id) => findField(this.fields, id)?.id).filter((id): id is string => id !== undefined);
		const offers = this.offers;
		const offered =
			offers && this.#kinds.known
				? this.fields.filter((field) => offers(field, this.#kinds.of(field)) || selection.includes(field.id))
				: this.fields;
		const picked = await this.pickIds({ headline: this.headline, fields: this.#kinds.pickOptions(offered) }, selection);

		if (!picked) {
			return;
		}

		// Those still picked keep their order, and a field that is gone stays until it is removed (the dialog
		// does not show it); those just picked follow, in the order they were picked.
		const isPicked = (id: string) => picked.some((candidate) => isSameGuid(candidate, id));
		const kept = current.filter((id) => !findField(this.fields, id) || isPicked(id));
		const added = picked.filter((id) => !current.some((candidate) => isSameGuid(candidate, id)));
		const next = [...kept, ...added];

		if (JSON.stringify(next) !== JSON.stringify(current)) {
			this.#store(next);
		}
	}

	override render() {
		const ids = this.value ?? [];

		return html`
			<!-- Not keyed by ID: a stored list can name a field twice. -->
			<uui-ref-list id="rows">${ids.map((id, index) => this.#renderField(id, index + 1))}</uui-ref-list>
			${this.readonly
				? nothing
				: html`<uui-button
						id="btn-add"
						look="placeholder"
						label=${this.localize.term('general_choose')}
						@click=${() => this.#choose()}></uui-button>`}
		`;
	}

	#renderField(id: string, position: number) {
		const field = findField(this.fields, id);
		const name = field ? this.#kinds.nameOf(field) : this.localize.term('formulate_fieldNotFound');
		const icon = this.#kinds.iconOf(field);

		return html`
			<!-- Read-only: there is nothing to open, only to remove. -->
			<uui-ref-node name=${name} detail=${field ? (field.alias ?? '') : id} ?error=${!field} readonly>
				${icon ? html`<umb-icon slot="icon" name=${icon}></umb-icon>` : nothing}
				${this.readonly
					? nothing
					: html`
							<uui-action-bar slot="actions">
								<!-- Shows Remove; a screen reader hears which field it removes. -->
								<uui-button
									label=${this.localize.term('general_remove')}
									aria-label=${this.localize.term('formulate_removeItem', field ? name : '', position)}
									@click=${() => this.#store((this.value ?? []).filter((_, index) => index !== position - 1))}></uui-button>
							</uui-action-bar>
						`}
			</uui-ref-node>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
			}

			#rows:empty {
				display: none;
			}

			#btn-add {
				display: block;
			}
		`,
	];
}

export { FormulateFormFieldPickerElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-form-field-picker': FormulateFormFieldPickerElement;
	}
}
