import type { FormulateField } from "../types.js";

/**
 * What every copy of the renderer on the page shares. The readable files and
 * the minified files are separate modules, each with its own variables, and a
 * site could import either, so this is kept on the window under a global
 * symbol. It is created when it is first needed, never when a module is
 * imported.
 */
export interface PageState {
  /** The number in the last ID generateId made. */
  lastId: number;
  /** The field types of the fields rendered so far. */
  renderedFieldTypes: Set<string>;
  /** The validation types of the fields rendered so far. */
  renderedValidationTypes: Set<string>;
  /** Google's reCAPTCHA script, which one copy adds for the widgets of every copy. */
  recaptcha: {
    /** Has a copy added Google's script to the page? */
    scriptRequested: boolean;
    /**
     * Has Google's API called back? A defined window.grecaptcha is not enough,
     * because Google defines it before the API can render widgets.
     */
    apiReady: boolean;
    /** The reCAPTCHA fields rendered before the API was ready. */
    waitingFields: Set<{ renderWidget(): void }>;
  };
}

const pageStateKey = Symbol.for("Formulate.PlainJavaScript.pageState");

export function getPageState(): PageState {
  const holder = window as unknown as Record<symbol, PageState | undefined>;
  let state = holder[pageStateKey];
  if (!state) {
    state = {
      lastId: 0,
      renderedFieldTypes: new Set(),
      renderedValidationTypes: new Set(),
      recaptcha: { scriptRequested: false, apiReady: false, waitingFields: new Set() },
    };
    holder[pageStateKey] = state;
  }
  return state;
}

/** Notes that a form on the page rendered the field, so a renderer or validator registered later can warn. */
export function noteRenderedField(field: FormulateField): void {
  const state = getPageState();
  state.renderedFieldTypes.add(field.fieldType);
  for (const validation of field.validations ?? []) {
    state.renderedValidationTypes.add(validation.validationType);
  }
}
