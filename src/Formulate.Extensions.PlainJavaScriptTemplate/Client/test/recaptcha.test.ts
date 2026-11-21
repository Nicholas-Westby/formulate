import { afterEach, describe, expect, it, vi } from "vitest";
import type { FormulateForm } from "../src/types";
import {
  addPlaceholder,
  buttonByText,
  controlByLabel,
  fieldId,
  flush,
  loadFixture,
  mockFetch,
  nextEvent,
  resetPage,
  sentFormData,
} from "./helpers";

afterEach(resetPage);

const siteKey = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
const scriptUrl = "https://www.google.com/recaptcha/api.js?render=explicit&onload=formulatePlainJsRecaptchaReady";

/** Loads fresh copies of the modules (the reCAPTCHA state is per page) and returns renderForm. */
async function loadRenderer() {
  vi.resetModules();
  const { renderForm } = await import("../src/steps/render-forms");
  return (form: FormulateForm) => {
    const formElement = renderForm(form);
    if (!formElement) {
      throw new Error("The form did not render.");
    }
    return formElement;
  };
}

/** Adds the placeholder of a form with a reCAPTCHA field (each call gets its own random ID). */
let formCount = 0;
function recaptchaForm(): FormulateForm {
  const form = loadFixture("all-field-types");
  formCount++;
  form.data.randomId = `${form.data.randomId.slice(0, -4)}${String(formCount).padStart(4, "0")}`;
  addPlaceholder(form);
  return form;
}

/**
 * Stands in for Google's API. Like the real one, render() adds the textarea that
 * holds the response token, and returns a widget ID (starting at 0).
 */
function stubGrecaptcha() {
  let nextWidgetId = 0;
  const api = {
    render: vi.fn((container: HTMLElement, _parameters: { sitekey: string }) => {
      expect(container.isConnected).toBe(true);
      const response = document.createElement("textarea");
      response.name = "g-recaptcha-response";
      container.appendChild(response);
      return nextWidgetId++;
    }),
    reset: vi.fn(),
  };
  window.grecaptcha = api;
  return api;
}

const googleScripts = () => document.querySelectorAll('script[src^="https://www.google.com/recaptcha/api.js"]');

describe("reCAPTCHA", () => {
  it("loads Google's script once, for explicit rendering, and only for forms with a reCAPTCHA field", async () => {
    const render = await loadRenderer();
    const contact = loadFixture("contact");
    addPlaceholder(contact);
    render(contact);
    expect(googleScripts()).toHaveLength(0);

    render(recaptchaForm());
    render(recaptchaForm());

    const scripts = googleScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toBe(scriptUrl);
    expect((scripts[0] as HTMLScriptElement).async).toBe(true);
    expect(typeof window.formulatePlainJsRecaptchaReady).toBe("function");
  });

  it("renders every reCAPTCHA when the API calls back, not as soon as grecaptcha is defined", async () => {
    const render = await loadRenderer();
    // Google defines grecaptcha before the API is ready to render.
    const api = stubGrecaptcha();
    render(recaptchaForm());
    render(recaptchaForm());
    await flush();
    expect(api.render).not.toHaveBeenCalled();

    window.formulatePlainJsRecaptchaReady?.();

    const placeholders = [...document.querySelectorAll(".formulate__field--recaptcha")];
    expect(placeholders).toHaveLength(2);
    expect(api.render.mock.calls).toEqual(placeholders.map((x) => [x, { sitekey: siteKey }]));
  });

  it("renders the reCAPTCHA of a form added after the API is ready", async () => {
    const render = await loadRenderer();
    const api = stubGrecaptcha();
    render(recaptchaForm());
    // Google calls back in a later task, after the form is on the page.
    await flush();
    window.formulatePlainJsRecaptchaReady?.();
    expect(api.render).toHaveBeenCalledTimes(1);

    render(recaptchaForm());
    await flush();

    expect(api.render).toHaveBeenCalledTimes(2);
    expect(api.render.mock.calls[1][0]).toBe(document.querySelectorAll(".formulate__field--recaptcha")[1]);
    expect(googleScripts()).toHaveLength(1);
  });

  it("resets the widget after a failed post, because a token can only be used once", async () => {
    const render = await loadRenderer();
    const api = stubGrecaptcha();
    const form = recaptchaForm();
    const formElement = render(form);
    await flush();
    window.formulatePlainJsRecaptchaReady?.();
    const token = formElement.querySelector<HTMLTextAreaElement>("[name='g-recaptcha-response']");
    if (!token) {
      throw new Error("The reCAPTCHA was not rendered.");
    }
    token.value = "token-1";
    controlByLabel(formElement, "I accept the terms").click();
    const fetchMock = mockFetch({ Success: false, ValidationErrors: [] });
    const failure = nextEvent(formElement, "formulate form: submit: failure");

    buttonByText(formElement, "Submit").click();
    await failure;

    expect(sentFormData(fetchMock).get(fieldId(form, "captcha"))).toBe("token-1");
    expect(api.reset).toHaveBeenCalledExactlyOnceWith(0);

    // A successful post leaves the widget alone.
    token.value = "token-2";
    mockFetch({ Success: true, ValidationErrors: [] });
    const success = nextEvent(formElement, "formulate form: submit: success");
    buttonByText(formElement, "Submit").click();
    await success;

    expect(api.reset).toHaveBeenCalledTimes(1);
  });
});
