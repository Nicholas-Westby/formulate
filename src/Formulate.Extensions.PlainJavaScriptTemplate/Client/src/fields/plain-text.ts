import type {
  FieldDataTarget,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { FieldRendererBase, setData } from "../utils/field.js";
import { checkTextValidity } from "../utils/validation.js";

/** Renders a text field. */
export class RenderText extends FieldRendererBase<HTMLInputElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ type: "text", cssClasses });
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    setData(data, this.element.value, options, this.alias, this.id);
  }

  override checkValidity() {
    return checkTextValidity(this, this.validators, this.element.value, this.getElement());
  }
}

export default { key: "text", renderer: RenderText } satisfies FieldRendererRegistration;
