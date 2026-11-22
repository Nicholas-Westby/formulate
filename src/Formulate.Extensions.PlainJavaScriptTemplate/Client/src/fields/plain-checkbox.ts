import type {
  FieldDataTarget,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { FieldRendererBase, setData } from "../utils/field.js";
import { checkBoolValidity } from "../utils/validation.js";

/** Renders a single checkbox. It posts "true" or "false". */
export class RenderCheckbox extends FieldRendererBase<HTMLInputElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ type: "checkbox", cssClasses, usePlaceholder: false });
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    setData(data, this.element.checked, options, this.alias, this.id);
  }

  override checkValidity() {
    return checkBoolValidity(this, this.validators, this.element.checked, this.getElement());
  }
}

export default { key: "checkbox", renderer: RenderCheckbox } satisfies FieldRendererRegistration;
