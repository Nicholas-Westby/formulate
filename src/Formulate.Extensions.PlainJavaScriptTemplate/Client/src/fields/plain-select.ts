import type {
  FieldDataTarget,
  FieldItem,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { FieldRendererBase, setData } from "../utils/field.js";
import { checkTextValidity } from "../utils/validation.js";

const optionClass = "formulate__field__select__option";
const initialClass = "formulate__field--select--initial";

/**
 * Renders a drop down. Its first option (with an empty value) shows the label,
 * and the wrapper has the class formulate__field--select--initial until the
 * visitor chooses an option.
 */
export class RenderSelect extends FieldRendererBase<HTMLSelectElement> {
  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({ nodeName: "select", cssClasses });
    this.addOptions(fieldData.configuration?.items ?? []);
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    setData(data, this.element.value, options, this.alias, this.id);
  }

  override checkValidity() {
    return checkTextValidity(this, this.validators, this.element.value, this.getElement());
  }

  private addOptions(items: readonly FieldItem[]): void {
    if (items.length === 0) {
      return;
    }
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createOption({ value: "", label: this.fieldData.label ?? "" }, true));
    for (const item of items) {
      fragment.appendChild(createOption(item, false));
    }
    this.element.appendChild(fragment);
    // Initial values are applied with a change event once the form is rendered.
    this.element.addEventListener("change", () => this.handleValueChange());
    this.handleValueChange();
  }

  private handleValueChange(): void {
    this.wrapper?.classList.toggle(initialClass, this.element.value === "");
  }
}

function createOption(item: FieldItem, isInitial: boolean): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = item.value;
  option.appendChild(document.createTextNode(item.label));
  option.classList.add(optionClass);
  if (isInitial) {
    option.classList.add(`${optionClass}--initial`);
  } else if (item.selected) {
    option.defaultSelected = true;
  }
  return option;
}

export default { key: "select", renderer: RenderSelect } satisfies FieldRendererRegistration;
