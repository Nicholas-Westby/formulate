import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { FormulateEmailHandlerEditorElementBase } from './email-handler-editor-base.js';

/**
 * The editor of the Email handler (SendEmailConfiguration): who sends the email and who gets it, its subject
 * and message, and which of the submitted values are added below the message.
 */
@customElement('formulate-send-email-handler-editor')
export class FormulateSendEmailHandlerEditorElement extends FormulateEmailHandlerEditorElementBase {
	override render() {
		return html`
			${this.renderEmailSettings()}
			${this.renderToggle('append-fields', 'appendFields', 'formulate_appendFields', 'formulate_appendFieldsDescription')}
			${this.renderToggle('include-hidden-fields', 'includeHiddenFields', 'formulate_includeHiddenFields', 'formulate_includeHiddenFieldsDescription')}
			${this.renderToggle('exclude-field-labels', 'excludeFieldLabels', 'formulate_excludeFieldLabels', 'formulate_excludeFieldLabelsDescription')}
			${this.renderToggle('append-payload', 'appendPayload', 'formulate_appendPayload', 'formulate_appendPayloadDescription')}
			${this.renderFieldReferences('fields-to-include', 'fieldsToInclude', 'formulate_fieldsToInclude', 'formulate_fieldsToIncludeDescription')}
		`;
	}
}

export { FormulateSendEmailHandlerEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-send-email-handler-editor': FormulateSendEmailHandlerEditorElement;
	}
}
