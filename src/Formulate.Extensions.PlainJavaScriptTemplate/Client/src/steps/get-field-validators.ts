import type { FieldValidatorMap, FieldValidatorRegistration } from "../types.js";
import regex from "../validators/regex.js";
import required from "../validators/required.js";

const builtInValidators: readonly FieldValidatorRegistration[] = [regex, required];

/**
 * Returns the validators keyed by validation type: the built-in ones, plus the
 * ones registered on window["formulate-plain-js-validators"] (an array of
 * { key, validator }, or a single one). It is a plain object because field
 * renderers receive it (v3 renderers look validators up by key).
 */
export function getFieldValidators(): FieldValidatorMap {
  const extra = window["formulate-plain-js-validators"];
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

function isRegistration(value: unknown): value is FieldValidatorRegistration {
  const registration = value as Partial<FieldValidatorRegistration> | null | undefined;
  return typeof registration?.key === "string" && typeof registration.validator === "function";
}
