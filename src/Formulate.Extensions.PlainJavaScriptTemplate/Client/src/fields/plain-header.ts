import type { FieldRendererRegistration, FieldValidatorMap, FormulateField } from "../types";
import { FieldRendererBase } from "../utils/field";

/** Renders a header (an h2). Its text is inserted as text, never as HTML. */
export class RenderHeader extends FieldRendererBase<HTMLHeadingElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({
      nodeName: "h2",
      cssClasses,
      usePlaceholder: false,
      useLabel: false,
      useWrapper: false,
    });
    this.element.appendChild(document.createTextNode(fieldData.configuration?.text ?? ""));
  }
}

export default { key: "header", renderer: RenderHeader } satisfies FieldRendererRegistration;
