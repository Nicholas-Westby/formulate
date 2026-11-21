/**
 * The events dispatched on the form element. They bubble, so a site can listen
 * on the .formulate-wrapper element. The names are the same as in Formulate 3.
 */
export const FormulateEvents = {
  submitStarted: "formulate: submit: started",
  /** Detail: { cancelSubmit, fields, payload }. Listeners may cancel or change the submission. */
  validationSuccess: "formulate: validation: success",
  submitCancelled: "formulate: submit: cancelled",
  /** Detail: { dataByAlias }. */
  submitSuccess: "formulate form: submit: success",
  submitFailure: "formulate form: submit: failure",
  /** Detail: { messages, isStep }. Call preventDefault() to hide the built-in validation summary. */
  validationErrors: "formulate: submit: validation errors",
  next: "formulate: submit: next",
  previous: "formulate: submit: previous",
  /** Detail: { fields, payload }. */
  nextValidationSuccess: "formulate: validation: next: success",
} as const;

/** Dispatches a bubbling custom event and returns it, so callers can check defaultPrevented. */
export function dispatchFormEvent<T>(target: EventTarget, name: string, detail?: T, cancelable = false): CustomEvent<T> {
  const event = new CustomEvent(name, { bubbles: true, cancelable, detail });
  target.dispatchEvent(event);
  return event;
}
