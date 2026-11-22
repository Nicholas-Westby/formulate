import type { FieldRendererRegistration, FieldValidatorMap, FormulateField } from "../types.js";
import { FieldRendererBase } from "../utils/field.js";

/**
 * Renders a text field. The base class posts and checks its value. A subclass
 * can change the input's type and keep everything else, as RenderDate does:
 *
 *     class RenderPhone extends RenderText { static inputType = "tel"; }
 */
export class RenderText extends FieldRendererBase<HTMLInputElement> {
  /** The input's type attribute, such as "text", "tel", "email", "url" or "date". */
  static inputType = "text";

  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    const { inputType } = this.constructor as typeof RenderText;
    this.initializeField({ type: inputType, cssClasses });
  }
}

export default { key: "text", renderer: RenderText } satisfies FieldRendererRegistration;
