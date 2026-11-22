import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { property } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import type { FormFieldModel } from '../api/index.js';
import type { ManifestFormulateKindEditor } from './extension-types.js';

// The contract between Formulate and the editors of its kinds, including those of other packages.
//
// A kind editor is an element registered with a manifest of one of the extension types below, whose
// meta.editorAlias is the editor alias of the kinds it edits (see extension-types.ts). The definitions
// endpoints give each kind's editor alias, and <formulate-kind-editor-slot> shows the matching editor.

/** The kind editors of form fields. */
export const FORMULATE_FIELD_EDITOR_TYPE = 'formulateFieldEditor';

/** The kind editors of form handlers. */
export const FORMULATE_HANDLER_EDITOR_TYPE = 'formulateHandlerEditor';

/** The kind editors of validations. */
export const FORMULATE_VALIDATION_EDITOR_TYPE = 'formulateValidationEditor';

/** The kind editors of data values. */
export const FORMULATE_DATA_VALUES_EDITOR_TYPE = 'formulateDataValuesEditor';

/** The kind editors of layouts. */
export const FORMULATE_LAYOUT_EDITOR_TYPE = 'formulateLayoutEditor';

/** The extension type of a kind editor, one for each thing that has kinds. */
export type FormulateKindEditorType =
	| typeof FORMULATE_FIELD_EDITOR_TYPE
	| typeof FORMULATE_HANDLER_EDITOR_TYPE
	| typeof FORMULATE_VALIDATION_EDITOR_TYPE
	| typeof FORMULATE_DATA_VALUES_EDITOR_TYPE
	| typeof FORMULATE_LAYOUT_EDITOR_TYPE;

/** What an editor may need besides the configuration, from where it is shown. */
export interface FormulateKindEditorContext {
	/** The fields of the form being edited, such as for a handler that picks fields. */
	formFields?: ReadonlyArray<FormFieldModel>;

	/** The form being edited, or the form of the layout being edited. */
	formId?: string;
}

/**
 * The element of a kind editor.
 *
 * - `value` is the configuration exactly as the API stores it, and as the editor gives it back: the item's
 *   `configuration` (whatever JSON the kind reads), or undefined (or null) when there is none yet. Editors
 *   keep the settings they do not edit, so a configuration made by a newer version is not lost. Values set
 *   on the editor are frozen: an editor makes a new value for each change instead of changing the old one.
 * - `context` says where the editor is shown (see FormulateKindEditorContext).
 * - `readonly` is true when nothing may be changed, such as for legacy data values.
 * - `manifest` is the editor's own manifest.
 *
 * After each change the editor sets `value` to the new configuration, then dispatches an UmbChangeEvent
 * ('change') from itself. FormulateKindEditorElementBase does both in updateValue().
 */
export interface FormulateKindEditorElement<Value = unknown> extends HTMLElement {
	value: Value | undefined;
	context: FormulateKindEditorContext | undefined;
	readonly: boolean;
	manifest?: ManifestFormulateKindEditor;
}

/** A base for kind editors, with the contract's properties and updateValue() to announce a change. */
export abstract class FormulateKindEditorElementBase<Value = unknown>
	extends UmbLitElement
	implements FormulateKindEditorElement<Value>
{
	/** The configuration, as the API stores it. */
	@property({ attribute: false })
	value: Value | undefined;

	/** Where the editor is shown. */
	@property({ attribute: false })
	context: FormulateKindEditorContext | undefined;

	/** Whether nothing may be changed. */
	@property({ type: Boolean, reflect: true })
	readonly = false;

	/** The editor's own manifest. */
	@property({ attribute: false })
	manifest?: ManifestFormulateKindEditor;

	/**
	 * Stores a new configuration and says so, as the contract asks.
	 * @param value The new configuration; a new object, never a changed copy of the old one.
	 */
	protected updateValue(value: Value) {
		this.value = value;
		this.dispatchEvent(new UmbChangeEvent());
	}
}

/**
 * A configuration that is a JSON object, to read settings from: an empty object when there is none, or
 * when the configuration is not an object.
 * @param value The configuration.
 * @returns The configuration's settings.
 */
export function readSettings(value: unknown): Readonly<Record<string, unknown>> {
	return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * A setting that is text.
 * @param settings The configuration's settings.
 * @param key The setting.
 * @returns Its text, or '' when it is not text.
 */
export function readText(settings: Readonly<Record<string, unknown>>, key: string): string {
	const text = settings[key];
	return typeof text === 'string' ? text : '';
}
