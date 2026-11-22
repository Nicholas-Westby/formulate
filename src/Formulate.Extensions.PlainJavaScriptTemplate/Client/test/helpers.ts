import { vi } from "vitest";
import type { FormulateField, FormulateForm } from "../src/types";
import allFieldTypes from "./fixtures/all-field-types.json";
import contact from "./fixtures/contact.json";
import multiStep from "./fixtures/multi-step.json";

// Assigning the JSON to the contract type makes the type checker flag fixture drift.
const fixtures: Record<"contact" | "multi-step" | "all-field-types", FormulateForm> = {
  contact,
  "multi-step": multiStep,
  "all-field-types": allFieldTypes,
};

/** Returns a fresh copy of a fixture, so tests can change it freely. */
export function loadFixture(name: keyof typeof fixtures): FormulateForm {
  return structuredClone(fixtures[name]);
}

/** Returns the data of the field with the specified alias. */
export function fieldData(form: FormulateForm, alias: string): FormulateField {
  const field = form.data.fields.find((x) => x.alias === alias);
  if (!field) {
    throw new Error(`The fixture has no field with the alias "${alias}".`);
  }
  return field;
}

/** Returns the ID of the field with the specified alias. */
export function fieldId(form: FormulateForm, alias: string): string {
  return fieldData(form, alias).id;
}

/** Adds the markup the Razor view renders: a wrapper holding the placeholder script. */
export function addPlaceholder(form: FormulateForm): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "formulate-wrapper";
  wrapper.dataset.formName = form.data.name;
  const placeholder = document.createElement("script");
  placeholder.id = `formulate-form-${form.data.randomId}`;
  wrapper.appendChild(placeholder);
  document.body.appendChild(wrapper);
  return wrapper;
}

/** Returns an element's classes as a set, so assertions do not depend on the order they were added in. */
export function classSet(element: Element | null | undefined): Set<string> {
  return new Set(element?.classList ?? []);
}

/** Finds the field wrapper whose label (or legend) has exactly the specified text. */
export function fieldByLabel(root: ParentNode, text: string): HTMLElement {
  const label = findLabel(root, text);
  const field = label.closest<HTMLElement>(".formulate__field");
  if (!field) {
    throw new Error(`The label "${text}" is not inside a field.`);
  }
  return field;
}

/** Finds the control that the label with exactly the specified text points at. */
export function controlByLabel<T extends HTMLElement = HTMLInputElement>(root: ParentNode, text: string): T {
  const label = findLabel(root, text);
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error(`"${text}" is not a <label>.`);
  }
  return document.getElementById(label.htmlFor) as T;
}

function findLabel(root: ParentNode, text: string): HTMLElement {
  const labels = [...root.querySelectorAll<HTMLElement>(".formulate__field__label")];
  const label = labels.find((x) => x.textContent === text);
  if (!label) {
    throw new Error(`No label has the text "${text}".`);
  }
  return label;
}

/** Finds a button by its text, optionally only within the active step. */
export function buttonByText(root: ParentNode, text: string): HTMLButtonElement {
  const button = [...root.querySelectorAll("button")].find((x) => x.textContent === text);
  if (!button) {
    throw new Error(`No button has the text "${text}".`);
  }
  return button;
}

/** Returns the inline validation messages shown inside a field wrapper. */
export function inlineMessages(field: Element): string[] {
  return [...field.querySelectorAll(".formulate__inline-validation-summary__error")].map((x) => x.textContent ?? "");
}

/** Returns the messages in the form's validation summary. */
export function summaryMessages(form: Element): string[] {
  return [...form.querySelectorAll(".formulate__validation-summary .formulate__validation-summary__error")].map(
    (x) => x.textContent ?? "",
  );
}

/** Returns the messages in the form-level alert, which holds the errors that belong to no field. */
export function formAlertMessages(form: Element): string[] {
  return [...form.querySelectorAll(".formulate__form-alert .formulate__form-alert__message")].map(
    (x) => x.textContent ?? "",
  );
}

/** Sets a text control's value as a visitor would. */
export function typeInto(control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Selects a file in an upload control, as a visitor would. */
export function chooseFile(control: HTMLInputElement, file: File): void {
  Object.defineProperty(control, "files", { configurable: true, value: [file] });
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Resolves with the next event of the specified name dispatched on the target. */
export function nextEvent<T = unknown>(target: EventTarget, name: string): Promise<CustomEvent<T>> {
  return new Promise((resolve) => {
    target.addEventListener(name, (event) => resolve(event as CustomEvent<T>), { once: true });
  });
}

/** Lets pending promises and timers settle. */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export type FetchMock = ReturnType<typeof mockFetch>;

/** Replaces fetch with a mock that answers every request with the specified body and status. */
export function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Returns the FormData sent with the specified fetch call. */
export function sentFormData(fetchMock: FetchMock, call = 0): FormData {
  const init = fetchMock.mock.calls[call]?.[1];
  if (!(init?.body instanceof FormData)) {
    throw new Error("The request body is not FormData.");
  }
  return init.body;
}

/** Fills the required fields of the contact fixture with valid values. */
export function fillContactForm(form: HTMLFormElement, file = new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" })): void {
  typeInto(controlByLabel(form, "Your Name"), "Ada Lovelace");
  typeInto(controlByLabel(form, "Email Address"), "ada@example.com");
  typeInto(controlByLabel<HTMLSelectElement>(form, "Topic"), "support");
  controlByLabel(form, "Newsletter").click();
  controlByLabel(form, "Offers").click();
  typeInto(controlByLabel<HTMLTextAreaElement>(form, "Message"), "Hello there.");
  chooseFile(controlByLabel(form, "Attach Your CV"), file);
}

/** Removes everything the tests add to the page and the window. */
export function resetPage(): void {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete window["formulate-plain-js-forms"];
  delete window["formulate-plain-js-fields"];
  delete window["formulate-plain-js-validators"];
  delete window.formulateMultiStepAnimationDelay;
  delete window.formulatePlainJs;
  delete window.formulatePlainJsRecaptchaReady;
  delete window.grecaptcha;
}
