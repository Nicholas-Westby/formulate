import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import './kind-item-workspace-header.element.js';

/**
 * The editor of a validation or data values workspace: Umbraco's entity detail workspace editor (header,
 * views, footer with the breadcrumb, actions and Save) with the item's name and alias in the header.
 */
@customElement('formulate-kind-item-workspace-editor')
export class FormulateKindItemWorkspaceEditorElement extends UmbLitElement {
	override render() {
		return html`
			<umb-entity-detail-workspace-editor>
				<formulate-kind-item-workspace-header slot="header"></formulate-kind-item-workspace-header>
			</umb-entity-detail-workspace-editor>
		`;
	}

	static override styles = [
		css`
			:host {
				display: block;
				width: 100%;
				height: 100%;
			}
		`,
	];
}

export default FormulateKindItemWorkspaceEditorElement;

declare global {
	interface HTMLElementTagNameMap {
		'formulate-kind-item-workspace-editor': FormulateKindItemWorkspaceEditorElement;
	}
}
