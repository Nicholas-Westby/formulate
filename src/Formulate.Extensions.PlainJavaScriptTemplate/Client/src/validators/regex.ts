import type { FieldValidator, FieldValidatorRegistration, ValidationConfiguration } from "../types.js";

/**
 * Checks that a field's value matches the configured pattern. Empty values are
 * tested too (as in v3), so a pattern that should allow an empty field must
 * match an empty string.
 */
export class RegexValidator implements FieldValidator {
  private readonly regex: RegExp | null;

  constructor(configuration: ValidationConfiguration) {
    this.regex = compile(configuration.pattern ?? "");
  }

  validateText(value: string | null | undefined): Promise<boolean> {
    return Promise.resolve(this.test(value ?? ""));
  }

  validateBool(value: boolean): Promise<boolean> {
    return Promise.resolve(this.test(value === true ? "true" : "false"));
  }

  /** Valid when at least one value is chosen and every value matches. */
  validateTextArray(value: string[] | null | undefined): Promise<boolean> {
    return Promise.resolve(Array.isArray(value) && value.length > 0 && value.every((x) => this.test(x ?? "")));
  }

  /** Tests the file name. */
  validateFile(value: File | null | undefined): Promise<boolean> {
    return Promise.resolve(this.test(value?.name ?? ""));
  }

  private test(text: string): boolean {
    return this.regex === null || this.regex.test(text);
  }
}

/**
 * Compiles the pattern. Patterns are written for .NET, and some (such as "(?i)")
 * are not valid in JavaScript: those are left to the server.
 */
function compile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch (error) {
    console.warn(
      `Formulate: the regular expression "${pattern}" is not valid in this browser, so only the server checks it.`,
      error,
    );
    return null;
  }
}

export default { key: "regex", validator: RegexValidator } satisfies FieldValidatorRegistration;
