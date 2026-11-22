import type { FieldRenderOptions, FieldRendererRegistration, FieldValidatorMap, FormulateField } from "../types.js";
import { dispatchFormEvent, FormulateEvents } from "../utils/events.js";
import { FieldRendererBase } from "../utils/field.js";

/**
 * Renders a button. "Next" and "Previous" buttons move between the steps of a
 * multi-step form; any other kind submits the form. Buttons are disabled while
 * the form is being submitted, and a submit button only works in the active step.
 */
export class RenderButton extends FieldRendererBase<HTMLButtonElement> {
  readonly buttonKind: string | null;
  private readonly buttonType: "button" | "submit";
  private readonly formElement: HTMLFormElement;
  /** False for a submit button outside the active step. */
  private enabledInStep = true;

  constructor(
    fieldData: FormulateField,
    fieldValidators: FieldValidatorMap,
    cssClasses: string[],
    extraOptions: FieldRenderOptions,
  ) {
    super(fieldData, fieldValidators);
    this.buttonKind = fieldData.configuration?.buttonKind ?? null;
    this.buttonType = this.buttonKind === "Next" || this.buttonKind === "Previous" ? "button" : "submit";
    this.formElement = extraOptions.formElement;
    this.initializeField({
      nodeName: "button",
      type: this.buttonType,
      cssClasses,
      usePlaceholder: false,
      useLabel: false,
    });
    this.element.appendChild(document.createTextNode(fieldData.label ?? ""));

    // The first step is active, so submit buttons in later steps start disabled.
    if (extraOptions.stepIndex > 0) {
      this.toggleSubmitButton(false);
    }

    this.listenForButtonClicks();
    this.listenForSubmit();
    this.listenForFailureEvents();
  }

  /** Enables or disables the button if it is a submit button (when its step becomes active or inactive). */
  toggleSubmitButton(enabled: boolean): void {
    if (this.buttonType === "submit") {
      this.enabledInStep = enabled;
      this.element.disabled = !enabled;
    }
  }

  /** Returns the kind of button ("Next", "Previous" or "Submit"). */
  getButtonKind(): string | null {
    return this.buttonKind;
  }

  private listenForButtonClicks(): void {
    this.element.addEventListener("click", () => {
      if (this.buttonKind === "Previous") {
        dispatchFormEvent(this.formElement, FormulateEvents.previous);
      } else if (this.buttonKind === "Next") {
        dispatchFormEvent(this.formElement, FormulateEvents.next);
      }
    });
  }

  private listenForSubmit(): void {
    this.formElement.addEventListener(
      FormulateEvents.submitStarted,
      () => {
        this.element.disabled = true;
      },
      true,
    );
  }

  /** Enables the button again when a submission stops without succeeding. */
  private listenForFailureEvents(): void {
    const handleFailure = (event: Event) => {
      // A step that fails validation did not disable the buttons, so there is nothing to undo.
      const detail = (event as CustomEvent<{ isStep?: boolean } | null>).detail;
      if (!detail?.isStep) {
        this.element.disabled = !this.enabledInStep;
      }
    };
    for (const eventName of [
      FormulateEvents.validationErrors,
      FormulateEvents.submitFailure,
      FormulateEvents.submitCancelled,
    ]) {
      this.formElement.addEventListener(eventName, handleFailure, true);
    }
  }
}

export default { key: "button", renderer: RenderButton } satisfies FieldRendererRegistration;
