import type { FieldRendererRegistration, FieldValidatorMap, FormulateField } from "../types";
import { FieldRendererBase } from "../utils/field";

/**
 * Renders rich text. The text is HTML written in the back office's rich text
 * editor, so (as in v3) it is inserted as HTML. It is the only field content
 * that is.
 */
export class RenderRichText extends FieldRendererBase<HTMLDivElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({
      nodeName: "div",
      cssClasses,
      usePlaceholder: false,
      useLabel: false,
      useWrapper: false,
    });
    this.element.innerHTML = fieldData.configuration?.text ?? "";
  }
}

export default { key: "rich-text", renderer: RenderRichText } satisfies FieldRendererRegistration;
