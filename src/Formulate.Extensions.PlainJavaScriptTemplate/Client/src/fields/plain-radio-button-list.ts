import type {
  FieldDataTarget,
  FieldItem,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { FieldRendererBase, setData } from "../utils/field.js";
import { generateId } from "../utils/generate-id.js";
import { checkTextValidity } from "../utils/validation.js";

/** Renders a list of radio buttons in a fieldset. The chosen value is posted under the field's ID. */
export class RenderRadioList extends FieldRendererBase<HTMLInputElement> {
  readonly elements: HTMLInputElement[] = [];

  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    const fieldset = this.initializeGroup(cssClasses);
    const name = generateId("radio-button-list-");
    for (const item of fieldData.configuration?.items ?? []) {
      const input = this.initializeField({
        ...this.getItemLabels(item),
        type: "radio",
        name,
        value: item.value,
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
    const value = this.getCheckedValue();
    if (value !== null) {
      setData(data, value, options, this.alias, this.id);
    }
  }

  override checkValidity() {
    return checkTextValidity(this, this.validators, this.getCheckedValue(), this.getElement());
  }

  /** The text shown next to an item's radio button. */
  protected getItemLabels(item: FieldItem): { label: string; label2?: string | null } {
    return { label: item.label };
  }

  private getCheckedValue(): string | null {
    return this.elements.find((x) => x.checked)?.value ?? null;
  }
}

export default { key: "radio-list", renderer: RenderRadioList } satisfies FieldRendererRegistration;
