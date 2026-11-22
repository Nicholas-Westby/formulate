import type { FormulateForm } from "../types.js";

const formsKey = "formulate-plain-js-forms";

/**
 * Passes the forms queued on window["formulate-plain-js-forms"] to the render
 * function, then replaces the queue with an array whose push() renders each
 * form straight away (for forms that are added to the page later).
 */
export function listenForForms(render: (forms: FormulateForm[]) => void): void {
  const queued = window[formsKey];
  const queue: FormulateForm[] = [];
  queue.push = (...forms: FormulateForm[]) => {
    render(forms);
    return queue.length;
  };
  window[formsKey] = queue;
  render(Array.isArray(queued) ? queued : []);
}
