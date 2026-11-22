import type {
  FieldDataTarget,
  FieldRenderOptions,
  FieldRendererRegistration,
  FieldValidatorMap,
  FormulateField,
  SetDataOptions,
} from "../types.js";
import { addClasses } from "../utils/add-classes.js";
import { FormulateEvents } from "../utils/events.js";
import { FieldRendererBase } from "../utils/field.js";
import { getPageState } from "../utils/page-state.js";
import { prepareValidators } from "../utils/validation.js";

const readyCallbackName = "formulatePlainJsRecaptchaReady";
const googleScriptUrl = `https://www.google.com/recaptcha/api.js?render=explicit&onload=${readyCallbackName}`;

/**
 * Renders a reCAPTCHA (v2 checkbox). Google's script is added to the page the
 * first time a form with a reCAPTCHA field is rendered, and every widget is
 * rendered explicitly: the ones on the page when the API becomes ready, and
 * the ones in forms rendered later. That holds across the copies of the
 * renderer on the page (the readable and the minified files), which share
 * the script through the page state. The response token is posted under the
 * field's ID, and the field is required even if no validation was added to it.
 */
export class RenderRecaptcha extends FieldRendererBase<HTMLDivElement> {
  private readonly siteKey: string;
  private widgetId: number | null = null;

  constructor(
    fieldData: FormulateField,
    fieldValidators: FieldValidatorMap,
    cssClasses: string[],
    extraOptions: FieldRenderOptions,
  ) {
    super(fieldData, fieldValidators);
    this.siteKey = fieldData.configuration?.siteKey ?? "";
    if (!this.siteKey) {
      console.warn("Formulate: the reCAPTCHA site key is not configured (Formulate:Recaptcha:SiteKey).");
    }
    const element = document.createElement("div");
    element.classList.add("g-recaptcha");
    element.setAttribute("data-sitekey", this.siteKey);
    addClasses(element, cssClasses);
    this.element = element;
    this.wrapper = element;

    if (this.validators.length === 0) {
      this.validators = prepareValidators(
        [
          {
            id: "",
            alias: "recaptchaRequired",
            validationType: "required",
            configuration: { message: "Please solve the reCAPTCHA." },
          },
        ],
        fieldValidators,
      );
    }

    // A response token can only be checked once, so a failed post needs a new one.
    extraOptions.formElement.addEventListener(FormulateEvents.submitFailure, () => this.resetWidget());

    loadGoogleScript();
    // The form is on the page once the current rendering has finished.
    queueMicrotask(() => {
      const recaptcha = getPageState().recaptcha;
      if (recaptcha.apiReady) {
        this.renderWidget();
      } else {
        recaptcha.waitingFields.add(this);
      }
    });
  }

  override setData(data: FieldDataTarget, options?: SetDataOptions): void {
    // The token is meaningless to listeners, so it is left out of the values by alias.
    if (!options?.rawDataByAlias) {
      super.setData(data, options);
    }
  }

  /** The token Google's widget stores once the reCAPTCHA is solved, or null. */
  override getValue(): string | null {
    return this.element.querySelector<HTMLTextAreaElement>("[name='g-recaptcha-response']")?.value ?? null;
  }

  /** Renders Google's widget into the field (once). */
  renderWidget(): void {
    if (this.widgetId !== null || !this.siteKey || !window.grecaptcha) {
      return;
    }
    try {
      this.widgetId = window.grecaptcha.render(this.element, { sitekey: this.siteKey });
    } catch (error) {
      console.error("Formulate: unable to render the reCAPTCHA.", error);
    }
  }

  private resetWidget(): void {
    if (this.widgetId !== null) {
      window.grecaptcha?.reset(this.widgetId);
    }
  }
}

/** Adds Google's script (once), with a callback that renders the waiting widgets when the API is ready. */
function loadGoogleScript(): void {
  const recaptcha = getPageState().recaptcha;
  if (recaptcha.scriptRequested) {
    return;
  }
  recaptcha.scriptRequested = true;
  window[readyCallbackName] = () => {
    recaptcha.apiReady = true;
    for (const field of recaptcha.waitingFields) {
      field.renderWidget();
    }
    recaptcha.waitingFields.clear();
  };
  const script = document.createElement("script");
  script.src = googleScriptUrl;
  script.async = true;
  document.head.appendChild(script);
}

export default { key: "recaptcha", renderer: RenderRecaptcha } satisfies FieldRendererRegistration;
