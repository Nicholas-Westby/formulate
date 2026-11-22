import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { createExtensionApiByAlias } from '@umbraco-cms/backoffice/extension-registry';
import { css, customElement, html, nothing, property, state } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import type { UmbPropertyEditorUiElement } from '@umbraco-cms/backoffice/property-editor';
import type { UmbItemRepository } from '@umbraco-cms/backoffice/repository';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UMB_TREE_PICKER_MODAL, type UmbTreeRepository } from '@umbraco-cms/backoffice/tree';
import { linkEntityExpansionEntries } from '@umbraco-cms/backoffice/utils';
import { UMB_VALIDATION_EMPTY_LOCALIZATION_KEY, UmbFormControlMixin } from '@umbraco-cms/backoffice/validation';
import {
	FORMULATE_FORMS_TREE_ALIAS,
	FORMULATE_FORMS_TREE_REPOSITORY_ALIAS,
	FORMULATE_ITEM_REPOSITORY_ALIAS,
	FORMULATE_LAYOUT_ENTITY_TYPE,
} from '../../constants.js';
import type { FormulateItemModel } from '../../core/item/types.js';
import {
	createLayoutPickableFilter,
	readPickedLayoutId,
	toPropertyValue,
	type FormLayoutPickerValue,
} from './form-layout-picker-value.js';

/** What the picker shows of the picked layout; undefined from requestLayout when it does not exist. */
interface PickedLayout {
	name: string;
	formName: string | null;
}

/** What picking gives: the layout's ID, and its names when the picker knew them. */
interface PickedChoice {
	id: string;
	layout?: PickedLayout;
}

/**
 * The Form Layout Picker property editor: shows the picked layout as a ref (the form's name, with the
 * layout's name under it) with a remove button, or a Choose button that opens the Forms tree, where only layouts can be picked. The
 * value is { id } (the layout's ID), or undefined when nothing is picked.
 */
@customElement('formulate-form-layout-picker')
export class FormulateFormLayoutPickerElement
	extends UmbFormControlMixin<FormLayoutPickerValue | undefined, typeof UmbLitElement>(UmbLitElement, undefined)
	implements UmbPropertyEditorUiElement
{
	@property({ attribute: false })
	override set value(value: FormLayoutPickerValue | undefined) {
		super.value = readPickedLayoutId(value) === undefined ? undefined : (value as FormLayoutPickerValue);
		void this.#show(readPickedLayoutId(value));
	}
	override get value(): FormLayoutPickerValue | undefined {
		return super.value;
	}

	@property({ type: Boolean, reflect: true })
	readonly = false;

	@property({ type: Boolean })
	mandatory?: boolean;

	@property({ type: String })
	mandatoryMessage?: string = UMB_VALIDATION_EMPTY_LOCALIZATION_KEY;

	@state()
	private _layout?: PickedLayout;

	@state()
	private _status: 'none' | 'loading' | 'found' | 'missing' = 'none';

	constructor() {
		super();
		this.addValidator(
			'valueMissing',
			() => this.mandatoryMessage ?? UMB_VALIDATION_EMPTY_LOCALIZATION_KEY,
			() => !this.readonly && !!this.mandatory && readPickedLayoutId(this.value) === undefined,
		);
	}

	/** Reads the picked layout's name, and its form's. Overridden by tests. */
	protected async requestLayout(id: string): Promise<PickedLayout | undefined> {
		const repository = await createExtensionApiByAlias<UmbItemRepository<FormulateItemModel>>(
			this,
			FORMULATE_ITEM_REPOSITORY_ALIAS,
		);
		const { data } = await repository.requestItems([id]);
		const item = data?.find((candidate) => candidate.unique === id && candidate.entityType === FORMULATE_LAYOUT_ENTITY_TYPE);

		return item ? { name: item.name, formName: item.parentName } : undefined;
	}

	/** Lets the user pick a layout in the Forms tree. Overridden by tests. */
	protected async pickLayoutId(current: string | undefined): Promise<PickedChoice | undefined> {
		const seen = new Map<string, { name: string; parent: string | null }>();
		const ancestors = current ? await this.#requestAncestors(current) : [];
		const picked = await umbOpenModal(this, UMB_TREE_PICKER_MODAL, {
			data: {
				treeAlias: FORMULATE_FORMS_TREE_ALIAS,
				hideTreeRoot: true,
				treeExpansion: ancestors.length ? linkEntityExpansionEntries(ancestors) : undefined,
				pickableFilter: createLayoutPickableFilter((item) => {
					if (item.unique !== null && 'name' in item) {
						seen.set(item.unique, { name: item.name, parent: 'parent' in item ? (item.parent?.unique ?? null) : null });
					}
				}),
			},
			value: { selection: current ? [current] : [] },
		}).catch(() => undefined);

		const id = picked?.selection[0] ?? undefined;

		if (id === undefined) {
			return undefined;
		}

		// The picker showed the layout and its form, so their names are known without asking the server.
		const layout = seen.get(id);
		const form = layout?.parent ? seen.get(layout.parent) : undefined;

		return { id, layout: layout && form ? { name: layout.name, formName: form.name } : undefined };
	}

	/** The form and folders the layout is in, so the picker opens them. */
	async #requestAncestors(layoutId: string): Promise<Array<UmbEntityModel>> {
		try {
			const repository = await createExtensionApiByAlias<UmbTreeRepository>(this, FORMULATE_FORMS_TREE_REPOSITORY_ALIAS);
			const { data } = await repository.requestTreeItemAncestors({
				treeItem: { unique: layoutId, entityType: FORMULATE_LAYOUT_ENTITY_TYPE },
			});

			return data?.filter((item) => item.unique !== layoutId) ?? [];
		} catch {
			// Opening the layout's folders is a convenience: without them, the picker still works.
			return [];
		}
	}

	/** The names of the layout the user has just picked, so showing it needs no request. */
	#known?: { id: string; layout: PickedLayout };

	async #show(id: string | undefined) {
		if (id !== undefined && this.#known?.id === id) {
			this._layout = this.#known.layout;
			this._status = 'found';
			this.#known = undefined;
			return;
		}

		this.#known = undefined;
		this._layout = undefined;
		this._status = id === undefined ? 'none' : 'loading';

		if (id === undefined) {
			return;
		}

		let layout: PickedLayout | undefined;

		try {
			layout = await this.requestLayout(id);
		} catch {
			layout = undefined;
		}

		// The value changed while the layout was read.
		if (readPickedLayoutId(this.value) !== id) {
			return;
		}

		this._layout = layout;
		this._status = layout ? 'found' : 'missing';
	}

	async #choose() {
		const choice = await this.pickLayoutId(readPickedLayoutId(this.value));

		if (choice !== undefined) {
			this.#known = choice.layout ? { id: choice.id, layout: choice.layout } : undefined;
			this.#change(toPropertyValue(choice.id));
		}
	}

	#change(value: FormLayoutPickerValue | undefined) {
		this.value = value;
		this.dispatchEvent(new UmbChangeEvent());
	}

	override render() {
		return html`${this.#renderPicked()}${this.#renderChoose()}`;
	}

	#renderPicked() {
		const id = readPickedLayoutId(this.value);

		if (id === undefined) {
			return nothing;
		}

		const missing = this._status === 'missing';
		// As core's refs: the form's name, and the layout's under it.
		const name = this._layout?.formName ?? this._layout?.name ?? (missing ? this.localize.term('formulate_layoutNotFound') : '');
		const detail = this._layout?.formName ? this._layout.name : missing ? id : '';

		return html`
			<uui-ref-list>
				<uui-ref-node
					name=${name}
					detail=${detail}
					?error=${missing}
					?readonly=${this.readonly}
					standalone>
					<uui-icon slot="icon" name="icon-layout"></uui-icon>
					${this.readonly
						? nothing
						: html`
								<uui-action-bar slot="actions">
									<uui-button
										label=${this.localize.term('general_remove')}
										@click=${() => this.#change(undefined)}></uui-button>
								</uui-action-bar>
							`}
				</uui-ref-node>
			</uui-ref-list>
		`;
	}

	#renderChoose() {
		if (readPickedLayoutId(this.value) !== undefined || this.readonly) {
			return nothing;
		}

		return html`
			<uui-button
				id="btn-add"
				look="placeholder"
				label=${this.localize.term('general_choose')}
				@click=${() => this.#choose()}></uui-button>
		`;
	}

	static override styles = [
		UmbTextStyles,
		css`
			#btn-add {
				display: block;
			}
		`,
	];
}

export { FormulateFormLayoutPickerElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-form-layout-picker': FormulateFormLayoutPickerElement;
	}
}
