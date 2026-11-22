import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import umbracoPackage from '../../public/umbraco-package.json';

/** The Formulate section's dashboard: what each tree is for, and the installed version. */
@customElement('formulate-welcome-dashboard')
export class FormulateWelcomeDashboardElement extends UmbLitElement {
	override render() {
		return html`
			<uui-box headline=${this.localize.term('formulate_welcomeHeadline')}>
				<span slot="header-actions" id="version">
					${this.localize.term('formulate_version', umbracoPackage.version)}
				</span>
				<p>${this.localize.term('formulate_welcomeIntroduction')}</p>
				<ul>
					<li>${this.localize.term('formulate_welcomeForms')}</li>
					<li>${this.localize.term('formulate_welcomeDataValues')}</li>
					<li>${this.localize.term('formulate_welcomeValidationLibrary')}</li>
				</ul>
				<p>${this.localize.term('formulate_welcomeShowForm')}</p>
			</uui-box>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
				padding: var(--uui-size-layout-1);
			}

			uui-box {
				max-width: 800px;
			}

			p:first-of-type {
				margin-top: 0;
			}

			p:last-child {
				margin-bottom: 0;
			}

			#version {
				color: var(--uui-color-text-alt);
			}
		`,
	];
}

export default FormulateWelcomeDashboardElement;

declare global {
	interface HTMLElementTagNameMap {
		'formulate-welcome-dashboard': FormulateWelcomeDashboardElement;
	}
}
