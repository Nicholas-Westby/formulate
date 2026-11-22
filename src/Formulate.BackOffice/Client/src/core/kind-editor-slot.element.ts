import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { loadManifestElement, UmbExtensionsElementInitializer } from '@umbraco-cms/backoffice/extension-api';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { css, customElement, html, nothing, property, state, type PropertyValues } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import type { ManifestFormulateKindEditor } from './extension-types.js';
import type { FormulateKindEditorContext, FormulateKindEditorElement, FormulateKindEditorType } from './kind-editor.js';

/**
 * How long an editor whose element has loaded may take to be shown (its conditions and its element's
 * creation) before the slot says it is not available.
 */
const SHOW_EDITOR_TIMEOUT_MS = 500;

/** The alias of the slot's observer of the editors that have the kind's editor alias. */
const OBSERVE_MATCHING_EDITORS = 'formulateObserveMatchingEditors';

/**
 * Why an editor that has the kind's editor alias is not shown, for the console.
 * @param manifest The editor's manifest.
 * @returns The reason.
 */
async function whyNotShown(manifest: ManifestFormulateKindEditor): Promise<string> {
	const loader = manifest.element ?? manifest.js;

	try {
		if (loader && !(await loadManifestElement(loader)) && !manifest.elementName) {
			return `${manifest.alias}: its element module exports no element.`;
		}
	} catch (error) {
		return `${manifest.alias}: its element did not load (${String(error)}).`;
	}

	return `${manifest.alias}: its conditions do not allow it here.`;
}

/**
 * Shows the kind editor of a kind: the editor registered with the given extension type whose
 * meta.editorAlias is the kind's editor alias, or a localized "No settings" text when there is none (also
 * when the kind has no editor alias). It gives the editor the value, context and read-only state, and when
 * the editor changes the value it takes the editor's value as its own and dispatches an UmbChangeEvent.
 * While read-only, it takes no change: it shows the editor the value again instead.
 * Without an editor, the value is left exactly as it is, so an unknown kind's configuration round-trips.
 *
 * Editors registered later, such as by a package that loads after Formulate, show when they arrive. When an
 * editor has the alias but cannot be shown (its element does not load, or its conditions do not allow it),
 * the slot says the editor is not available, logs why to the console, and still leaves the value alone.
 *
 * @example
 * <formulate-kind-editor-slot
 *   .type=${'formulateValidationEditor'}
 *   .editorAlias=${definition.editorAlias}
 *   .value=${configuration}
 *   @change=${(event) => save(event.target.value)}></formulate-kind-editor-slot>
 */
@customElement('formulate-kind-editor-slot')
export class FormulateKindEditorSlotElement extends UmbLitElement {
	/** The extension type of the editors to choose from. */
	@property({ attribute: false })
	type?: FormulateKindEditorType;

	/** The kind's editor alias; null for a kind without one, undefined while it is not known yet. */
	@property({ attribute: false })
	editorAlias?: string | null;

	/** The configuration, as the API stores it. */
	@property({ attribute: false })
	value?: unknown;

	/** Where the editor is shown. */
	@property({ attribute: false })
	context?: FormulateKindEditorContext;

	/** Whether nothing may be changed. */
	@property({ type: Boolean, reflect: true })
	readonly = false;

	/** The editor: undefined while it is looked for (or cannot be shown), null when there is none. */
	@state()
	private _editor?: FormulateKindEditorElement | null;

	/** Whether an editor has the alias, but cannot be shown. */
	@state()
	private _unavailable = false;

	#initializer?: UmbExtensionsElementInitializer<UmbExtensionManifest, FormulateKindEditorType>;

	/** The current search for an editor, so answers for an editor alias replaced since are ignored. */
	#search?: symbol;

	/** The editors that have the alias, once known. */
	#matching?: Array<ManifestFormulateKindEditor>;

	/** The editor allowed to be shown, once it is made. */
	#permitted?: FormulateKindEditorElement;

	/** The search whose editor is being checked for, so it is checked once. */
	#checking?: symbol;

	protected override willUpdate(changed: PropertyValues<this>) {
		super.willUpdate(changed);

		if (changed.has('type') || changed.has('editorAlias')) {
			this.#findEditor();
		} else if (changed.has('value') || changed.has('context') || changed.has('readonly')) {
			if (this.#initializer) {
				this.#initializer.properties = this.#properties();
			}
		}
	}

	#findEditor() {
		this.#search = undefined;
		this.#initializer?.destroy();
		this.#initializer = undefined;
		this.removeUmbControllerByAlias(OBSERVE_MATCHING_EDITORS);
		this.#matching = undefined;
		this.#permitted = undefined;
		this._unavailable = false;
		this.#setEditor(undefined);

		const { type, editorAlias } = this;

		if (!type || editorAlias === undefined) {
			return;
		}

		if (!editorAlias) {
			this.#setEditor(null);
			return;
		}

		const search = Symbol();
		this.#search = search;
		const hasAlias = (manifest: ManifestFormulateKindEditor) => manifest.meta?.editorAlias === editorAlias;

		// The editors that have the alias, whether or not they can be shown.
		this.observe(
			umbExtensionsRegistry.byTypeAndFilter(type, hasAlias),
			(matching) => {
				if (this.#search === search) {
					this.#matching = matching;
					this.#show(search);
				}
			},
			OBSERVE_MATCHING_EDITORS,
		);

		// The editor to show: the one with the highest weight whose conditions allow it, once its element is made.
		const initializer = new UmbExtensionsElementInitializer(
			this,
			umbExtensionsRegistry,
			type,
			hasAlias,
			(permitted) => {
				if (this.#search === search) {
					this.#permitted = permitted[0]?.component as FormulateKindEditorElement | undefined;
					this.#show(search);
				}
			},
			'formulateKindEditorSlot',
			undefined,
			{ single: true },
		);
		initializer.properties = this.#properties();
		this.#initializer = initializer;
	}

	/** Shows the editor; "No settings" when no editor has the alias; else, in time, that it is not available. */
	#show(search: symbol) {
		if (this.#permitted) {
			this._unavailable = false;
			this.#setEditor(this.#permitted);
		} else if (this.#matching?.length === 0) {
			this._unavailable = false;
			this.#setEditor(null);
		} else if (this.#matching) {
			this.#setEditor(undefined);
			void this.#checkAvailable(search);
		}
	}

	/** Says the editor is not available when it is still not shown once it has had time to load. */
	async #checkAvailable(search: symbol) {
		if (this.#checking === search) {
			return;
		}

		this.#checking = search;
		const reasons = await Promise.all((this.#matching ?? []).map(whyNotShown));
		await new Promise((resolve) => setTimeout(resolve, SHOW_EDITOR_TIMEOUT_MS));

		if (this.#checking === search) {
			this.#checking = undefined;
		}

		if (this.#search !== search || this.#permitted || !this.#matching?.length) {
			return;
		}

		this._unavailable = true;
		console.warn(
			`Formulate: the ${this.type} with the editor alias "${this.editorAlias}" is not available, so the kind's settings are not shown. They are kept as they are.`,
			reasons,
		);
	}

	#properties(): Record<string, unknown> {
		return { value: this.value, context: this.context, readonly: this.readonly };
	}

	#setEditor(editor: FormulateKindEditorElement | null | undefined) {
		if (editor === this._editor) {
			return;
		}

		this._editor?.removeEventListener(UmbChangeEvent.TYPE, this.#onEditorChange);
		editor?.addEventListener(UmbChangeEvent.TYPE, this.#onEditorChange);
		this._editor = editor;
	}

	#onEditorChange = (event: Event) => {
		const editor = this._editor;

		// Only the editor's own change, not one that escapes from an input inside it.
		if (!editor || event.composedPath()[0] !== editor) {
			return;
		}

		event.stopPropagation();

		// Nothing may change, so the editor is shown the value again.
		if (this.readonly) {
			editor.value = this.value;
			return;
		}

		this.value = editor.value;
		this.dispatchEvent(new UmbChangeEvent());
	};

	override render() {
		if (this._editor) {
			return html`${this._editor}`;
		}

		if (this._editor === null) {
			return html`<div id="no-settings">${this.localize.term('formulate_noSettings')}</div>`;
		}

		if (this._unavailable) {
			return html`<div id="not-available">${this.localize.term('formulate_editorNotAvailable')}</div>`;
		}

		return nothing;
	}

	static override styles = [
		UmbTextStyles,
		css`
			:host {
				display: block;
			}
		`,
	];
}

export default FormulateKindEditorSlotElement;

declare global {
	interface HTMLElementTagNameMap {
		'formulate-kind-editor-slot': FormulateKindEditorSlotElement;
	}
}
