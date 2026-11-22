import type {
  FieldRenderer,
  FieldRendererConstructor,
  FieldValidatorMap,
  FormulateField,
  FormulateForm,
} from "../types.js";
import { getInitialValues } from "../utils/field.js";
import { mapFieldsById } from "../utils/map-fields-by-id.js";
import { renderCell } from "./render-cell.js";
import { renderField } from "./render-field.js";
import { renderRow } from "./render-row.js";

/** A field that was rendered, with its data and the index of its step. */
export interface RenderedField {
  renderer: FieldRenderer;
  data: FormulateField;
  stepIndex: number;
}

type InputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const inputSelector = "input, textarea, select";

/**
 * Renders the form's steps, rows, cells and fields into the form element. The
 * rows between step dividers make up a step, and the first step is active.
 * Returns the rendered fields, in order.
 */
export function renderFormContents(
  form: FormulateForm,
  formElement: HTMLFormElement,
  placeholderElement: Element,
  fieldRenderers: ReadonlyMap<string, FieldRendererConstructor>,
  fieldValidators: FieldValidatorMap,
): RenderedField[] {
  const fieldMap = mapFieldsById(form.data.fields ?? []);
  const renderedFields: RenderedField[] = [];
  let stepIndex = 0;
  let stepElement: HTMLElement | null = null;

  for (const row of form.data.rows ?? []) {
    if (row.isStep) {
      // A divider ends the current step. Dividers with no rows before them are ignored.
      if (stepElement) {
        stepIndex++;
        stepElement = null;
      }
      continue;
    }

    const isActiveStep = stepIndex === 0;
    if (!stepElement) {
      stepElement = renderStep(stepIndex, isActiveStep);
      formElement.appendChild(stepElement);
    }
    const rowElement = renderRow(stepIndex, isActiveStep);
    stepElement.appendChild(rowElement);

    for (const cell of row.cells ?? []) {
      const cellElement = renderCell(cell.columns);
      rowElement.appendChild(cellElement);
      for (const { id } of cell.fields ?? []) {
        const data = fieldMap.get(id);
        if (!data) {
          continue;
        }
        const renderer = renderField(data, fieldRenderers, fieldValidators, {
          formElement,
          placeholderElement,
          stepIndex,
        });
        if (!renderer) {
          continue;
        }
        const element = renderer.getElement();
        if (element) {
          prepopulateValue(element, getInitialValues(data));
          cellElement.appendChild(element);
        }
        renderedFields.push({ renderer, data, stepIndex });
      }
    }
  }

  return renderedFields;
}

function renderStep(stepIndex: number, isActiveStep: boolean): HTMLElement {
  const stepElement = document.createElement("section");
  stepElement.classList.add(
    "formulate__step",
    `formulate__step--${isActiveStep ? "active" : "inactive"}`,
    `formulate__step-${stepIndex}`,
  );
  stepElement.setAttribute("aria-label", `Form Step #${stepIndex + 1}`);
  // Inactive steps are hidden by the renderer, so forms work without a theme.
  stepElement.hidden = !isActiveStep;
  return stepElement;
}

/** The initial values that check a lone checkbox (one without a value of its own). */
const checkedValuePattern = /^(true|on|1|yes)$/i;

/**
 * Applies a field's initial values (such as values from the query string) to
 * its inputs. A lone input takes the value, and a lone checkbox without a value
 * of its own is checked by "true", "on", "1" or "yes". In a list of checkboxes
 * or radio buttons (even a list of one), the items with matching values are
 * checked. Each changed input gets a change event so its renderer can react.
 */
function prepopulateValue(element: HTMLElement, values: readonly string[]): void {
  if (values.length === 0) {
    return;
  }
  const inputs = (
    element.matches(inputSelector) ? [element] : [...element.querySelectorAll<InputElement>(inputSelector)]
  ) as InputElement[];
  // A file input cannot be given a value.
  const fillable = inputs.filter((x) => x.type !== "file");
  for (const input of fillable) {
    if (input instanceof HTMLInputElement && (input.type === "checkbox" || input.type === "radio")) {
      const isLoneCheckbox = fillable.length === 1 && input.type === "checkbox" && !input.hasAttribute("value");
      const isChecked = isLoneCheckbox
        ? values.some((x) => checkedValuePattern.test(x))
        : values.includes(input.value);
      if (isChecked) {
        input.checked = true;
        notifyChange(input);
      }
    } else if (fillable.length === 1 && values.length === 1) {
      input.value = values[0];
      notifyChange(input);
    }
  }
}

function notifyChange(input: InputElement): void {
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
