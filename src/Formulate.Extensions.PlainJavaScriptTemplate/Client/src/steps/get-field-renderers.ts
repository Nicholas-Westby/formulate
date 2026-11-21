import plainButton from "../fields/plain-button";
import plainCheckbox from "../fields/plain-checkbox";
import plainCheckboxList from "../fields/plain-checkbox-list";
import plainDate from "../fields/plain-date";
import plainExtendedRadioButtonList from "../fields/plain-extended-radio-button-list";
import plainHeader from "../fields/plain-header";
import plainHidden from "../fields/plain-hidden";
import plainRadioButtonList from "../fields/plain-radio-button-list";
import plainRecaptcha from "../fields/plain-recaptcha";
import plainRichText from "../fields/plain-rich-text";
import plainSelect from "../fields/plain-select";
import plainText from "../fields/plain-text";
import plainTextarea from "../fields/plain-textarea";
import plainUpload from "../fields/plain-upload";
import type { FieldRendererConstructor, FieldRendererRegistration } from "../types";

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
