import { css, customElement, html, ifDefined, repeat } from '@umbraco-cms/backoffice/external/lit';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import type { CreateOptionModel } from '../../api/index.js';
import { getFormulateTree } from '../../tree/trees.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';
import { describeCreateOption, isFolderOption } from './create-options.js';
import { getCreatePath } from './create-path.js';
import { runCreateOption } from './run-create-option.js';
import type { FormulateCreateOptionsModalData, FormulateCreateOptionsModalValue } from './create-options-modal.token.js';

/**
 * The create dialog (Formulate.Modal.CreateOptions): what can be created under a tree's root, a folder or a
 * form, laid out and behaving like Umbraco's own create dialog. A kind is a link to its workspace's create
 * route, which closes the dialog when followed. The folder opens Umbraco's folder dialog over this one; this
 * one closes once the folder is created, and stays when the folder dialog is cancelled.
 */
@customElement('formulate-create-options-modal')
export class FormulateCreateOptionsModalElement extends UmbModalBaseElement<
	FormulateCreateOptionsModalData,
	FormulateCreateOptionsModalValue
> {
	#close(option: CreateOptionModel) {
		this.value = { option };
		this._submitModal();
	}

	/** Runs an option without a link: the folder. */
	async #open(option: CreateOptionModel, tree: FormulateTreeDefinition, parent: UmbEntityModel) {
		if (await runCreateOption(this, option, tree, parent)) {
			this.#close(option);
		}
	}

	/** A kind's link opens its workspace (by the router, or in a new tab); this dialog closes, as Umbraco's does. */
	#followed(option: CreateOptionModel, href: string | undefined) {
		if (href) {
			this.#close(option);
		}
	}

	override render() {
		const parent = this.data?.parent;
		const tree = parent && getFormulateTree(parent.entityType);
		const options = this.data?.options ?? [];

		return html`
			<uui-dialog-layout headline=${this.localize.term('general_create')}>
				${tree && parent && options.length
					? html`
							<uui-ref-list>
								${repeat(
									options,
									(option) => `${option.entityType}/${option.kindId ?? ''}`,
									(option) => this.#renderOption(option, tree, parent),
								)}
							</uui-ref-list>
						`
					: html`<p id="nothing-to-create">${this.localize.term('formulate_nothingToCreate')}</p>`}
				<uui-button
					slot="actions"
					label=${this.localize.term('general_cancel')}
					@click=${() => this._rejectModal()}></uui-button>
			</uui-dialog-layout>
		`;
	}

	#renderOption(option: CreateOptionModel, tree: FormulateTreeDefinition, parent: UmbEntityModel) {
		const { name, description, icon } = describeCreateOption(option, tree);
		const href = isFolderOption(option, tree) || !option.kindId ? undefined : getCreatePath(option, parent);

		// More is asked once an option is picked (a folder name, or the new item's settings), so its name
		// ends with "...", as in Umbraco's own create dialog.
		return html`
			<umb-ref-item
				name=${`${this.localize.string(name)}...`}
				detail=${ifDefined(description ? this.localize.string(description) : undefined)}
				icon=${icon}
				href=${ifDefined(href)}
				@open=${() => this.#open(option, tree, parent)}
				@click=${() => this.#followed(option, href)}></umb-ref-item>
		`;
	}

	static override styles = [
		css`
			:host {
				max-width: 800px;
			}
		`,
	];
}

export { FormulateCreateOptionsModalElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-create-options-modal': FormulateCreateOptionsModalElement;
	}
}
