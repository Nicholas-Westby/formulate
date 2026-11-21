import type {
  FieldDataTarget,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types";
import { FieldRendererBase, getInitialValues, setData } from "../utils/field";
import { checkTextValidity } from "../utils/validation";

/**
 * Renders a hidden field. Its value is the initial value the server sends (the
 * query string value, or else the configured text), falling back to the
 * configured text.
 */
export class RenderHidden extends FieldRendererBase<HTMLInputElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    const input = this.initializeField({ type: "hidden", cssClasses, useLabel: false, usePlaceholder: false });
    input.value = getInitialValues(fieldData)[0] ?? fieldData.configuration?.text ?? "";
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    setData(data, this.element.value, options, this.alias, this.id);
  }

  override checkValidity() {
    return checkTextValidity(this, this.validators, this.element.value, this.getElement());
  }
}

export default { key: "hidden", renderer: RenderHidden } satisfies FieldRendererRegistration;
