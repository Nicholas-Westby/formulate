import type {
  AggregateValidationResult,
  DataByAlias,
  FieldDataTarget,
  FieldRenderer,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types";
import { addClasses } from "./add-classes";
import { generateId } from "./generate-id";
import { prepareValidators, type PreparedValidator } from "./validation";

/**
 * Adds a field's value to the FormData (keyed by field ID) or, when
 * options.rawDataByAlias is set, to an object keyed by field alias. Empty
 * (null or undefined) values are not posted.
 */
export function setData(
  data: FieldDataTarget,
  value: unknown,
  options: SetDataOptions | undefined,
  alias: string | null | undefined,
  id: string,
): void {
  if (options?.rawDataByAlias) {
    if (alias) {
      (data as DataByAlias)[alias] = value;
    }
    return;
  }
  if (value === null || value === undefined) {
    return;
  }
  (data as FormData).append(id, value instanceof Blob ? value : String(value));
}

/** Returns the field's non-empty initial values (the server sends a string; v3 sent an array). */
export function getInitialValues(field: FormulateField): string[] {
  const values = Array.isArray(field.initialValue) ? field.initialValue : [field.initialValue];
  return values.filter((x): x is string => typeof x === "string" && x !== "");
}

export interface InitializeFieldOptions {
  /** The element to create. Defaults to "input". */
  nodeName?: string;
  /** The type attribute (such as "text" or "checkbox"). */
  type?: string;
  name?: string;
  value?: string;
  cssClasses?: readonly string[];
  /** Use the label text as the placeholder. Defaults to true. */
  usePlaceholder?: boolean;
  /** Create a label. Defaults to true. */
  useLabel?: boolean;
  /** Put the field in a wrapper element. Defaults to true. */
  useWrapper?: boolean;
  /** An existing wrapper to add the field to (for lists of checkboxes or radio buttons). */
  wrapperElement?: HTMLElement | null;
  /** The wrapper element to create. Defaults to "div". */
  wrapperElementType?: string;
  /** Put the field inside its label. */
  nestFieldInLabel?: boolean;
  /** Wrap the label text in a span with the class formulate__field__label-text. */
  wrapLabelText?: boolean;
  /** Put the field before the label (text). Defaults to true. */
  fieldBeforeLabelText?: boolean;
  /** The label text. Defaults to the field's label. */
  label?: string | null;
  /** A second span of label text (used with wrapLabelText). */
  label2?: string | null;
}

/**
 * The base class of the built-in field renderers. It keeps the properties v3
 * renderers had (id, alias, wrapper, element, label, validators) and builds the
 * markup that v3 styles and the Basic theme expect.
 */
export abstract class FieldRendererBase<TElement extends HTMLElement = HTMLElement> implements FieldRenderer {
  id: string;
  alias: string | null;
  stepIndex = 0;
  /** The element that wraps the field, or null for fields without one (header and rich text). */
  wrapper: HTMLElement | null = null;
  /** The field's element. For lists of checkboxes or radio buttons, the last one. */
  element!: TElement;
  label: HTMLLabelElement | null = null;
  validators: PreparedValidator[];
  validationListElement: HTMLUListElement | null = null;
  protected readonly fieldData: FormulateField;

  protected constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap) {
    this.fieldData = fieldData;
    this.id = fieldData.id;
    this.alias = fieldData.alias ?? null;
    this.validators = prepareValidators(fieldData.validations, fieldValidators);
  }

  /** Returns the element to add to the form. */
  getElement(): HTMLElement {
    return this.wrapper ?? this.element;
  }

  /** Adds the field's value to the submission. By default, there is nothing to add. */
  setData(_data: FieldDataTarget, _options?: SetDataOptions): void {}

  /** Validates the field. By default, it is always valid. */
  checkValidity(): Promise<AggregateValidationResult> {
    return Promise.resolve({ success: true });
  }

  /** Returns the category chosen for the field in the back office. */
  getCategory(): string | null {
    return this.fieldData.category ?? null;
  }

  /**
   * Creates the field's element, label and wrapper (as v3's Field.initializeField
   * did) and stores them on the renderer. Returns the field's element.
   */
  protected initializeField(options: InitializeFieldOptions): TElement {
    const useWrapper = options.useWrapper !== false;
    const useLabel = options.useLabel !== false;
    const labelText = ("label" in options ? options.label : this.fieldData.label) ?? "";

    const element = document.createElement(options.nodeName ?? "input") as TElement;
    if (options.type) {
      element.setAttribute("type", options.type);
    }
    if (options.name !== undefined) {
      element.setAttribute("name", options.name);
    }
    if (options.value !== undefined) {
      element.setAttribute("value", options.value);
    }
    if (this.fieldData.category) {
      element.setAttribute("data-category", this.fieldData.category);
    }
    // The field gets its accessible name from its <label> (which includes any
    // second label text, such as an extended radio button's description), so
    // there is no aria-label.
    if (options.usePlaceholder !== false) {
      element.setAttribute("placeholder", labelText);
    }

    const wrapper = useWrapper
      ? (options.wrapperElement ?? document.createElement(options.wrapperElementType ?? "div"))
      : element;
    this.addFieldClasses(wrapper, options.cssClasses);

    let label: HTMLLabelElement | null = null;
    if (useLabel) {
      label = createLabel(labelText, options);
      element.id = generateId("formulate-field-");
      label.htmlFor = element.id;
      wrapper.appendChild(label);
    }

    if (useWrapper) {
      if (options.nestFieldInLabel && label) {
        if (options.fieldBeforeLabelText) {
          label.insertBefore(element, label.firstChild);
        } else {
          label.appendChild(element);
        }
      } else if (options.fieldBeforeLabelText === false || window.labelAfterTextInput === false) {
        wrapper.appendChild(element);
      } else {
        // Before the label, so that styles can target "input + label".
        wrapper.insertBefore(element, wrapper.lastChild);
      }
      this.wrapper = wrapper;
    }
    this.element = element;
    this.label = label;
    return element;
  }

  /** Creates the fieldset (with a legend) that wraps a list of checkboxes or radio buttons. */
  protected initializeGroup(cssClasses: readonly string[]): HTMLFieldSetElement {
    const fieldset = document.createElement("fieldset");
    this.addFieldClasses(fieldset, cssClasses);
    const legend = document.createElement("legend");
    legend.classList.add("formulate__field__label", "formulate__field__label--group");
    legend.appendChild(document.createTextNode(this.fieldData.label ?? ""));
    fieldset.appendChild(legend);
    this.wrapper = fieldset;
    return fieldset;
  }

  /** Adds the CSS classes, plus one class per validation type (such as formulate__validation-type--required). */
  protected addFieldClasses(element: Element, cssClasses: readonly string[] = []): void {
    const validationTypes = new Set((this.fieldData.validations ?? []).map((x) => x.validationType));
    addClasses(element, cssClasses);
    addClasses(
      element,
      [...validationTypes].filter(Boolean).map((x) => `formulate__validation-type--${x}`),
    );
  }
}

function createLabel(text: string, options: InitializeFieldOptions): HTMLLabelElement {
  const label = document.createElement("label");
  label.classList.add("formulate__field__label");
  if (options.wrapLabelText) {
    label.appendChild(createLabelText(text));
    if (options.label2 !== undefined && options.label2 !== null) {
      // The space keeps the two texts apart in the accessible name (and without a theme).
      label.appendChild(document.createTextNode(" "));
      label.appendChild(createLabelText(options.label2));
    }
  } else {
    label.appendChild(document.createTextNode(text));
  }
  return label;
}

function createLabelText(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.classList.add("formulate__field__label-text");
  span.appendChild(document.createTextNode(text));
  return span;
}
