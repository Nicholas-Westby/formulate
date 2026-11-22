import type { FieldRendererRegistration, FieldValidatorMap, FormulateField } from "../types.js";
import { FieldRendererBase } from "../utils/field.js";

/** Renders a multi-line text field. The base class posts and checks its value. */
export class RenderTextarea extends FieldRendererBase<HTMLTextAreaElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ nodeName: "textarea", cssClasses });
  }
}

export default { key: "textarea", renderer: RenderTextarea } satisfies FieldRendererRegistration;
