/*
 * The JSON contract between the server (BuildPlainJavaScriptJson) and this
 * renderer, and the contracts for the field renderers and validators that other
 * scripts can register on the window.
 */

/** One form, as the Razor view pushes it onto window["formulate-plain-js-forms"]. */
export interface FormulateForm {
  data: FormulateFormData;
  /** The URLs of this script and of the optional theme. The renderer itself does not use them. */
  assets?: FormulateAssets | null;
}

export interface FormulateAssets {
  script: string;
  theme: string | null;
}

export interface FormulateFormData {
  name: string;
  alias: string | null;
  /** Regenerated on each page render. The placeholder script's ID is "formulate-form-{randomId}". */
  randomId: string;
  fields: FormulateField[];
  rows: FormulateRow[];
  /** Posted with every submission: FormId, PageId and the antiforgery token. */
  payload: Record<string, string | number | boolean | null | undefined>;
  /** Where submissions are posted (it includes the site's path base). */
  url: string;
}

export interface FormulateField {
  alias: string | null;
  label: string | null;
  /** The field's ID (an N-format GUID). The field's value is posted under this key. */
  id: string;
  /** Regenerated on each page render. */
  randomId: string;
  /** Selects the renderer, such as "text" or "checkbox-list". */
  fieldType: string;
  validations: FormulateValidation[];
  configuration: FieldConfiguration;
  /** The value to start with: a query string value, or a hidden field's value. */
  initialValue?: string | string[] | null;
  category?: string | null;
}

export interface FieldConfiguration {
  /** For select, checkbox-list, radio-list and extended-radio-list. */
  items?: FieldItem[];
  /** For radio-list and extended-radio-list: "Horizontal" or "Vertical". */
  orientation?: string | null;
  /** For header (plain text), rich-text (HTML) and hidden (the configured value). */
  text?: string | null;
  /** For button: "Submit", "Next" or "Previous". */
  buttonKind?: string | null;
  /** For recaptcha. */
  siteKey?: string | null;
  [key: string]: unknown;
}

export interface FieldItem {
  value: string;
  label: string;
  /** For extended-radio-list: the text shown after the label. */
  description?: string | null;
  selected?: boolean;
}

export interface FormulateValidation {
  id: string;
  alias: string;
  /** Selects the validator, such as "required" or "regex". */
  validationType: string;
  configuration: ValidationConfiguration;
}

export interface ValidationConfiguration {
  message?: string | null;
  /** For regex. */
  pattern?: string | null;
  [key: string]: unknown;
}

export interface FormulateRow {
  /** True for a step divider, which has no cells. */
  isStep: boolean;
  cells: FormulateCell[];
}

export interface FormulateCell {
  /** How many of the 12 grid columns the cell spans. */
  columns: number;
  fields: { id: string }[];
}

/** The response to a submission (PascalCase, as the server sends it). */
export interface SubmissionResponse {
  Success: boolean;
  ValidationErrors?: SubmissionValidationError[] | null;
}

export interface SubmissionValidationError {
  FieldName?: string | null;
  FieldId?: string | null;
  Messages?: string[] | null;
}

/** Field values keyed by field alias (passed to setData when rawDataByAlias is true). */
export type DataByAlias = Record<string, unknown>;

/** What setData writes to: the FormData that is posted, or the values keyed by alias. */
export type FieldDataTarget = FormData | DataByAlias;

export interface SetDataOptions {
  rawDataByAlias?: boolean;
}

/** The result of one validator. */
export interface ValidationResult {
  success: boolean;
  message?: string | null;
}

/** The combined result of several validators. */
export interface AggregateValidationResult {
  success: boolean;
  messages?: string[];
}

export type ValidityOutcome = ValidationResult | AggregateValidationResult | ValidityOutcome[] | null | undefined;

/** What checkValidity may return: a promise or, as in v3, an array of promises. */
export type ValidityCheck =
  | PromiseLike<ValidityOutcome>
  | Array<PromiseLike<ValidityOutcome> | ValidityOutcome>
  | ValidityOutcome
  | void;

/** A rendered field. Custom renderers only need getElement; the rest is optional. */
export interface FieldRenderer {
  /** The element to add to the form. */
  getElement(): HTMLElement | null | undefined;
  /** Adds the field's value to the submission. */
  setData?(data: FieldDataTarget, options?: SetDataOptions): void;
  /** Validates the field (and shows its inline validation messages). */
  checkValidity?(): ValidityCheck;
  /** Buttons implement this so that submit buttons only work in the active step. */
  toggleSubmitButton?(enabled: boolean): void;
  /** The index of the step that contains the field. Set when the field is rendered. */
  stepIndex?: number;
  id?: string;
  alias?: string | null;
  /** The field's list of inline validation messages, if it is showing one. */
  validationListElement?: HTMLUListElement | null;
}

/** Passed to field renderers as an optional fourth constructor argument. */
export interface FieldRenderOptions {
  formElement: HTMLFormElement;
  placeholderElement: Element;
  stepIndex: number;
}

export type FieldRendererConstructor = new (
  fieldData: FormulateField,
  fieldValidators: FieldValidatorMap,
  cssClasses: string[],
  extraOptions: FieldRenderOptions,
) => FieldRenderer;

export interface FieldRendererRegistration {
  /** The field type, as in FormulateField.fieldType. */
  key: string;
  renderer: FieldRendererConstructor;
}

/** A validator. Each method resolves to true when the value is valid. Missing methods count as valid. */
export interface FieldValidator {
  validateText?(value: string | null | undefined): PromiseLike<boolean> | boolean;
  validateBool?(value: boolean): PromiseLike<boolean> | boolean;
  validateTextArray?(value: string[] | null | undefined): PromiseLike<boolean> | boolean;
  validateFile?(value: File | null | undefined): PromiseLike<boolean> | boolean;
}

/** The name of one of a validator's methods, such as "validateText". */
export type FieldValidatorMethod = keyof FieldValidator;

export type FieldValidatorConstructor = new (configuration: ValidationConfiguration) => FieldValidator;

/** Validator constructors keyed by validation type. Passed to field renderers as a plain object. */
export type FieldValidatorMap = Record<string, FieldValidatorConstructor>;

export interface FieldValidatorRegistration {
  /** The validation type, as in FormulateValidation.validationType. */
  key: string;
  validator: FieldValidatorConstructor;
}

/**
 * What window.formulatePlainJs holds: the renderer's version and everything
 * api.js exports (such as renderForm and registerFieldRenderer), for scripts
 * that are not modules.
 */
export type FormulatePlainJs = { version: string } & typeof import("./api.js");

declare global {
  interface Window {
    "formulate-plain-js-forms"?: FormulateForm[];
    "formulate-plain-js-fields"?: FieldRendererRegistration[] | FieldRendererRegistration;
    "formulate-plain-js-validators"?: FieldValidatorRegistration[] | FieldValidatorRegistration;
    /** How long (in milliseconds) the step animation classes stay on. Defaults to 500. */
    formulateMultiStepAnimationDelay?: number;
    /** Set to false to place text inputs after their labels (v3 option). */
    labelAfterTextInput?: boolean;
    formulatePlainJs?: FormulatePlainJs;
    /** Google's reCAPTCHA API. It exists before it is ready, so the ready callback below says when it is. */
    grecaptcha?: RecaptchaApi;
    /** Called by Google's script (the onload parameter) once the reCAPTCHA API is ready. */
    formulatePlainJsRecaptchaReady?: () => void;
  }
}

/** The parts of Google's reCAPTCHA API (loaded with render=explicit) that the renderer uses. */
export interface RecaptchaApi {
  /** Renders a widget into the container and returns its ID. */
  render(container: HTMLElement, parameters: { sitekey: string }): number;
  /** Clears the widget's response, so the visitor solves it again. */
  reset(widgetId?: number): void;
}
