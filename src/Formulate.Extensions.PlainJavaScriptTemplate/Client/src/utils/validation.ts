import type {
  AggregateValidationResult,
  FieldRenderer,
  FieldValidator,
  FieldValidatorMap,
  FormulateValidation,
  ValidationResult,
} from "../types";
import { generateId } from "./generate-id";

/** A validator created for one of a field's validations. */
export interface PreparedValidator {
  validator: FieldValidator;
  data: FormulateValidation;
}

/** The outcome of validating one field. Messages only holds non-empty messages. */
export interface FieldValidity {
  success: boolean;
  messages: string[];
}

type ValidatorMethod = keyof FieldValidator;

/**
 * Creates a validator for each of the field's validations. A validation type
 * without a registered validator is skipped with a warning: the server still
 * checks it.
 */
export function prepareValidators(
  validations: readonly FormulateValidation[] | null | undefined,
  fieldValidators: FieldValidatorMap,
): PreparedValidator[] {
  const prepared: PreparedValidator[] = [];
  for (const data of validations ?? []) {
    const Validator = Object.hasOwn(fieldValidators, data.validationType)
      ? fieldValidators[data.validationType]
      : undefined;
    if (!Validator) {
      console.warn(
        `Formulate: no validator is registered for the validation type "${data.validationType}", so only the server checks it.`,
      );
      continue;
    }
    prepared.push({ validator: new Validator(data.configuration ?? {}), data });
  }
  return prepared;
}

/**
 * Replaces the inline list of validation messages in a container. Returns the
 * new list (pass it back in as the prior list next time), or null when there
 * are no messages.
 */
export function addValidationMessages(
  containerElement: Element,
  messages: readonly string[] | null | undefined,
  priorListElement: HTMLUListElement | null | undefined,
): HTMLUListElement | null {
  priorListElement?.remove();
  if (!messages || messages.length === 0) {
    return null;
  }
  const listElement = document.createElement("ul");
  listElement.classList.add("formulate__inline-validation-summary");
  // The field's controls point at this ID with aria-describedby.
  listElement.id = generateId("formulate-validation-");
  for (const message of messages) {
    const itemElement = document.createElement("li");
    itemElement.classList.add("formulate__inline-validation-summary__error");
    itemElement.appendChild(document.createTextNode(message));
    listElement.appendChild(itemElement);
  }
  containerElement.appendChild(listElement);
  return listElement;
}

/**
 * Shows a field's inline validation messages and error class (or removes them
 * when it is valid). The field's controls get aria-invalid="true" and point at
 * the messages with aria-describedby, so screen readers announce them.
 */
export function showFieldValidity(fieldRenderer: FieldRenderer, containerElement: Element, validity: FieldValidity): void {
  const priorListElement = fieldRenderer.validationListElement;
  const listElement = addValidationMessages(containerElement, validity.messages, priorListElement);
  fieldRenderer.validationListElement = listElement;
  containerElement.classList.toggle("formulate__field--validation-error", !validity.success);
  for (const control of getControls(containerElement)) {
    if (validity.success) {
      control.removeAttribute("aria-invalid");
    } else {
      control.setAttribute("aria-invalid", "true");
    }
    updateDescribedBy(control, priorListElement?.id, listElement?.id);
  }
}

const controlSelector = "input:not([type='hidden']), select, textarea";

/** Returns the form controls in a field's container (or the container, if it is a control). */
function getControls(containerElement: Element): Element[] {
  return containerElement.matches(controlSelector)
    ? [containerElement]
    : [...containerElement.querySelectorAll(controlSelector)];
}

/** Replaces one ID in an aria-describedby attribute with another, keeping any other IDs. */
function updateDescribedBy(control: Element, oldId: string | undefined, newId: string | undefined): void {
  const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((x) => x !== "" && x !== oldId);
  if (newId) {
    ids.push(newId);
  }
  if (ids.length > 0) {
    control.setAttribute("aria-describedby", ids.join(" "));
  } else {
    control.removeAttribute("aria-describedby");
  }
}

/**
 * Converts whatever a validator or a field's checkValidity produced (a result,
 * an aggregate result, a boolean, or an array of those) into a FieldValidity.
 */
export function toFieldValidity(outcome: unknown): FieldValidity {
  if (Array.isArray(outcome)) {
    const parts = outcome.map(toFieldValidity);
    return { success: parts.every((x) => x.success), messages: parts.flatMap((x) => x.messages) };
  }
  if (outcome === null || outcome === undefined) {
    return { success: true, messages: [] };
  }
  if (typeof outcome !== "object") {
    return { success: Boolean(outcome), messages: [] };
  }
  const result = outcome as ValidationResult & AggregateValidationResult;
  if (result.success) {
    return { success: true, messages: [] };
  }
  const messages = Array.isArray(result.messages) ? result.messages : [result.message];
  return { success: false, messages: messages.filter((x): x is string => typeof x === "string" && x !== "") };
}

/** Waits for the result of a field's checkValidity (a promise, or an array of promises as in v3). */
export async function resolveFieldValidity(check: unknown): Promise<FieldValidity> {
  const outcome = Array.isArray(check) ? await Promise.all(check) : await check;
  return toFieldValidity(outcome);
}

/**
 * Validates a value with each of the field's validators and shows the inline
 * messages in the container. Resolves to { success, messages }.
 */
export async function checkValidityCommon(
  fieldRenderer: FieldRenderer,
  validators: readonly PreparedValidator[],
  value: unknown,
  containerElement: Element,
  validityFnName: ValidatorMethod,
): Promise<AggregateValidationResult> {
  const results = await Promise.all(validators.map((x) => runValidator(x, value, validityFnName)));
  const validity = toFieldValidity(results);
  showFieldValidity(fieldRenderer, containerElement, validity);
  return validity.success ? { success: true } : { success: false, messages: validity.messages };
}

export function checkTextValidity(
  fieldRenderer: FieldRenderer,
  validators: readonly PreparedValidator[],
  value: string | null | undefined,
  containerElement: Element,
): Promise<AggregateValidationResult> {
  return checkValidityCommon(fieldRenderer, validators, value, containerElement, "validateText");
}

export function checkTextArrayValidity(
  fieldRenderer: FieldRenderer,
  validators: readonly PreparedValidator[],
  value: string[],
  containerElement: Element,
): Promise<AggregateValidationResult> {
  return checkValidityCommon(fieldRenderer, validators, value, containerElement, "validateTextArray");
}

export function checkBoolValidity(
  fieldRenderer: FieldRenderer,
  validators: readonly PreparedValidator[],
  value: boolean,
  containerElement: Element,
): Promise<AggregateValidationResult> {
  return checkValidityCommon(fieldRenderer, validators, value, containerElement, "validateBool");
}

export function checkFileValidity(
  fieldRenderer: FieldRenderer,
  validators: readonly PreparedValidator[],
  value: File | null,
  containerElement: Element,
): Promise<AggregateValidationResult> {
  return checkValidityCommon(fieldRenderer, validators, value, containerElement, "validateFile");
}

/** Runs one validator. A validator without the method for this kind of value counts as valid. */
async function runValidator(
  prepared: PreparedValidator,
  value: unknown,
  validityFnName: ValidatorMethod,
): Promise<ValidationResult> {
  const validate = prepared.validator[validityFnName] as
    | ((value: unknown) => PromiseLike<boolean> | boolean)
    | undefined;
  if (typeof validate !== "function") {
    return { success: true };
  }
  const valid = await validate.call(prepared.validator, value);
  return valid ? { success: true } : { success: false, message: prepared.data.configuration?.message };
}

const summaryClass = "formulate__validation-summary";
const summaryWrapperClass = "formulate__validation-summary-wrapper";

/**
 * Shows the list of all validation messages at the end of the form, replacing
 * any earlier one. The list sits in a div with role="alert" (so it is announced
 * and the list keeps its list semantics).
 */
export function showValidationSummary(formElement: HTMLFormElement, messages: readonly string[]): void {
  removeValidationSummary(formElement);
  if (messages.length === 0) {
    return;
  }
  const wrapperElement = document.createElement("div");
  wrapperElement.classList.add(summaryWrapperClass);
  wrapperElement.setAttribute("role", "alert");
  const listElement = document.createElement("ul");
  listElement.classList.add(summaryClass);
  for (const message of messages) {
    const itemElement = document.createElement("li");
    itemElement.classList.add(`${summaryClass}__error`);
    itemElement.appendChild(document.createTextNode(message));
    listElement.appendChild(itemElement);
  }
  wrapperElement.appendChild(listElement);
  formElement.appendChild(wrapperElement);
}

export function removeValidationSummary(formElement: HTMLFormElement): void {
  formElement.querySelector(`:scope > .${summaryWrapperClass}`)?.remove();
}

const formAlertClass = "formulate__form-alert";

/**
 * Shows errors that belong to no field (such as a submission a site refused) in an
 * alert (role="alert") above the submit button, replacing any earlier one. The
 * alert is a sibling of the row that holds the submit button, so it sits in the
 * button's step. Without a submit button it goes at the end of the form.
 */
export function showFormAlert(formElement: HTMLFormElement, messages: readonly string[]): void {
  removeFormAlert(formElement);
  if (messages.length === 0) {
    return;
  }
  const alertElement = document.createElement("div");
  alertElement.classList.add(formAlertClass);
  alertElement.setAttribute("role", "alert");
  for (const message of messages) {
    const messageElement = document.createElement("p");
    messageElement.classList.add(`${formAlertClass}__message`);
    messageElement.appendChild(document.createTextNode(message));
    alertElement.appendChild(messageElement);
  }
  const submitButtons = formElement.querySelectorAll<HTMLElement>("button[type='submit']");
  const submitButton = submitButtons[submitButtons.length - 1];
  const anchor = submitButton?.closest(".formulate__row") ?? submitButton;
  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(alertElement, anchor);
  } else {
    formElement.appendChild(alertElement);
  }
}

export function removeFormAlert(formElement: HTMLFormElement): void {
  formElement.querySelector(`.${formAlertClass}`)?.remove();
}
