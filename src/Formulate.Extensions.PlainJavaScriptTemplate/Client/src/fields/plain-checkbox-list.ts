import type {
  FieldDataTarget,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { FieldRendererBase, setData } from "../utils/field.js";
import { checkTextArrayValidity } from "../utils/validation.js";

/**
 * Renders a list of checkboxes in a fieldset. Each checked value is posted
 * under the field's ID; by alias, the value is the array of checked values.
 */
export class RenderCheckboxList extends FieldRendererBase<HTMLInputElement> {
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

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    const values = this.getCheckedValues();
    if (options?.rawDataByAlias) {
      setData(data, values, options, this.alias, this.id);
      return;
    }
    for (const value of values) {
      setData(data, value, options, this.alias, this.id);
    }
  }

  override checkValidity() {
    return checkTextArrayValidity(this, this.validators, this.getCheckedValues(), this.getElement());
  }

  private getCheckedValues(): string[] {
    return this.elements.filter((x) => x.checked).map((x) => x.value);
  }
}

export default { key: "checkbox-list", renderer: RenderCheckboxList } satisfies FieldRendererRegistration;
