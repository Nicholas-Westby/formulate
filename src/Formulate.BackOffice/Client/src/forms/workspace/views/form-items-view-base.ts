import { css, html, nothing, repeat, state, type TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import type { Observable } from '@umbraco-cms/backoffice/external/rxjs';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { umbConfirmModal, umbOpenModal } from '@umbraco-cms/backoffice/modal';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../../../core/definitions.context-token.js';
import { FormulateIconNames } from '../../../core/icon-names.js';
import type { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import { isSameKind } from '../../../core/kind-id.js';
import { FORMULATE_SORTABLE_STYLES, FormulateKeyboardSorter } from '../../../core/sortable/keyboard-sorter.js';
import { FORMULATE_PICK_KIND_MODAL } from '../../modals/pick-kind/pick-kind-modal.token.js';
import { FORMULATE_FORM_WORKSPACE_CONTEXT } from '../form-workspace.context-token.js';
import type { FormulateFormWorkspaceContext } from '../form-workspace.context.js';

/** What a row shows of a field or handler. */
export interface FormulateFormItem {
	id: string;
	kindId: string;
	name: string | null;
	alias: string | null;
}

/** What a row shows of the kind of a field or handler, and what a new one starts from. */
export interface FormulateFormItemKind {
	kindId: string;
	name: string;
	icon: string;
	category: string;
	defaultConfiguration?: unknown;
}

/** The texts of a view, as localization keys. */
export interface FormulateFormItemsViewTexts {
	/** The Add button, and the headline of the dialog that picks the new item's kind. */
	add: string;
	/** The headline of the dialog that confirms a delete. */
	deleteHeadline: string;
	/** What that dialog asks, given the item's name. */
	confirmDelete: string;
	/** The identifier of the view's sorter: rows can only be dragged between lists with the same one. */
	sorterIdentifier: string;
	/** The icon of an item whose kind's icon the back office has not got. */
	fallbackIcon: string;
}

/** The icon of an item whose kind is not installed. */
const UNKNOWN_KIND_ICON = 'icon-alert';

/**
 * A view of the form workspace that lists the form's fields or handlers, as Umbraco's lists of picked items
 * show them: a row for each, with its kind's icon, its name and alias, its kind's name, and Edit and Delete.
 * The rows are put in order by dragging their handles, or with the keyboard (FormulateKeyboardSorter).
 * Add asks for the kind of the new item, then opens its dialog; Edit opens the dialog of a copy of the item;
 * Delete asks first. Each change goes to the workspace, which saves it with the form.
 */
export abstract class FormulateFormItemsViewElement<Item extends FormulateFormItem, Kind extends FormulateFormItemKind> extends UmbLitElement {
	@state()
	protected _items: ReadonlyArray<Item> = [];

	/** The kinds of the items; none until they have been read. */
	@state()
	private _kinds: ReadonlyArray<Kind> = [];

	#icons = new FormulateIconNames(this);

	protected _workspace?: FormulateFormWorkspaceContext;
	#definitions?: FormulateDefinitionsContext;

	#sorter: UmbSorterController<Item, HTMLElement>;

	#keyboard = new FormulateKeyboardSorter(this, {
		getKeys: () => this._items.map((item) => item.id),
		move: (key, to) => this.moveItem(key, to),
		getHandle: (key) => this.shadowRoot?.querySelector<HTMLElement>(`.row[data-key="${key}"] .handle`),
		isReadonly: () => false,
	});

	/** The texts of the view. */
	protected readonly texts: FormulateFormItemsViewTexts;

	constructor(texts: FormulateFormItemsViewTexts) {
		super();
		this.texts = texts;

		this.#sorter = new UmbSorterController<Item, HTMLElement>(this, {
			getUniqueOfElement: (element) => element.dataset.key,
			getUniqueOfModel: (item) => item.id,
			identifier: texts.sorterIdentifier,
			itemSelector: '.row',
			containerSelector: '#rows',
			handleSelector: '.handle',
			onChange: ({ model }) => this.setItems(model),
		});

		this.consumeContext(FORMULATE_FORM_WORKSPACE_CONTEXT, (workspace) => {
			this._workspace = workspace;
			this.observe(
				workspace ? this.observeItems(workspace) : undefined,
				(items) => {
					this._items = items ?? [];
					this.#sorter.setModel([...this._items]);
					this.#keyboard.putDownIfGone();
				},
				'_formulateObserveItems',
			);
		});

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, (definitions) => {
			this.#definitions = definitions;
			this.observe(definitions ? this.observeKinds(definitions) : undefined, (kinds) => (this._kinds = kinds ?? []), '_formulateObserveKinds');
		});
	}

	/** The items, as the workspace has them. */
	protected abstract observeItems(workspace: FormulateFormWorkspaceContext): Observable<ReadonlyArray<Item>>;

	/** The kinds of the items. */
	protected abstract observeKinds(definitions: FormulateDefinitionsContext): Observable<ReadonlyArray<Kind>>;

	/** Reads the kinds of the items, once they are read. */
	protected abstract requestKinds(definitions: FormulateDefinitionsContext): Promise<ReadonlyArray<Kind>>;

	/** A new item of a kind. */
	protected abstract newItem(kind: Kind): Item;

	/**
	 * Opens the dialog of an item.
	 * @returns The item as edited, or undefined when the dialog was closed.
	 */
	protected abstract openItem(item: Item, isNew: boolean): Promise<Item | undefined>;

	protected abstract addItem(item: Item): void;
	protected abstract updateItem(item: Item): void;
	protected abstract removeItem(id: string): void;
	protected abstract setItems(items: ReadonlyArray<Item>): void;
	protected abstract moveItem(id: string, index: number): void;

	/** Tags shown after the kind's name, such as how many validations a field has. */
	protected renderTags(_item: Item): TemplateResult | typeof nothing {
		return nothing;
	}

	/**
	 * What a row shows after the item's name, such as whether a handler is enabled.
	 * @param _item The item.
	 * @param _position The item's position, from 1, to name it by when it has no name.
	 */
	protected renderRowContent(_item: Item, _position: number): TemplateResult | typeof nothing {
		return nothing;
	}

	/**
	 * What the dialogs of the items are given of the form: its fields, and its ID once it is saved (the
	 * server has no form with the ID of a new one).
	 */
	protected formOfItems() {
		const formId = this._workspace?.getIsNew() === false ? this._workspace.getUnique() : undefined;

		return { formFields: this._workspace?.getFields() ?? [], ...(formId ? { formId } : {}) };
	}

	#kindOf(item: Item) {
		return this._kinds.find((kind) => isSameKind(kind.kindId, item.kindId));
	}

	/**
	 * The icon of an item's kind, or of a kind the back office has no icon for; an alert for a kind that is
	 * not installed. None until the kinds and the back office's icons are known.
	 */
	#iconOf(kind: Kind | undefined) {
		if (!this._kinds.length) {
			return undefined;
		}

		return kind ? this.#icons.choose(kind.icon, this.texts.fallbackIcon) : this.#icons.choose(UNKNOWN_KIND_ICON, UNKNOWN_KIND_ICON);
	}

	#nameOf(item: Item) {
		return item.name || this.localize.term('formulate_unnamed');
	}

	async #add() {
		const definitions = this.#definitions ?? (await this.getContext(FORMULATE_DEFINITIONS_CONTEXT).catch(() => undefined));
		const kinds = definitions ? await this.requestKinds(definitions) : [];
		const picked = await umbOpenModal(this, FORMULATE_PICK_KIND_MODAL, {
			data: {
				headline: this.localize.term(this.texts.add),
				kinds: kinds.map(({ kindId, name, icon, category }) => ({
					kindId,
					name,
					icon: this.#icons.choose(icon, this.texts.fallbackIcon) ?? icon,
					category,
				})),
			},
		}).catch(() => undefined);
		const kind = picked && kinds.find((candidate) => candidate.kindId === picked.kindId);

		if (!kind) {
			return;
		}

		const item = await this.openItem(this.newItem(kind), true);

		if (item) {
			this.addItem(item);
		}
	}

	async #edit(item: Item) {
		const edited = await this.openItem(structuredClone(item), false);

		if (edited) {
			this.updateItem(edited);
		}
	}

	async #delete(item: Item) {
		const confirmed = await umbConfirmModal(this, {
			headline: this.localize.term(this.texts.deleteHeadline),
			content: this.localize.term(this.texts.confirmDelete, item.name ?? ''),
			color: 'danger',
			confirmLabel: this.localize.term('general_delete'),
		}).then(
			() => true,
			() => false,
		);

		if (confirmed) {
			this.removeItem(item.id);
		}
	}

	override render() {
		return html`
			<uui-box>
				<!-- Always there, even empty: the sorter looks for it once the view is shown. With nothing but the
				rows in it, an empty list is :empty, which hides it. -->
				<uui-ref-list id="rows">${repeat(this._items, (item) => item.id, (item, index) => this.#renderRow(item, index + 1))}</uui-ref-list>
				<uui-button id="add" look="placeholder" label=${this.localize.term(this.texts.add)} @click=${() => this.#add()}></uui-button>
				${this.#keyboard.renderStatus()}
			</uui-box>
		`;
	}

	#renderRow(item: Item, position: number) {
		const kind = this.#kindOf(item);
		const name = this.#nameOf(item);
		const icon = this.#iconOf(kind);
		const kindsKnown = this._kinds.length > 0;

		return html`
			<div class="row" data-key=${item.id} ?data-picked-up=${this.#keyboard.pickedUp === item.id}>
				${this.#keyboard.renderHandle(item.id, this.localize.term('formulate_moveItem', item.name ?? '', position))}
				<uui-ref-node name=${name} detail=${item.alias ?? ''} @open=${() => this.#edit(item)}>
					${icon ? html`<umb-icon slot="icon" name=${icon}></umb-icon>` : nothing} ${this.renderRowContent(item, position)}
					${kindsKnown
						? html`<uui-tag slot="tag" size="s" look="secondary">${kind?.name ?? this.localize.term('formulate_unknownKind')}</uui-tag>`
						: nothing}
					${this.renderTags(item)}
					<!-- A screen reader hears which item each action is for. -->
					<uui-action-bar slot="actions">
						<uui-button
							label=${this.localize.term('general_edit')}
							aria-label=${this.localize.term('formulate_editItem', item.name ?? '', position)}
							@click=${() => this.#edit(item)}>
							<uui-icon name="icon-edit"></uui-icon>
						</uui-button>
						<uui-button
							label=${this.localize.term('general_delete')}
							aria-label=${this.localize.term('formulate_deleteItem', item.name ?? '', position)}
							@click=${() => this.#delete(item)}>
							<uui-icon name="icon-trash"></uui-icon>
						</uui-button>
					</uui-action-bar>
				</uui-ref-node>
			</div>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SORTABLE_STYLES,
		css`
			:host {
				display: block;
				padding: var(--uui-size-layout-1);
			}

			#rows:empty {
				display: none;
			}

			#rows {
				margin-bottom: var(--uui-size-space-4);
			}

			.row {
				position: relative;
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-2);
			}

			uui-ref-node {
				flex: 1 1 auto;
				min-width: 0;
			}

			uui-tag {
				white-space: nowrap;
			}

			#add {
				display: block;
			}
		`,
	];
}
