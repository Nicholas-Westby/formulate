import { css, customElement, html, nothing, property, repeat, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FORMULATE_SORTABLE_STYLES } from '../../../core/sortable/keyboard-sorter.js';
import { FORMULATE_LAYOUT_FIELDS_SORTER, type FormulateBasicLayoutDesigner, type FormulateLayoutFieldView } from './basic-layout-designer.js';
import { UNUSED, type FormulateFieldPlace } from './basic-layout.model.js';

/**
 * A cell of the Basic layout designer, or its unused fields: the fields in it, from top to bottom. Fields are
 * dragged by their handles between the cells and the unused fields, whose sorters share one identifier, and
 * moved with the keyboard by the designer's keyboard sorter, whose handles they show. Each move goes to the
 * designer, which stores it and shows the fields in their new places. A field that is no longer on the form
 * shows as not found, with its ID, and can only be removed. The list of fields is always there, also when it
 * is empty, as the sorter needs it.
 */
@customElement('formulate-basic-layout-cell')
export class FormulateBasicLayoutCellElement extends UmbLitElement {
	@property({ attribute: false })
	designer?: FormulateBasicLayoutDesigner;

	/** Where the fields are: a cell, or the unused fields. */
	@property({ attribute: false })
	place: FormulateFieldPlace = UNUSED;

	@property({ attribute: false })
	fields: ReadonlyArray<FormulateLayoutFieldView> = [];

	/** How many of the row's 12 columns the cell takes. */
	@property({ type: Number, reflect: true })
	columns = 12;

	/** The field picked up with the keyboard, if any. */
	@property({ attribute: false })
	pickedUp?: string;

	/** What the cell says when it has no fields. */
	@property()
	empty = '';

	@property({ type: Boolean, reflect: true })
	readonly = false;

	/** Whether these are the unused fields, which are shown side by side. */
	@property({ type: Boolean, reflect: true })
	unused = false;

	#sorter = new UmbSorterController<FormulateLayoutFieldView, HTMLElement>(this, {
		getUniqueOfElement: (element) => element.dataset.key,
		getUniqueOfModel: (field) => field.key,
		identifier: FORMULATE_LAYOUT_FIELDS_SORTER,
		itemSelector: '.field',
		containerSelector: '#fields',
		handleSelector: '.handle',
		disabledItemSelector: '[data-fixed]',
		// The designer moves the field from wherever it is, so the cell it leaves has nothing to do.
		performItemRemove: () => true,
		performItemInsert: ({ item, newIndex }) => this.#move(item, newIndex),
		// The sorter gives the place before the field leaves its own; the designer wants the place it ends up at.
		performItemMove: ({ item, newIndex, oldIndex }) => this.#move(item, oldIndex < newIndex ? newIndex - 1 : newIndex),
	});

	#move(field: FormulateLayoutFieldView, index: number) {
		if (this.readonly || !this.designer) {
			return false;
		}

		// The sorter gives -1 for a field dragged below the cell: it goes at the end.
		this.designer.moveField(field.key, this.place, index < 0 ? this.fields.length : index);
		return true;
	}

	override connectedCallback() {
		super.connectedCallback();
		this.setAttribute('role', 'group');
	}

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed);

		if (changed.has('fields')) {
			this.#sorter.setModel([...this.fields]);
		}
	}

	override render() {
		return html`
			<span id="move-hint" hidden>${this.localize.term('formulate_moveHint')}</span>
			<div id="fields">
				${repeat(this.fields, (field) => field.key, (field, index) => this.#renderField(field, index + 1))}
				${this.fields.length ? nothing : html`<span class="empty">${this.empty}</span>`}
			</div>
		`;
	}

	#renderField(field: FormulateLayoutFieldView, position: number) {
		// A field that is gone would be dropped as soon as it moved, so it is only removed.
		const fixed = this.readonly || field.missing;

		return html`
			<div class="field" data-key=${field.key} ?data-fixed=${fixed} ?data-missing=${field.missing} ?data-picked-up=${this.pickedUp === field.key}>
				${fixed ? nothing : this.designer?.renderFieldHandle(field.key, this.localize.term('formulate_moveItem', field.name, position))}
				${field.icon ? html`<umb-icon name=${field.icon}></umb-icon>` : nothing}
				<span class="text">
					<span class="name">${field.name}</span>
					<span class="alias">${field.missing ? field.id : field.alias}</span>
				</span>
				${field.missing && !this.readonly
					? html`<uui-button
							class="remove"
							compact
							label=${this.localize.term('formulate_removeMissingField', position)}
							@click=${() => this.designer?.removeField(field.key)}>
							<uui-icon name="icon-trash"></uui-icon>
						</uui-button>`
					: nothing}
			</div>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SORTABLE_STYLES,
		css`
			:host {
				display: block;
				min-width: 0;
			}

			#fields {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-2);
				box-sizing: border-box;
				height: 100%;
				min-height: var(--uui-size-16);
				padding: var(--uui-size-space-2);
				border: 1px dashed var(--uui-color-border-emphasis);
				border-radius: var(--uui-border-radius);
				background-color: var(--uui-color-surface);
			}

			:host([unused]) #fields {
				flex-flow: row wrap;
				align-items: flex-start;
				border-style: solid;
				border-color: var(--uui-color-border);
			}

			.field {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-2);
				min-width: 0;
				box-sizing: border-box;
				padding: var(--uui-size-space-1) var(--uui-size-space-2) var(--uui-size-space-1) var(--uui-size-space-1);
				border: 1px solid var(--uui-color-border);
				border-radius: var(--uui-border-radius);
				background-color: var(--uui-color-surface);
			}

			:host([unused]) .field {
				max-width: 100%;
			}

			.field[data-missing] {
				border-color: var(--uui-color-danger);
				color: var(--uui-color-danger-standalone);
			}

			.field[data-missing] .alias {
				color: inherit;
			}

			.field > umb-icon {
				flex: 0 0 auto;
			}

			.text {
				display: flex;
				flex: 1 1 auto;
				flex-direction: column;
				min-width: 0;
			}

			.name,
			.alias {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.name {
				font-weight: 700;
			}

			.alias {
				font-size: var(--uui-type-small-size);
				color: var(--uui-color-text-alt);
			}

			.remove {
				flex: 0 0 auto;
			}

			.empty {
				margin: auto;
				font-size: var(--uui-type-small-size);
				color: var(--uui-color-text-alt);
				text-align: center;
			}

			.field[drag-placeholder] {
				position: relative;
			}

			.field[drag-placeholder] > * {
				visibility: hidden;
			}

			.field[drag-placeholder]::after {
				content: '';
				position: absolute;
				inset: 0;
				border-radius: var(--uui-border-radius);
				border: 1px dashed var(--uui-color-divider-emphasis);
			}
		`,
	];
}

declare global {
	interface HTMLElementTagNameMap {
		'formulate-basic-layout-cell': FormulateBasicLayoutCellElement;
	}
}
