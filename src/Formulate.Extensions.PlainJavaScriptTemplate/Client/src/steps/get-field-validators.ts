import type { FieldValidatorConstructor, FieldValidatorMap, FieldValidatorRegistration } from "../types.js";
import { getPageState } from "../utils/page-state.js";
import regex from "../validators/regex.js";
import required from "../validators/required.js";

const validatorsKey = "formulate-plain-js-validators";

const builtInValidators: readonly FieldValidatorRegistration[] = [regex, required];

/**
 * Returns the validators keyed by validation type: the built-in ones, plus the
 * ones registered on window["formulate-plain-js-validators"] (an array of
 * { key, validator }, or a single one). It is a plain object because field
 * renderers receive it (v3 renderers look validators up by key).
 */
export function getFieldValidators(): FieldValidatorMap {
  const extra = window[validatorsKey];
  const registrations: unknown[] = [...builtInValidators, ...(Array.isArray(extra) ? extra : extra ? [extra] : [])];
  const validators: FieldValidatorMap = {};
  for (const registration of registrations) {
    if (isRegistration(registration)) {
      validators[registration.key] = registration.validator;
    } else {
      console.warn("Formulate: ignoring a validator registration without a key and a validator.", registration);
    }
  }
  return validators;
}

/**
 * Registers a validator (a class) for a validation type, such as "required".
 * It replaces the built-in validator with that key, and a later registration
 * for the same key replaces it. Like registerFieldRenderer, it goes on the
 * window (window["formulate-plain-js-validators"]), forms rendered after it
 * use it, and registering it after a form used its validation type warns.
 */
export function registerValidator(key: string, validator: FieldValidatorConstructor): void {
  if (typeof key !== "string" || key === "" || typeof validator !== "function") {
    throw new TypeError("Formulate: registerValidator(key, validator) needs a validation type (a string) and a validator (a class).");
  }
  const registrations = window[validatorsKey];
  if (Array.isArray(registrations)) {
    registrations.push({ key, validator });
  } else {
    // A v3 script may have set a single registration.
    window[validatorsKey] = [...(registrations ? [registrations] : []), { key, validator }];
  }
  if (getPageState().renderedValidationTypes.has(key)) {
    console.warn(
      `Formulate: the validator for the validation type "${key}" was registered after a form on the page used that type. Only forms rendered from now on use it. Register validators before DOMContentLoaded.`,
    );
  }
}

function isRegistration(value: unknown): value is FieldValidatorRegistration {
  const registration = value as Partial<FieldValidatorRegistration> | null | undefined;
  return typeof registration?.key === "string" && typeof registration.validator === "function";
}
