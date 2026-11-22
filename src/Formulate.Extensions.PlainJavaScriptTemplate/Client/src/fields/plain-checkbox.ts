import type {
  FieldRendererRegistration,
  FieldValidatorMap,
  FieldValidatorMethod,
  FormulateField,
} from "../types.js";
import { FieldRendererBase } from "../utils/field.js";

/** Renders a single checkbox. It posts "true" or "false". */
export class RenderCheckbox extends FieldRendererBase<HTMLInputElement> {
  static override validatorMethod: FieldValidatorMethod = "validateBool";

  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ type: "checkbox", cssClasses, usePlaceholder: false });
  }

  /** Whether the checkbox is checked. */
  override getValue(): boolean {
    return this.element.checked;
  }
}

export default { key: "checkbox", renderer: RenderCheckbox } satisfies FieldRendererRegistration;
