import type {
  DataByAlias,
  FieldRenderer,
  FormulateForm,
  FormulateFormData,
  SubmissionResponse,
  SubmissionValidationError,
} from "../types";
import { postFormData } from "../utils/ajax";
import { dispatchFormEvent, FormulateEvents } from "../utils/events";
import {
  removeFormAlert,
  removeValidationSummary,
  resolveFieldValidity,
  showFieldValidity,
  showFormAlert,
  showValidationSummary,
  type FieldValidity,
} from "../utils/validation";
import { getFieldRenderers } from "./get-field-renderers";
import { getFieldValidators } from "./get-field-validators";
import { renderFormContents, type RenderedField } from "./render-form";

type Payload = FormulateFormData["payload"];

/** The state of one rendered form. */
interface FormState {
  formElement: HTMLFormElement;
  fields: RenderedField[];
  payload: Payload;
  url: string;
  stepIndex: number;
  /** The step change still waiting for its animation delay (one per form). */
  stepTransition: StepTransition | null;
  submitting: boolean;
  /** Fields showing messages from the server, which are cleared on the next attempt. */
  fieldsWithServerErrors: Set<RenderedField>;
}

interface StepTransition {
  timer: number;
  /** Hides the old step and removes the animating classes. */
  settle: () => void;
}

interface FormValidity extends FieldValidity {
  /** The invalid fields, in form order. */
  invalidFields: RenderedField[];
}

/** How a submission attempt ended. */
type SubmitOutcome =
  | { kind: "invalid"; validity: FormValidity }
  | { kind: "cancelled" }
  | { kind: "sent"; response: SubmissionResponse | null; dataByAlias: DataByAlias }
  | { kind: "failed" };

/** Renders each form. A form that fails to render is logged and does not stop the others. */
export function renderForms(forms: readonly FormulateForm[]): void {
  for (const form of forms) {
    try {
      renderForm(form);
    } catch (error) {
      console.error(`Formulate: unable to render the form "${form?.data?.name ?? ""}".`, error);
    }
  }
}

/**
 * Renders a form in place of its placeholder: the element passed in or, by
 * default, the element with the ID "formulate-form-{randomId}" (the script
 * the Razor view renders). Returns the form element, or null when there is no
 * placeholder on the page.
 */
export function renderForm(form: FormulateForm, placeholder?: Element | null): HTMLFormElement | null {
  const data = form.data;
  const placeholderId = `formulate-form-${data.randomId}`;
  const placeholderElement = placeholder ?? document.getElementById(placeholderId);
  if (!placeholderElement?.parentNode) {
    console.warn(`Formulate: the form "${data.name}" was not rendered because #${placeholderId} is not on the page.`);
    return null;
  }

  const formElement = document.createElement("form");
  formElement.classList.add("formulate__form");
  const fields = renderFormContents(form, formElement, placeholderElement, getFieldRenderers(), getFieldValidators());
  placeholderElement.replaceWith(formElement);

  attachSubmitHandler({
    formElement,
    fields,
    payload: data.payload ?? {},
    url: data.url,
    stepIndex: 0,
    stepTransition: null,
    submitting: false,
    fieldsWithServerErrors: new Set(),
  });
  return formElement;
}

function attachSubmitHandler(state: FormState): void {
  const { formElement } = state;
  formElement.addEventListener(
    "submit",
    (event) => {
      // The form is posted with fetch instead.
      event.preventDefault();
      void submitForm(state);
    },
    true,
  );
  formElement.addEventListener(FormulateEvents.previous, () => {
    // Going back never validates.
    removeValidationSummary(formElement);
    showStep(state, state.stepIndex - 1);
  });
  formElement.addEventListener(FormulateEvents.next, () => {
    void goToNextStep(state);
  });
}

async function submitForm(state: FormState): Promise<void> {
  if (state.submitting) {
    return;
  }
  state.submitting = true;
  dispatchFormEvent(state.formElement, FormulateEvents.submitStarted);
  let outcome: SubmitOutcome;
  try {
    outcome = await attemptSubmission(state);
  } catch (error) {
    console.error("Formulate: unable to submit the form.", error);
    outcome = { kind: "failed" };
  }
  // The form can be submitted again as soon as listeners hear how this attempt ended.
  state.submitting = false;
  reportOutcome(state, outcome);
}

/** Validates the form and, unless a listener cancels, posts it. */
async function attemptSubmission(state: FormState): Promise<SubmitOutcome> {
  const validity = await validateFields(state.fields);
  if (!validity.success) {
    return { kind: "invalid", validity };
  }

  // Listeners can cancel the submission, or change the fields and the payload.
  const validationData = {
    cancelSubmit: false,
    fields: state.fields.map((x) => x.renderer),
    payload: state.payload,
  };
  dispatchFormEvent(state.formElement, FormulateEvents.validationSuccess, validationData);
  if (validationData.cancelSubmit) {
    return { kind: "cancelled" };
  }

  removeValidationSummary(state.formElement);
  removeFormAlert(state.formElement);
  clearServerErrors(state);
  return sendPayloadToServer(state, validationData.fields, validationData.payload);
}

function reportOutcome(state: FormState, outcome: SubmitOutcome): void {
  const { formElement } = state;
  switch (outcome.kind) {
    case "invalid":
      // The server's form-level message is about the last attempt, not this one.
      removeFormAlert(formElement);
      showInvalidFields(state, outcome.validity.invalidFields);
      handleInvalidFields(formElement, outcome.validity.messages, false);
      break;
    case "cancelled":
      dispatchFormEvent(formElement, FormulateEvents.submitCancelled);
      break;
    case "sent":
      if (outcome.response?.Success) {
        dispatchFormEvent(formElement, FormulateEvents.submitSuccess, { dataByAlias: outcome.dataByAlias });
        break;
      }
      // As in v3, any unsuccessful response dispatches the failure event. The
      // validation errors the server sent (v3 sent none) are shown after it.
      dispatchFormEvent(formElement, FormulateEvents.submitFailure);
      if (outcome.response?.ValidationErrors?.length) {
        showServerErrors(state, outcome.response.ValidationErrors);
      }
      break;
    case "failed":
      dispatchFormEvent(formElement, FormulateEvents.submitFailure);
      break;
  }
}

/** Validates the fields of the active step and, if they are valid, shows the next step. */
async function goToNextStep(state: FormState): Promise<void> {
  const { formElement } = state;
  const stepIndex = state.stepIndex;
  const stepFields = state.fields.filter((x) => x.stepIndex === stepIndex);
  try {
    const validity = await validateFields(stepFields);
    // Ignore the result if the visitor changed steps while the fields were being validated.
    if (state.stepIndex !== stepIndex) {
      return;
    }
    if (!validity.success) {
      focusFirstInvalidField(state, validity.invalidFields);
      handleInvalidFields(formElement, validity.messages, true);
      return;
    }
    dispatchFormEvent(formElement, FormulateEvents.nextValidationSuccess, {
      fields: stepFields.map((x) => x.renderer),
      payload: state.payload,
    });
    removeValidationSummary(formElement);
    showStep(state, stepIndex + 1);
  } catch (error) {
    console.error("Formulate: unable to validate the step.", error);
    dispatchFormEvent(formElement, FormulateEvents.submitFailure);
  }
}

async function validateFields(fields: readonly RenderedField[]): Promise<FormValidity> {
  const results = await Promise.all(fields.map((x) => resolveFieldValidity(x.renderer.checkValidity?.())));
  return {
    success: results.every((x) => x.success),
    messages: results.flatMap((x) => x.messages),
    invalidFields: fields.filter((_, index) => !results[index].success),
  };
}

/** Shows the step that contains the first invalid field, and moves focus to it. */
function showInvalidFields(state: FormState, invalidFields: readonly RenderedField[]): void {
  showStepOfField(state, invalidFields[0]);
  focusFirstInvalidField(state, invalidFields);
}

const focusableSelector =
  "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe";

/**
 * Moves focus to the first invalid field in the active step that has a control
 * to focus. This happens before the validation errors event, so a listener can
 * move focus elsewhere.
 */
function focusFirstInvalidField(state: FormState, invalidFields: readonly RenderedField[]): void {
  for (const field of invalidFields) {
    if (field.stepIndex !== state.stepIndex) {
      continue;
    }
    const element = field.renderer.getElement();
    const control = element?.matches(focusableSelector)
      ? element
      : element?.querySelector<HTMLElement>(focusableSelector);
    if (control) {
      control.focus();
      return;
    }
  }
}

/**
 * Dispatches the validation errors event and shows the validation summary, unless
 * a listener cancelled the event (to show the messages its own way). The event
 * lists every message; the summary lists summaryMessages, which leave out the
 * form-level ones that the form-level alert shows.
 */
function handleInvalidFields(
  formElement: HTMLFormElement,
  messages: string[],
  isStep: boolean,
  summaryMessages: readonly string[] = messages,
): void {
  const event = dispatchFormEvent(formElement, FormulateEvents.validationErrors, { messages, isStep }, true);
  if (event.defaultPrevented) {
    removeValidationSummary(formElement);
  } else {
    showValidationSummary(formElement, summaryMessages);
  }
}

/** Posts the payload and the field values (keyed by field ID) to the form's URL. */
async function sendPayloadToServer(
  state: FormState,
  fields: readonly FieldRenderer[],
  payload: Payload,
): Promise<SubmitOutcome> {
  const data = new FormData();
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (value !== null && value !== undefined) {
      data.append(key, String(value));
    }
  }
  const dataByAlias: DataByAlias = {};
  for (const field of fields) {
    field.setData?.(data);
    field.setData?.(dataByAlias, { rawDataByAlias: true });
  }

  const response = JSON.parse(await postFormData(state.url, data)) as SubmissionResponse | null;
  return { kind: "sent", response, dataByAlias };
}

/**
 * Shows the server's validation messages below their fields and in the summary,
 * and shows the step that contains the first invalid field. Messages for
 * unknown fields (form-level errors, such as a cancelled submission) are shown
 * in the form-level alert above the submit button instead of the summary. The
 * validation errors event still lists every message.
 */
function showServerErrors(state: FormState, errors: readonly SubmissionValidationError[]): void {
  const messages: string[] = [];
  const formMessages: string[] = [];
  const fieldMessageList: string[] = [];
  const messagesByField = new Map<RenderedField, string[]>();
  for (const error of errors) {
    const errorMessages = (error.Messages ?? []).filter((x) => typeof x === "string" && x !== "");
    messages.push(...errorMessages);
    const field = findField(state, error.FieldId);
    if (field) {
      messagesByField.set(field, [...(messagesByField.get(field) ?? []), ...errorMessages]);
      fieldMessageList.push(...errorMessages);
    } else {
      formMessages.push(...errorMessages);
    }
  }
  for (const [field, fieldMessages] of messagesByField) {
    const element = field.renderer.getElement();
    if (element) {
      showFieldValidity(field.renderer, element, { success: false, messages: fieldMessages });
      state.fieldsWithServerErrors.add(field);
    }
  }
  showInvalidFields(state, state.fields.filter((x) => messagesByField.has(x)));
  showFormAlert(state.formElement, formMessages);
  handleInvalidFields(state.formElement, messages, false, fieldMessageList);
}

function clearServerErrors(state: FormState): void {
  for (const field of state.fieldsWithServerErrors) {
    const element = field.renderer.getElement();
    if (element) {
      showFieldValidity(field.renderer, element, { success: true, messages: [] });
    }
  }
  state.fieldsWithServerErrors.clear();
}

function findField(state: FormState, fieldId: string | null | undefined): RenderedField | undefined {
  const id = normalizeId(fieldId);
  return id ? state.fields.find((x) => normalizeId(x.data.id) === id) : undefined;
}

/** Field IDs are GUIDs; compare them without hyphens and case. */
function normalizeId(id: string | null | undefined): string {
  return (id ?? "").replace(/-/g, "").toLowerCase();
}

function showStepOfField(state: FormState, field: RenderedField | undefined): void {
  if (field) {
    showStep(state, field.stepIndex);
  }
}

/**
 * Shows the specified step (if it exists) in place of the active one, as v3 did:
 * both steps get their classes (and the animating class) at once, and the new
 * step is unhidden. After window.formulateMultiStepAnimationDelay (500 ms), the
 * old step is hidden and the animating classes are removed. Hiding steps with
 * the hidden attribute means forms work without a theme; themes only animate.
 */
function showStep(state: FormState, stepIndex: number): void {
  const { formElement } = state;
  const oldStep = formElement.querySelector<HTMLElement>(`:scope > .formulate__step-${state.stepIndex}`);
  const newStep = formElement.querySelector<HTMLElement>(`:scope > .formulate__step-${stepIndex}`);
  if (stepIndex === state.stepIndex || !oldStep || !newStep) {
    return;
  }

  // Finish the previous transition now, so its timer cannot change the steps later.
  settleStepTransition(state);

  setStepActive(formElement, oldStep, state.stepIndex, false);
  setStepActive(formElement, newStep, stepIndex, true);
  newStep.hidden = false;
  state.stepIndex = stepIndex;

  const settle = () => {
    state.stepTransition = null;
    oldStep.hidden = true;
    oldStep.classList.remove(animatingClass);
    newStep.classList.remove(animatingClass);
  };
  state.stepTransition = {
    timer: setTimeout(settle, window.formulateMultiStepAnimationDelay ?? 500),
    settle,
  };

  // Submit buttons only work in the active step.
  for (const field of state.fields) {
    field.renderer.toggleSubmitButton?.(field.stepIndex === stepIndex);
  }
}

/** Cancels the timer of the step transition in progress (if any) and puts the steps in their final state. */
function settleStepTransition(state: FormState): void {
  if (state.stepTransition) {
    clearTimeout(state.stepTransition.timer);
    state.stepTransition.settle();
  }
}

const animatingClass = "formulate__step--animating";

function setStepActive(formElement: HTMLFormElement, stepElement: Element, stepIndex: number, active: boolean): void {
  stepElement.classList.remove(active ? "formulate__step--inactive" : "formulate__step--active");
  stepElement.classList.add(active ? "formulate__step--active" : "formulate__step--inactive", animatingClass);
  for (const row of formElement.querySelectorAll(`.formulate__row--step-${stepIndex}`)) {
    row.classList.remove(active ? "formulate__row--inactive" : "formulate__row--active");
    row.classList.add(active ? "formulate__row--active" : "formulate__row--inactive");
  }
}
