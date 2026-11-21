import type { FieldValidator, FieldValidatorRegistration } from "../types";

/** Checks that a field has a value. Text that is only whitespace counts as empty, as it does on the server. */
export class RequiredValidator implements FieldValidator {
  validateText(value: string | null | undefined): Promise<boolean> {
    return Promise.resolve(hasText(value));
  }

  validateBool(value: boolean): Promise<boolean> {
    return Promise.resolve(value === true);
  }

  /** Valid when at least one value is chosen and every value has text. */
  validateTextArray(value: string[] | null | undefined): Promise<boolean> {
    return Promise.resolve(Array.isArray(value) && value.length > 0 && value.every(hasText));
  }

  validateFile(value: File | null | undefined): Promise<boolean> {
    return Promise.resolve(Boolean(value?.name));
  }
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export default { key: "required", validator: RequiredValidator } satisfies FieldValidatorRegistration;
