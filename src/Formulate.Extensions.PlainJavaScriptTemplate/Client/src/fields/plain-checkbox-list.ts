import type {
  FieldRendererRegistration,
  FieldValidatorMap,
  FieldValidatorMethod,
  FormulateField,
} from "../types.js";
import { FieldRendererBase } from "../utils/field.js";

/**
 * Renders a list of checkboxes in a fieldset. Each checked value is posted
 * under the field's ID; by alias, the value is the array of checked values.
 */
export class RenderCheckboxList extends FieldRendererBase<HTMLInputElement> {
  static override validatorMethod: FieldValidatorMethod = "validateTextArray";

  readonly elements: HTMLInputElement[] = [];

  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    const fieldset = this.initializeGroup(cssClasses);
    for (const item of fieldData.configuration?.items ?? []) {
      const input = this.initializeField({
        type: "checkbox",
        value: item.value,
        label: item.label,
        cssClasses,
        usePlaceholder: false,
        wrapperElement: fieldset,
        nestFieldInLabel: true,
        wrapLabelText: true,
        fieldBeforeLabelText: true,
      });
      input.defaultChecked = item.selected === true;
      this.elements.push(input);
    }
  }

  /** The values of the checked checkboxes. */
  override getValue(): string[] {
    return this.elements.filter((x) => x.checked).map((x) => x.value);
  }
}

export default { key: "checkbox-list", renderer: RenderCheckboxList } satisfies FieldRendererRegistration;
