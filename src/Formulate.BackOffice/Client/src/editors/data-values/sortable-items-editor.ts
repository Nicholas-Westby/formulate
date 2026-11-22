import { css, html, nothing, property, type TemplateResult } from '@umbraco-cms/backoffice/external/lit';
import type { ManifestFormulateKindEditor } from '../../core/extension-types.js';
import { readSettings, type FormulateKindEditorContext, type FormulateKindEditorElement } from '../../core/kind-editor.js';
import { FormulateSortableRowsInputElement, readItems, type FormulateListItem } from '../../core/sortable/sortable-rows-input.js';

/**
 * A kind editor for a configuration of the shape { items: [...] }: a sortable list of rows, each with a drag
 * handle, the item's inputs and a remove button, and an Add button, as Umbraco's multiple text string input
 * has them (see FormulateSortableRowsInputElement). Each change stores the whole configuration again, keeping
 * the settings and item fields the editor does not edit.
 *
 * The drag handle is a button for the keyboard too (see FormulateKeyboardSorter).
 */
export abstract class FormulateSortableItemsEditorElement
	extends FormulateSortableRowsInputElement<unknown>
	implements FormulateKindEditorElement
{
	/** Where the editor is shown. */
	@property({ attribute: false })
	context: FormulateKindEditorContext | undefined;

	/** The editor's own manifest. */
	@property({ attribute: false })
	manifest?: ManifestFormulateKindEditor;

	/** A new, empty item, as Add makes it. */
	protected abstract newItem(): Record<string, unknown>;

	/** What shows above the rows, such as column headers. */
	protected renderHeaders(): TemplateResult | typeof nothing {
		return nothing;
	}

	/** The localization key of the description of the items. */
	protected abstract readonly itemsDescriptionKey: string;

	protected override itemsOf(value: unknown) {
		return readItems(readSettings(value).items);
	}

	protected override valueWith(items: Array<FormulateListItem>) {
		return { ...readSettings(this.value), items };
	}

	protected override renderAddButtons() {
		return html`<uui-button
			id="add"
			look="placeholder"
			label=${this.localize.term('general_add')}
			@click=${() => this.addItems([this.newItem()])}></uui-button>`;
	}

	override render() {
		return html`
			<umb-property-layout
				label=${this.localize.term('formulate_items')}
				description=${this.localize.term(this.itemsDescriptionKey)}>
				<div slot="editor">${this._rows.length ? this.renderHeaders() : nothing} ${super.render()}</div>
			</umb-property-layout>
		`;
	}

	static override styles = [
		...FormulateSortableRowsInputElement.styles,
		css`
			#headers {
				display: flex;
				align-items: center;
				gap: var(--uui-size-space-3);
				margin-bottom: var(--uui-size-space-2);
				font-weight: bold;
			}

			.handle-space {
				flex: 0 0 var(--uui-size-6);
			}

			.remove-space {
				flex: 0 0 var(--uui-size-11);
			}

			#add {
				display: block;
			}
		`,
	];
}
