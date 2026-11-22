import type {
  FieldRendererRegistration,
  FieldValidatorMap,
  FieldValidatorMethod,
  FormulateField,
} from "../types.js";
import { FieldRendererBase } from "../utils/field.js";

/**
 * Renders a file upload. Once a file is chosen, its name and a "Deselect File"
 * button appear after the label.
 */
export class RenderUpload extends FieldRendererBase<HTMLInputElement> {
  static override validatorMethod: FieldValidatorMethod = "validateFile";

  private filenameElement: HTMLElement | null = null;
  private deselectElement: HTMLButtonElement | null = null;

  constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
    super(fieldData, fieldValidators);
    this.initializeField({
      type: "file",
      cssClasses,
      nestFieldInLabel: true,
      wrapLabelText: true,
      fieldBeforeLabelText: true,
    });
    this.element.addEventListener("change", () => this.handleFileChange());
  }

  /** Returns the chosen file, or null. */
  getFile(): File | null {
    return this.element.files?.[0] ?? null;
  }

  /** The chosen file, or null. */
  override getValue(): File | null {
    return this.getFile();
  }

  private handleFileChange(): void {
    const file = this.getFile();
    if (file) {
      this.addFilename(file.name);
      this.addDeselectButton();
    } else {
      this.removeFilename();
      this.removeDeselectButton();
    }
  }

  private addFilename(name: string): void {
    this.removeFilename();
    const filenameElement = document.createElement("div");
    filenameElement.classList.add("formulate__field--upload__filename");
    filenameElement.appendChild(document.createTextNode(name));
    this.getElement().insertBefore(filenameElement, this.label?.nextSibling ?? null);
    this.filenameElement = filenameElement;
  }

  private addDeselectButton(): void {
    this.removeDeselectButton();
    const deselectElement = document.createElement("button");
    deselectElement.type = "button";
    deselectElement.classList.add("formulate__field--upload__deselect");
    deselectElement.appendChild(document.createTextNode("Deselect File"));
    deselectElement.addEventListener("click", () => {
      this.element.value = "";
      this.removeDeselectButton();
      this.removeFilename();
    });
    const previousSibling = this.filenameElement ?? this.label;
    this.getElement().insertBefore(deselectElement, previousSibling?.nextSibling ?? null);
    this.deselectElement = deselectElement;
  }

  private removeFilename(): void {
    this.filenameElement?.remove();
    this.filenameElement = null;
  }

  private removeDeselectButton(): void {
    this.deselectElement?.remove();
    this.deselectElement = null;
  }
}

export default { key: "upload", renderer: RenderUpload } satisfies FieldRendererRegistration;
