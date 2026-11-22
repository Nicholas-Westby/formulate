import type { ManifestElement, ManifestWithDynamicConditions } from '@umbraco-cms/backoffice/extension-api';
import type { FormulateKindEditorElement, FormulateKindEditorType } from './kind-editor.js';

/** What a kind editor manifest says about the kinds it edits. */
export interface MetaFormulateKindEditor {
	/**
	 * The editor alias of the kinds this editor edits: the `EditorAlias` of their server definitions, which
	 * the definitions endpoints give as `editorAlias`. Kinds of other packages can share an editor this way.
	 */
	editorAlias: string;
}

/**
 * A kind editor: the element that edits the configuration of the kinds with its editor alias. There is one
 * extension type for each thing that has kinds; the type says which, the editor alias says which kinds.
 * When two editors of a type have the same editor alias, the one with the highest weight is used, and an
 * editor can replace another with `overwrites`, as with any Umbraco extension.
 */
export interface ManifestFormulateKindEditor<Type extends FormulateKindEditorType = FormulateKindEditorType>
	extends ManifestElement<FormulateKindEditorElement>,
		ManifestWithDynamicConditions<UmbExtensionConditionConfig> {
	type: Type;
	meta: MetaFormulateKindEditor;
}

/** An editor of the configuration of a kind of form field. */
export type ManifestFormulateFieldEditor = ManifestFormulateKindEditor<'formulateFieldEditor'>;

/** An editor of the configuration of a kind of form handler. */
export type ManifestFormulateHandlerEditor = ManifestFormulateKindEditor<'formulateHandlerEditor'>;

/** An editor of the configuration of a kind of validation. */
export type ManifestFormulateValidationEditor = ManifestFormulateKindEditor<'formulateValidationEditor'>;

/** An editor of the configuration of a kind of data values. */
export type ManifestFormulateDataValuesEditor = ManifestFormulateKindEditor<'formulateDataValuesEditor'>;

/** An editor of the configuration of a kind of layout. */
export type ManifestFormulateLayoutEditor = ManifestFormulateKindEditor<'formulateLayoutEditor'>;

declare global {
	interface UmbExtensionManifestMap {
		formulateFieldEditor: ManifestFormulateFieldEditor;
		formulateHandlerEditor: ManifestFormulateHandlerEditor;
		formulateValidationEditor: ManifestFormulateValidationEditor;
		formulateDataValuesEditor: ManifestFormulateDataValuesEditor;
		formulateLayoutEditor: ManifestFormulateLayoutEditor;
	}
}
