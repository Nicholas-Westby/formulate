import { css, customElement, html, nothing, property, repeat, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbSorterController } from '@umbraco-cms/backoffice/sorter';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import { FORMULATE_SORTABLE_STYLES } from '../../../core/sortable/keyboard-sorter.js';
import './basic-layout-cell.element.js';
import {
	FORMULATE_LAYOUT_ROWS_SORTER,
	type FormulateBasicLayoutDesigner,
	type FormulateLayoutContentRowView,
	type FormulateLayoutRowView,
	type FormulateLayoutStepView,
} from './basic-layout-designer.js';

/**
 * The rows of the Basic layout designer, from top to bottom: rows of cells, each cell as wide as its share
 * of the row's 12 columns, and step dividers, named after the step they start ("Step 2"). Rows and step
 * dividers are dragged by their handles, or moved with the keyboard by the designer's keyboard sorter, whose
 * handles and announcements they show. A row can be deleted, and can have a step divider added after it; a
 * step divider can be deleted. Each change goes to the designer, which stores it.
 */
@customElement('formulate-basic-layout-rows')
export class FormulateBasicLayoutRowsElement extends UmbLitElement {
	@property({ attribute: false })
	designer?: FormulateBasicLayoutDesigner;

	@property({ attribute: false })
	rows: ReadonlyArray<FormulateLayoutRowView> = [];

	/** The row picked up with the keyboard, if any. */
	@property({ attribute: false })
	pickedUpRow?: string;

	/** The field picked up with the keyboard, if any. */
	@property({ attribute: false })
	pickedUpField?: string;

	@property({ type: Boolean, reflect: true })
	readonly = false;

	#sorter = new UmbSorterController<FormulateLayoutRowView, HTMLElement>(this, {
		getUniqueOfElement: (element) => element.dataset.key,
		getUniqueOfModel: (row) => row.key,
		identifier: FORMULATE_LAYOUT_ROWS_SORTER,
		itemSelector: '.row',
		containerSelector: '#rows',
		handleSelector: '.handle',
		disabledItemSelector: '[data-readonly]',
		// The sorter gives the place before the row leaves its own; the designer wants the place it ends up at.
		performItemMove: ({ newIndex, oldIndex }) => {
			if (this.readonly || !this.designer) {
				return false;
			}

			this.designer.moveRow(oldIndex, oldIndex < newIndex ? newIndex - 1 : newIndex);
			return true;
		},
	});

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed);

		if (changed.has('rows')) {
			this.#sorter.setModel([...this.rows]);
		}
	}

	/** Done once the cells have shown their fields too, so the keyboard can keep the focus on a moved field. */
	protected override async getUpdateComplete(): Promise<boolean> {
		const result = await super.getUpdateComplete();
		await Promise.all([...(this.shadowRoot?.querySelectorAll('formulate-basic-layout-cell') ?? [])].map((cell) => cell.updateComplete));

		return result;
	}

	override render() {
		return html`
			<div id="rows">${repeat(this.rows, (row) => row.key, (row) => (row.kind === 'step' ? this.#renderStep(row) : this.#renderRow(row)))}</div>
			${this.readonly ? nothing : this.designer?.renderRowStatus()}
		`;
	}

	#renderRow(row: FormulateLayoutContentRowView) {
		const { position } = row;

		return html`
			<div class="row" data-key=${row.key} ?data-readonly=${this.readonly} ?data-picked-up=${this.pickedUpRow === row.key}>
				${this.readonly ? nothing : this.designer?.renderRowHandle(row.key, this.localize.term('formulate_moveRow', position))}
				<div class="cells">
					${row.cells.map(
						(cell, index) => html`
							<formulate-basic-layout-cell
								style=${`grid-column: span ${cell.columns}`}
								aria-label=${this.localize.term('formulate_layoutCell', position, index + 1, cell.columns)}
								.designer=${this.designer}
								.place=${cell.place}
								.fields=${cell.fields}
								.columns=${cell.columns}
								.pickedUp=${this.pickedUpField}
								.empty=${this.localize.term('formulate_emptyCell')}
								?readonly=${this.readonly}></formulate-basic-layout-cell>
						`,
					)}
				</div>
				${this.readonly
					? nothing
					: html`
							<div class="actions">
								<uui-button
									class="add-step"
									compact
									look="secondary"
									label=${this.localize.term('formulate_addStepAfter', position)}
									@click=${() => this.designer?.addStepAfter(row.index)}>
									${this.localize.term('formulate_addStep')}
								</uui-button>
								${this.#renderAction('delete-row', this.localize.term('formulate_deleteRow', position), 'icon-trash', () =>
									this.designer?.deleteRow(row.index),
								)}
							</div>
						`}
			</div>
		`;
	}

	#renderStep(row: FormulateLayoutStepView) {
		const label = row.step ? this.localize.term('formulate_step', row.step) : this.localize.term('formulate_emptyStep');

		return html`
			<div class="row step" data-key=${row.key} ?data-readonly=${this.readonly} ?data-picked-up=${this.pickedUpRow === row.key}>
				${this.readonly ? nothing : this.designer?.renderRowHandle(row.key, this.localize.term('formulate_moveStep', row.step))}
				<div class="divider">
					<span class="step-label">${label}</span>
					${row.step ? nothing : html`<span class="step-note">${this.localize.term('formulate_emptyStepDescription')}</span>`}
				</div>
				${this.readonly
					? nothing
					: html`<div class="actions">
							${this.#renderAction('delete-step', this.localize.term('formulate_deleteStep', row.step), 'icon-trash', () =>
								this.designer?.deleteStep(row.index),
							)}
						</div>`}
			</div>
		`;
	}

	#renderAction(className: string, label: string, icon: string, action: () => void) {
		return html`<uui-button class=${className} compact look="secondary" label=${label} title=${label} @click=${action}>
			<uui-icon name=${icon}></uui-icon>
		</uui-button>`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SORTABLE_STYLES,
		css`
			:host {
				display: block;
			}

			#rows {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-3);
			}

			.row {
				display: flex;
				align-items: stretch;
				gap: var(--uui-size-space-3);
				padding: var(--uui-size-space-3);
				border: 1px solid var(--uui-color-border);
				border-radius: var(--uui-border-radius);
				background-color: var(--uui-color-surface-alt);
			}

			.cells {
				display: grid;
				flex: 1 1 auto;
				grid-template-columns: repeat(12, minmax(0, 1fr));
				gap: var(--uui-size-space-3);
				min-width: 0;
			}

			.actions {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-2);
			}

			.row.step {
				align-items: center;
				padding-block: var(--uui-size-space-2);
				border-style: dashed;
				background-color: transparent;
			}

			.divider {
				display: flex;
				flex: 1 1 auto;
				flex-direction: column;
				align-items: center;
				gap: var(--uui-size-space-1);
				min-width: 0;
				text-align: center;
			}

			.step-label {
				font-weight: 700;
			}

			.step-note {
				font-size: var(--uui-type-small-size);
				color: var(--uui-color-text-alt);
			}
		`,
	];
}

declare global {
	interface HTMLElementTagNameMap {
		'formulate-basic-layout-rows': FormulateBasicLayoutRowsElement;
	}
}
