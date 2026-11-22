import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { FormulateEmailHandlerEditorElementBase } from './email-handler-editor-base.js';
import { FORMULATE_SAMPLE_EMAIL_VIEWS } from './email-view-paths.js';

/**
 * The editor of the Designed Email handler (DesignedEmailConfiguration): the settings of an email that the
 * handler reads, and the views that write its subject and body. The built-in samples' paths are offered as
 * hints. The Email handler's own settings (which values are added, and how) are not shown, as the views
 * decide what the email says.
 */
@customElement('formulate-designed-email-handler-editor')
export class FormulateDesignedEmailHandlerEditorElement extends FormulateEmailHandlerEditorElementBase {
	override render() {
		return html`
			${this.renderEmailSettings()}
			${this.renderText(
				'subject-view',
				'subjectRazorPath',
				'formulate_subjectView',
				this.localize.term('formulate_subjectViewDescription', FORMULATE_SAMPLE_EMAIL_VIEWS.subject),
			)}
			${this.renderText(
				'html-view',
				'htmlEmailRazorPath',
				'formulate_htmlView',
				this.localize.term('formulate_htmlViewDescription', FORMULATE_SAMPLE_EMAIL_VIEWS.html),
			)}
			${this.renderText(
				'text-view',
				'textEmailRazorPath',
				'formulate_textView',
				this.localize.term('formulate_textViewDescription', FORMULATE_SAMPLE_EMAIL_VIEWS.text),
			)}
		`;
	}
}

export { FormulateDesignedEmailHandlerEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-designed-email-handler-editor': FormulateDesignedEmailHandlerEditorElement;
	}
}
