import { createExtensionApiByAlias } from '@umbraco-cms/backoffice/extension-registry';
import type { Observable } from '@umbraco-cms/backoffice/external/rxjs';
import { css, html, nothing, property, repeat, state, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import type { UmbItemRepository } from '@umbraco-cms/backoffice/repository';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { UMB_TREE_PICKER_MODAL, type UmbTreeItemModel, type UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import type { KindDefinitionModel } from '../../api/index.js';
import { FORMULATE_ITEM_REPOSITORY_ALIAS } from '../../constants.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../definitions.context-token.js';
import type { FormulateDefinitionsContext } from '../definitions.context.js';
import type { FormulateItemModel } from '../item/types.js';
import { isSameKind } from '../kind-id.js';
import { FORMULATE_SORTABLE_STYLES, FormulateKeyboardSorter } from '../sortable/keyboard-sorter.js';

/** What a picker shows of a picked item. */
export interface FormulatePickedItem {
	unique: string;
	name: string;
	kindId: string | null;
	icon?: string;
}

/** What a picker of one tree's items is. */
export interface FormulateTreeItemPickerArgs {
	/** The tree to pick in. */
	treeAlias: string;
	/** The entity type of the items that can be picked (not their folders). */
	entityType: string;
	/** Whether more than one item can be picked; they can then be put in order. */
	multiple: boolean;
	/** The icon of an item, when the item does not say. */
	icon: string;
	/** The localization key of the name shown for an item that no longer exists. */
	notFoundKey: string;
	/** The definitions of the items' kinds, to name each item's kind. */
	kinds: (definitions: FormulateDefinitionsContext) => Observable<Array<KindDefinitionModel>>;
	/** Only items of lists with the same identifier can be dragged between them. */
	sorterIdentifier: string;
}

/**
 * The tree picker's filter: only items of one entity type can be picked. Folders can be opened, to reach
 * the items inside them, but not picked; neither can the tree's root.
 * @param entityType The entity type of the items.
 * @returns The filter.
 */
export function createPickableFilter(entityType: string): (item: UmbTreeItemModel | UmbTreeRootModel) => boolean {
	return (item) => item.unique !== null && item.entityType === entityType;
}

/**
 * A picker of items of one tree, such as validations: the picked items as refs (the item's name, with its
 * kind's name under it) with a remove button, and a Choose button that opens Umbraco's tree picker on the
 * tree, where only items (not folders) can be picked. An item that no longer exists says so and can be
 * removed. An item that could not be read (the server could not be reached, say) says that instead, not
 * that it is gone, and is read again at the next update. Several items can be put in order by dragging
 * their handles or with the keyboard.
 */
export abstract class FormulateTreeItemPickerElement extends UmbLitElement {
	/** Whether nothing may be changed. */
	@property({ type: Boolean, reflect: true })
	readonly = false;

	/** The items read so far: null for an item that no longer exists. */
	@state()
	private _items: ReadonlyMap<string, FormulatePickedItem | null> = new Map();

	/** The items whose last read failed: neither read nor known to be gone. */
	@state()
	private _unread: ReadonlySet<string> = new Set();

	@state()
	private _kinds: ReadonlyArray<KindDefinitionModel> = [];

	#args: FormulateTreeItemPickerArgs;
	#reading = new Set<string>();
	#shownIds = '';
	#repository?: Promise<UmbItemRepository<FormulateItemModel>>;
	#sorter?: UmbSorterController<string, HTMLElement>;

	#keyboard = new FormulateKeyboardSorter(this, {
		getKeys: () => this.getIds(),
		move: (key, to) => {
			const ids = [...this.getIds()];
			ids.splice(to, 0, ...ids.splice(ids.indexOf(key), 1));
			this.setIds(ids);
		},
		getHandle: (key) => this.shadowRoot?.querySelector<HTMLElement>(`.row[data-key="${key}"] .handle`),
		isReadonly: () => this.readonly,
	});

	constructor(args: FormulateTreeItemPickerArgs) {
		super();
		this.#args = args;

		if (args.multiple) {
			this.#sorter = new UmbSorterController<string, HTMLElement>(this, {
				getUniqueOfElement: (element) => element.dataset.key,
				getUniqueOfModel: (id) => id,
				identifier: args.sorterIdentifier,
				itemSelector: '.row',
				containerSelector: '#rows',
				handleSelector: '.handle',
				disabledItemSelector: '[data-readonly]',
				onChange: ({ model }) => {
					if (!this.readonly) {
						this.setIds(model);
					}
				},
			});
		}

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, (definitions) => {
			this.observe(definitions ? args.kinds(definitions) : undefined, (kinds) => (this._kinds = kinds ?? []), '_observeKinds');
		});
	}

	/** The picked items' IDs, in order. */
	protected abstract getIds(): ReadonlyArray<string>;

	/** Stores new picked items, as the user changed them, and says the value changed. */
	protected abstract setIds(ids: ReadonlyArray<string>): void;

	/**
	 * Reads items by their IDs. Overridden by tests.
	 * @returns The items that exist; those that do not are left out.
	 * @throws When the items could not be read, such as when the server could not be reached.
	 */
	protected async requestItems(ids: ReadonlyArray<string>): Promise<Array<FormulatePickedItem>> {
		this.#repository ??= createExtensionApiByAlias<UmbItemRepository<FormulateItemModel>>(this, FORMULATE_ITEM_REPOSITORY_ALIAS);
		const { data, error } = await (await this.#repository).requestItems([...ids]);

		// The repository gives no items, rather than an error, when it cannot get its store.
		if (error || !data) {
			throw error ?? new Error('The items could not be read.');
		}

		return data
			.filter((item) => item.entityType === this.#args.entityType)
			.map(({ unique, name, kindId, icon }) => ({ unique, name, kindId, icon }));
	}

	/**
	 * Lets the user pick in the tree. Overridden by tests.
	 * @param current The items picked now, which the tree picker shows as picked.
	 * @returns The tree picker's whole selection, or undefined when it was closed without one.
	 */
	protected async pickIds(current: ReadonlyArray<string>): Promise<Array<string> | undefined> {
		const picked = await umbOpenModal(this, UMB_TREE_PICKER_MODAL, {
			data: {
				treeAlias: this.#args.treeAlias,
				hideTreeRoot: true,
				multiple: this.#args.multiple,
				pickableFilter: createPickableFilter(this.#args.entityType),
			},
			value: { selection: [...current] },
		}).catch(() => undefined);

		return picked?.selection.filter((id): id is string => typeof id === 'string' && id !== '');
	}

	protected override willUpdate(changed: PropertyValues) {
		super.willUpdate(changed);

		const ids = this.getIds();
		const shown = JSON.stringify(ids);
		// Items whose read failed are read again at the next update, but not at the one that shows the failure,
		// so a server that stays down is not asked over and over.
		const readAgain = this._unread.size > 0 && !(changed.size === 1 && changed.has('_unread'));

		if (shown !== this.#shownIds) {
			this.#shownIds = shown;
			this.#sorter?.setModel([...ids]);
			this.#keyboard.putDownIfGone();
			void this.#read(ids);
		} else if (readAgain) {
			void this.#read(ids);
		}

		if (changed.has('readonly') && this.readonly) {
			this.#keyboard.putDown();
		}
	}

	async #read(ids: ReadonlyArray<string>) {
		const unread = ids.filter((id) => !this._items.has(id) && !this.#reading.has(id));

		if (!unread.length) {
			return;
		}

		unread.forEach((id) => this.#reading.add(id));
		let found: Array<FormulatePickedItem>;

		try {
			found = await this.requestItems(unread);
		} catch {
			// Not known to be gone: shown as not read, and read again later.
			unread.forEach((id) => this.#reading.delete(id));
			this._unread = new Set([...this._unread, ...unread]);
			return;
		}

		const items = new Map(this._items);

		for (const id of unread) {
			items.set(id, found.find((item) => item.unique === id) ?? null);
			this.#reading.delete(id);
		}

		this._items = items;

		if (unread.some((id) => this._unread.has(id))) {
			this._unread = new Set([...this._unread].filter((id) => !unread.includes(id)));
		}
	}

	async #choose() {
		const current = this.getIds();
		const picked = await this.pickIds(current);

		if (!picked) {
			return;
		}

		// Those still picked keep their order; those just picked follow, in the order they were picked.
		const next = this.#args.multiple
			? [...current.filter((id) => picked.includes(id)), ...picked.filter((id) => !current.includes(id))]
			: picked.slice(0, 1);

		if (JSON.stringify(next) !== JSON.stringify(current)) {
			this.setIds(next);
		}
	}

	#remove(id: string) {
		this.setIds(this.getIds().filter((candidate) => candidate !== id));
	}

	#kindName(item: FormulatePickedItem) {
		return (item.kindId && this._kinds.find((kind) => isSameKind(kind.kindId, item.kindId!))?.name) || '';
	}

	override render() {
		const ids = this.getIds();
		const canChoose = !this.readonly && (this.#args.multiple || ids.length === 0);

		return html`
			<!-- Always there, even empty: the sorter of several items looks for it once the picker is shown. -->
			<uui-ref-list id="rows">${repeat(ids, (id) => id, (id, index) => this.#renderItem(id, index + 1))}</uui-ref-list>
			${canChoose
				? html`<uui-button
						id="btn-add"
						look="placeholder"
						label=${this.localize.term('general_choose')}
						@click=${() => this.#choose()}></uui-button>`
				: nothing}
			${this.#args.multiple && !this.readonly ? this.#keyboard.renderStatus() : nothing}
		`;
	}

	#renderItem(id: string, position: number) {
		const item = this._items.get(id);
		const missing = item === null;
		const unread = item === undefined && this._unread.has(id);
		const name =
			item?.name ??
			(missing ? this.localize.term(this.#args.notFoundKey) : unread ? this.localize.term('formulate_itemNotRead') : '');
		const detail = item ? this.#kindName(item) : missing || unread ? id : '';
		const sortable = this.#args.multiple && !this.readonly;

		return html`
			<div class="row" data-key=${id} ?data-readonly=${this.readonly} ?data-picked-up=${this.#keyboard.pickedUp === id}>
				${sortable ? this.#keyboard.renderHandle(id, this.localize.term('formulate_moveItem', name, position)) : nothing}
				<!-- Read-only: there is nothing to open, only to remove. -->
				<uui-ref-node name=${name} detail=${detail} ?error=${missing} ?standalone=${!this.#args.multiple} readonly>
					<umb-icon slot="icon" name=${item?.icon || this.#args.icon}></umb-icon>
					${this.readonly
						? nothing
						: html`
								<uui-action-bar slot="actions">
									<uui-button label=${this.localize.term('general_remove')} @click=${() => this.#remove(id)}></uui-button>
								</uui-action-bar>
							`}
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

			#rows:empty {
				display: none;
			}

			#btn-add {
				display: block;
			}
		`,
	];
}
