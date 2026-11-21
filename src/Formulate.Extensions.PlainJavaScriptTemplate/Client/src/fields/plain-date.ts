import type {
  FieldDataTarget,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types";
import { FieldRendererBase, setData } from "../utils/field";
import { checkTextValidity } from "../utils/validation";

/** Renders a date field. Its value is an ISO date (yyyy-MM-dd). */
export class RenderDate extends FieldRendererBase<HTMLInputElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ type: "date", cssClasses });
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    setData(data, this.element.value, options, this.alias, this.id);
  }

  override checkValidity() {
    return checkTextValidity(this, this.validators, this.element.value, this.getElement());
  }
}

export default { key: "date", renderer: RenderDate } satisfies FieldRendererRegistration;
