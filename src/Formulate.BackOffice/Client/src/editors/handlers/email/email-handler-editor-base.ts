import { css, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';
import type { FormulateFormFieldPickerElement } from '../../../core/pickers/form-field-picker.element.js';
import '../../../core/pickers/form-field-picker.element.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';
import { readItems } from '../../../core/sortable/sortable-rows-input.js';
import type { FormulateEmailRecipientsInputElement } from './email-recipients-input.element.js';
import './email-recipients-input.element.js';

/** How the recipients get an email, as the server reads it (EmailRecipients.For). */
type FormulateDeliveryType = 'to' | 'cc' | 'bcc';

/**
 * The delivery type the server sends with: "to" or "cc" (trimmed, in any case), and anything else "bcc", as
 * Formulate 3 did.
 * @param value The stored delivery type.
 */
export function readDeliveryType(value: unknown): FormulateDeliveryType {
	const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
	return type === 'to' || type === 'cc' ? type : 'bcc';
}

/**
 * The IDs of the fields a list of field references picks ([{ id }], FieldReference), as they are stored.
 * @param value The stored list.
 */
export function readFieldIds(value: unknown): Array<string> {
	return readItems(value)
		.map((reference) => reference.id)
		.filter((id): id is string => typeof id === 'string');
}

/**
 * Field references for picked IDs, keeping what else a reference that is still picked has.
 * @param ids The picked fields' IDs, in order.
 * @param previous The stored references.
 */
export function toFieldReferences(ids: ReadonlyArray<string>, previous: unknown): Array<Readonly<Record<string, unknown>>> {
	const references = readItems(previous);
	return ids.map((id) => references.find((reference) => reference.id === id) ?? { id });
}

/**
 * A base for the editors of the email handlers: the settings both of them read (EmailHandlerConfiguration),
 * which are who sends the email, who gets it, and its subject and message. Each change stores the whole
 * configuration again, keeping the settings the editor does not edit.
 */
export abstract class FormulateEmailHandlerEditorElementBase extends FormulateKindEditorElementBase {
	/**
	 * Stores new values of settings.
	 * @param settings The settings that change.
	 */
	protected changeSettings(settings: Record<string, unknown>) {
		this.updateValue({ ...readSettings(this.value), ...settings });
	}

	/** An input's text, as an input event gives it. */
	protected textOf(event: Event) {
		return String((event.target as HTMLInputElement).value ?? '');
	}

	/** A text setting: its label, description and input. */
	protected renderText(id: string, key: string, labelKey: string, description: string) {
		const label = this.localize.term(labelKey);

		return html`
			<umb-property-layout label=${label} description=${description} orientation="vertical">
				<uui-input
					slot="editor"
					id=${id}
					label=${label}
					.value=${readText(readSettings(this.value), key)}
					?readonly=${this.readonly}
					@input=${(event: Event) => this.changeSettings({ [key]: this.textOf(event) })}></uui-input>
			</umb-property-layout>
		`;
	}

	/** An on and off setting: its label, description and switch. */
	protected renderToggle(id: string, key: string, labelKey: string, descriptionKey: string) {
		const label = this.localize.term(labelKey);

		return html`
			<umb-property-layout label=${label} description=${this.localize.term(descriptionKey)} orientation="vertical">
				<!-- Named for screen readers only: the label beside it says the same, as Umbraco's toggles do. -->
				<uui-toggle
					slot="editor"
					id=${id}
					aria-label=${label}
					.checked=${readSettings(this.value)[key] === true}
					?readonly=${this.readonly}
					@change=${(event: Event) => this.changeSettings({ [key]: (event.target as HTMLInputElement).checked })}></uui-toggle>
			</umb-property-layout>
		`;
	}

	/** A setting of fields of the form ([{ id }]), and the picker that chooses them. */
	protected renderFieldReferences(id: string, key: string, labelKey: string, descriptionKey: string) {
		const label = this.localize.term(labelKey);
		const settings = readSettings(this.value);

		return html`
			<umb-property-layout label=${label} description=${this.localize.term(descriptionKey)} orientation="vertical">
				<formulate-form-field-picker
					slot="editor"
					id=${id}
					headline=${label}
					.fields=${this.context?.formFields ?? []}
					.value=${readFieldIds(settings[key])}
					?readonly=${this.readonly}
					@change=${(event: Event) =>
						this.changeSettings({
							[key]: toFieldReferences((event.target as FormulateFormFieldPickerElement).value, readSettings(this.value)[key]),
						})}></formulate-form-field-picker>
			</umb-property-layout>
		`;
	}

	/** The settings both email handlers read, in the order of Formulate 3's editor. */
	protected renderEmailSettings() {
		const settings = readSettings(this.value);
		const delivery = readDeliveryType(settings.deliveryType);
		const deliveryLabel = this.localize.term('formulate_deliveryType');
		const messageLabel = this.localize.term('formulate_emailMessage');

		return html`
			${this.renderText('sender-email', 'senderEmail', 'formulate_senderEmail', this.localize.term('formulate_senderEmailDescription'))}
			<umb-property-layout
				label=${this.localize.term('formulate_recipients')}
				description=${this.localize.term('formulate_recipientsDescription')}
				orientation="vertical">
				<formulate-email-recipients-input
					slot="editor"
					id="recipients"
					.value=${readItems(settings.recipients)}
					?readonly=${this.readonly}
					@change=${(event: Event) =>
						this.changeSettings({ recipients: (event.target as FormulateEmailRecipientsInputElement).value })}></formulate-email-recipients-input>
			</umb-property-layout>
			${this.renderFieldReferences('recipient-fields', 'recipientFields', 'formulate_recipientFields', 'formulate_recipientFieldsDescription')}
			<umb-property-layout label=${deliveryLabel} description=${this.localize.term('formulate_deliveryTypeDescription')} orientation="vertical">
				<uui-select
					slot="editor"
					id="delivery-type"
					label=${deliveryLabel}
					.options=${[
						{ name: this.localize.term('formulate_deliveryTo'), value: 'to', selected: delivery === 'to' },
						{ name: this.localize.term('formulate_deliveryCc'), value: 'cc', selected: delivery === 'cc' },
						{ name: this.localize.term('formulate_deliveryBcc'), value: 'bcc', selected: delivery === 'bcc' },
					]}
					?readonly=${this.readonly}
					?disabled=${this.readonly}
					@change=${(event: Event) => this.changeSettings({ deliveryType: this.textOf(event) })}></uui-select>
			</umb-property-layout>
			${this.renderText('subject', 'subject', 'formulate_emailSubject', this.localize.term('formulate_emailSubjectDescription'))}
			<umb-property-layout label=${messageLabel} description=${this.localize.term('formulate_emailMessageDescription')} orientation="vertical">
				<uui-textarea
					slot="editor"
					id="message"
					label=${messageLabel}
					rows="4"
					auto-height
					.value=${readText(settings, 'message')}
					?readonly=${this.readonly}
					@input=${(event: Event) => this.changeSettings({ message: this.textOf(event) })}></uui-textarea>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SETTINGS_STYLES,
		css`
			uui-input,
			uui-textarea,
			uui-select {
				width: 100%;
			}
		`,
	];
}
