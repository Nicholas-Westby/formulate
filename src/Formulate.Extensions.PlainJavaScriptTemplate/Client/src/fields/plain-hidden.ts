import type { FieldRendererRegistration, FieldValidatorMap, FormulateField } from "../types.js";
import { FieldRendererBase, getInitialValues } from "../utils/field.js";

/**
 * Renders a hidden field. Its value is the initial value the server sends (the
 * query string value, or else the configured text), falling back to the
 * configured text. The base class posts and checks it.
 */
export class RenderHidden extends FieldRendererBase<HTMLInputElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    const input = this.initializeField({ type: "hidden", cssClasses, useLabel: false, usePlaceholder: false });
    input.value = getInitialValues(fieldData)[0] ?? fieldData.configuration?.text ?? "";
  }
}

export default { key: "hidden", renderer: RenderHidden } satisfies FieldRendererRegistration;
