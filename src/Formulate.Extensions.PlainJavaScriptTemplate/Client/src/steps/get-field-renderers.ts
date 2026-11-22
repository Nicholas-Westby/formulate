import plainButton from "../fields/plain-button.js";
import plainCheckbox from "../fields/plain-checkbox.js";
import plainCheckboxList from "../fields/plain-checkbox-list.js";
import plainDate from "../fields/plain-date.js";
import plainExtendedRadioButtonList from "../fields/plain-extended-radio-button-list.js";
import plainHeader from "../fields/plain-header.js";
import plainHidden from "../fields/plain-hidden.js";
import plainRadioButtonList from "../fields/plain-radio-button-list.js";
import plainRecaptcha from "../fields/plain-recaptcha.js";
import plainRichText from "../fields/plain-rich-text.js";
import plainSelect from "../fields/plain-select.js";
import plainText from "../fields/plain-text.js";
import plainTextarea from "../fields/plain-textarea.js";
import plainUpload from "../fields/plain-upload.js";
import type { FieldRendererConstructor, FieldRendererRegistration } from "../types.js";
import { getPageState } from "../utils/page-state.js";

const fieldsKey = "formulate-plain-js-fields";

const builtInRenderers: readonly FieldRendererRegistration[] = [
  plainText,
  plainButton,
  plainRichText,
  plainCheckbox,
  plainTextarea,
  plainHidden,
  plainSelect,
  plainHeader,
  plainUpload,
  plainCheckboxList,
  plainDate,
  plainRadioButtonList,
  plainExtendedRadioButtonList,
  plainRecaptcha,
];

/**
 * Returns the field renderers keyed by field type: the built-in ones, plus the
 * ones registered on window["formulate-plain-js-fields"] (an array of
 * { key, renderer }, or a single one). A registered renderer replaces the
 * built-in renderer with the same key.
 */
export function getFieldRenderers(): Map<string, FieldRendererConstructor> {
  const extra = window[fieldsKey];
  const registrations: unknown[] = [...builtInRenderers, ...(Array.isArray(extra) ? extra : extra ? [extra] : [])];
  const renderers = new Map<string, FieldRendererConstructor>();
  for (const registration of registrations) {
    if (isRegistration(registration)) {
      renderers.set(registration.key, registration.renderer);
    } else {
      console.warn("Formulate: ignoring a field renderer registration without a key and a renderer.", registration);
    }
  }
  return renderers;
}

/**
 * Registers a field renderer (a class) for a field type, such as "phone". It
 * replaces the built-in renderer with that key, and a later registration for
 * the same key replaces it. The registration goes on
 * window["formulate-plain-js-fields"], which every copy of the renderer reads
 * when it renders a form, so forms rendered after it use it. A renderer
 * registered after a form on the page rendered a field of its type is used by
 * the forms rendered from then on, and a warning says so.
 */
export function registerFieldRenderer(key: string, renderer: FieldRendererConstructor): void {
  if (typeof key !== "string" || key === "" || typeof renderer !== "function") {
    throw new TypeError("Formulate: registerFieldRenderer(key, renderer) needs a field type (a string) and a renderer (a class).");
  }
  const registrations = window[fieldsKey];
  if (Array.isArray(registrations)) {
    registrations.push({ key, renderer });
  } else {
    // A v3 script may have set a single registration.
    window[fieldsKey] = [...(registrations ? [registrations] : []), { key, renderer }];
  }
  if (getPageState().renderedFieldTypes.has(key)) {
    console.warn(
      `Formulate: the renderer for the field type "${key}" was registered after a form on the page rendered a field of that type. Only forms rendered from now on use it. Register renderers before DOMContentLoaded.`,
    );
  }
}

function isRegistration(value: unknown): value is FieldRendererRegistration {
  const registration = value as Partial<FieldRendererRegistration> | null | undefined;
  return typeof registration?.key === "string" && typeof registration.renderer === "function";
}
