import type { UmbInputWithAliasElement } from '@umbraco-cms/backoffice/components';
import { css, html, nothing, state, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { umbFocus } from '@umbraco-cms/backoffice/lit-element';
import { UmbModalBaseElement } from '@umbraco-cms/backoffice/modal';
import { UmbObjectState } from '@umbraco-cms/backoffice/observable-api';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import '../../core/kind-editor-slot.element.js';
import type { FormulateKindEditorSlotElement } from '../../core/kind-editor-slot.element.js';
import type { FormulateKindEditorContext, FormulateKindEditorType } from '../../core/kind-editor.js';
import { FORMULATE_ANY_ALIAS_PATTERN } from '../../core/kind-item/kind-item-workspace-header.element.js';
import type { FormulateFormFieldModel } from '../types.js';

/** What a field or handler has that its dialog edits for every kind. */
export interface FormulateEditableItem {
	name: string | null;
	alias: string | null;
	configuration?: unknown;
}

/** What the dialog of a field or handler is given. */
export interface FormulateEditItemModalData {
	isNew?: boolean;
	formFields: ReadonlyArray<FormulateFormFieldModel>;
	formId?: string;
}

/** What the dialog needs of the definition of the item's kind. */
export interface FormulateEditableKind {
	name: string;
	editorAlias?: string | null;
}

/**
 * The dialog of a field or handler of a form, laid out as Umbraco's property settings: boxes of settings,
 * the kind's own settings (shown by its kind editor) last, and Close and Submit. It edits a copy of the item,
 * held in an object state, so the kind's editor is only ever given frozen values; Submit gives back the
 * copy as edited, and Close gives back nothing. A kind that is not installed says so, and its
 * configuration is kept exactly as it is.
 */
export abstract class FormulateEditItemModalBaseElement<
	Item extends FormulateEditableItem,
	Data extends FormulateEditItemModalData,
	Value,
> extends UmbModalBaseElement<Data, Value> {
	#item = new UmbObjectState<Item | undefined>(undefined);

	/** The item as edited so far. */
	@state()
	protected _item?: Item;

	/** The context of the kind's editor: the form's fields and ID. Made once, so the editor is not told again. */
	#context?: FormulateKindEditorContext;

	constructor() {
		super();
		this.observe(this.#item.asObservable(), (item) => (this._item = item), '_formulateObserveItem');
	}

	/** The item the dialog is given. */
	protected abstract readItem(data: Data): Item;

	/** What Submit gives back. */
	protected abstract toValue(item: Item): Value;

	protected override willUpdate(changed: PropertyValues) {
		super.willUpdate(changed);

		// The item is copied once, when the dialog gets it: what the user changes goes to the copy.
		if (changed.has('data') && this.data && this.#item.getValue() === undefined) {
			const { formFields, formId } = this.data;
			this.#context = { formFields, ...(formId ? { formId } : {}) };
			this.#item.setValue(structuredClone(this.readItem(this.data)));
		}
	}

	/**
	 * Changes parts of the item.
	 * @param parts The parts that change.
	 */
	protected updateItem(parts: Partial<Item>) {
		if (this.#item.getValue()) {
			this.#item.update(parts);
		}
	}

	#onNameChange(event: Event) {
		const input = event.target as UmbInputWithAliasElement;
		this.updateItem({ name: String(input.value ?? '') || null, alias: input.alias || null } as Partial<Item>);
	}

	#submit() {
		const item = this.#item.getValue();

		if (item) {
			this.value = this.toValue(item);
			this._submitModal();
		}
	}

	/** The name and alias, as Umbraco's property settings show them: the alias follows a new item's name. */
	protected renderNameAndAlias() {
		return html`
			<umb-property-layout label=${this.localize.term('general_name')} orientation="vertical">
				<umb-input-with-alias
					slot="editor"
					id="name"
					label=${this.localize.term('placeholders_entername')}
					.value=${this._item?.name ?? ''}
					.alias=${this._item?.alias ?? ''}
					alias-pattern=${FORMULATE_ANY_ALIAS_PATTERN}
					.autocomplete=${'off'}
					?auto-generate-alias=${this.data?.isNew === true}
					@change=${this.#onNameChange}
					${umbFocus()}></umb-input-with-alias>
			</umb-property-layout>
		`;
	}

	/**
	 * The kind's own settings, shown by its kind editor; for a kind that is not installed, that it is not.
	 * @param type The extension type of the kind's editors.
	 * @param definition The kind's definition: undefined while it is read, null when it is not installed.
	 * @param unknownKindKey The localization key of what is said for a kind that is not installed.
	 */
	protected renderSettings(type: FormulateKindEditorType, definition: FormulateEditableKind | null | undefined, unknownKindKey: string) {
		if (definition === undefined) {
			return nothing;
		}

		return html`
			<uui-box headline=${this.localize.term('general_settings')}>
				${definition === null
					? html`<p id="unknown-kind">${this.localize.term(unknownKindKey)}</p>`
					: html`<formulate-kind-editor-slot
							.type=${type}
							.editorAlias=${definition.editorAlias ?? null}
							.value=${this._item?.configuration}
							.context=${this.#context}
							@change=${(event: Event) =>
								this.updateItem({
									configuration: (event.target as FormulateKindEditorSlotElement).value,
								} as Partial<Item>)}></formulate-kind-editor-slot>`}
			</uui-box>
		`;
	}

	protected renderActions() {
		return html`
			<uui-button slot="actions" id="close" label=${this.localize.term('general_close')} @click=${() => this._rejectModal()}></uui-button>
			<uui-button
				slot="actions"
				id="submit"
				look="primary"
				color="positive"
				label=${this.localize.term('general_submit')}
				@click=${() => this.#submit()}></uui-button>
		`;
	}

	override destroy() {
		super.destroy();
		this.#item.destroy();
	}

	// As Umbraco's property settings.
	static override styles = [
		UmbTextStyles,
		css`
			#main {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-layout-1);
			}

			umb-property-layout[orientation='vertical'] {
				padding: var(--uui-size-space-2) 0;
			}

			umb-property-layout:first-of-type {
				padding-top: 0;
			}

			umb-property-layout:last-of-type {
				padding-bottom: 0;
			}

			uui-input,
			uui-select {
				width: 100%;
			}
		`,
	];
}
