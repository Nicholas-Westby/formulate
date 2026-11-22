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
  const extra = window["formulate-plain-js-fields"];
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

function isRegistration(value: unknown): value is FieldRendererRegistration {
  const registration = value as Partial<FieldRendererRegistration> | null | undefined;
  return typeof registration?.key === "string" && typeof registration.renderer === "function";
}
