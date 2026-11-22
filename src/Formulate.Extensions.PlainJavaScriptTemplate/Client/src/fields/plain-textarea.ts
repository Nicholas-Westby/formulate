import type {
  FieldDataTarget,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { FieldRendererBase, setData } from "../utils/field.js";
import { checkTextValidity } from "../utils/validation.js";

/** Renders a multi-line text field. */
export class RenderTextarea extends FieldRendererBase<HTMLTextAreaElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ nodeName: "textarea", cssClasses });
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    setData(data, this.element.value, options, this.alias, this.id);
  }

  override checkValidity() {
    return checkTextValidity(this, this.validators, this.element.value, this.getElement());
  }
}

export default { key: "textarea", renderer: RenderTextarea } satisfies FieldRendererRegistration;
