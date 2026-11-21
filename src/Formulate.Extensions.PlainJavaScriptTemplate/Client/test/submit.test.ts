import { afterEach, describe, expect, it, vi } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import type { FormulateForm } from "../src/types";
import {
  addPlaceholder,
  buttonByText,
  controlByLabel,
  fieldByLabel,
  fieldId,
  fillContactForm,
  flush,
  inlineMessages,
  loadFixture,
  mockFetch,
  nextEvent,
  resetPage,
  sentFormData,
  summaryMessages,
  typeInto,
} from "./helpers";

afterEach(resetPage);

function renderContactForm(changeFixture?: (form: FormulateForm) => void) {
  const form = loadFixture("contact");
  changeFixture?.(form);
  addPlaceholder(form);
  const formElement = renderForm(form);
  if (!formElement) {
    throw new Error("The form did not render.");
  }
  return { form, formElement, button: buttonByText(formElement, "Send Message") };
}

describe("submitting", () => {
  it("submit posts FormData with payload + field ids + files to url", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const { form, formElement, button } = renderContactForm();
    const cv = new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" });
    fillContactForm(formElement, cv);
    const started = nextEvent(formElement, "formulate: submit: started");
    const success = nextEvent<{ dataByAlias: Record<string, unknown> }>(formElement, "formulate form: submit: success");

    button.click();
    await started;
    expect(button.disabled).toBe(true);
    const { detail } = await success;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/site/api/formulate/plain-js/submit");
    expect(init.method).toBe("POST");
    const body = sentFormData(fetchMock);
    expect(body.get("FormId")).toBe("5c558cdf8e734c7da34079f09536b7e7");
    expect(body.get("PageId")).toBe("1104");
    expect(body.get("__RequestVerificationToken")).toBe(form.data.payload.__RequestVerificationToken);
    expect(body.get(fieldId(form, "name"))).toBe("Ada Lovelace");
    expect(body.get(fieldId(form, "email"))).toBe("ada@example.com");
    expect(body.get(fieldId(form, "topic"))).toBe("support");
    expect(body.getAll(fieldId(form, "interests"))).toEqual(["news", "offers"]);
    expect(body.get(fieldId(form, "message"))).toBe("Hello there.");
    expect(body.get(fieldId(form, "source"))).toBe("website");
    const file = body.get(fieldId(form, "attachment"));
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("cv.pdf");
    // Content fields and buttons have no value to send.
    expect(body.has(fieldId(form, "introHeader"))).toBe(false);
    expect(body.has(fieldId(form, "send"))).toBe(false);

    expect(detail.dataByAlias).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      topic: "support",
      interests: ["news", "offers"],
      message: "Hello there.",
      attachment: cv,
      source: "website",
    });
    // The form was sent, so its button stays disabled.
    expect(button.disabled).toBe(true);
  });

  it("server validation errors map to fields", async () => {
    const { form, formElement, button } = renderContactForm();
    mockFetch({
      Success: false,
      ValidationErrors: [
        {
          FieldName: "Email Address",
          FieldId: fieldId(form, "email"),
          Messages: ["That email address is already registered."],
        },
        { FieldName: "", FieldId: "00000000000000000000000000000000", Messages: ["Submissions are closed."] },
      ],
    });
    fillContactForm(formElement);
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    formElement.addEventListener("formulate form: submit: success", onSuccess);
    formElement.addEventListener("formulate form: submit: failure", onFailure);
    const errors = nextEvent<{ messages: string[]; isStep: boolean }>(
      formElement,
      "formulate: submit: validation errors",
    );

    button.click();

    expect((await errors).detail).toEqual({
      messages: ["That email address is already registered.", "Submissions are closed."],
      isStep: false,
    });
    const email = fieldByLabel(formElement, "Email Address");
    expect(email.classList).toContain("formulate__field--validation-error");
    expect(inlineMessages(email)).toEqual(["That email address is already registered."]);
    expect(formElement.querySelectorAll(".formulate__field--validation-error")).toHaveLength(1);
    expect(summaryMessages(formElement)).toEqual([
      "That email address is already registered.",
      "Submissions are closed.",
    ]);
    expect(onSuccess).not.toHaveBeenCalled();
    // As in v3, an unsuccessful response also dispatches the failure event.
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(false);

    // The next attempt clears the server's messages.
    mockFetch({ Success: true, ValidationErrors: [] });
    typeInto(controlByLabel(formElement, "Email Address"), "ada.lovelace@example.com");
    const success = nextEvent(formElement, "formulate form: submit: success");
    button.click();
    await success;
    expect(inlineMessages(email)).toEqual([]);
    expect(email.classList).not.toContain("formulate__field--validation-error");
    expect(formElement.querySelector(".formulate__validation-summary")).toBeNull();
  });

  it("dispatches the failure event (as v3 did) and then the validation errors event when the server rejects values", async () => {
    const { form, formElement, button } = renderContactForm();
    mockFetch({
      Success: false,
      ValidationErrors: [{ FieldName: "Email Address", FieldId: fieldId(form, "email"), Messages: ["Taken."] }],
    });
    fillContactForm(formElement);
    const events: string[] = [];
    for (const name of [
      "formulate form: submit: success",
      "formulate form: submit: failure",
      "formulate: submit: validation errors",
    ]) {
      formElement.addEventListener(name, () => events.push(name));
    }
    const errors = nextEvent(formElement, "formulate: submit: validation errors");

    button.click();
    await errors;
    await flush();

    expect(events).toEqual(["formulate form: submit: failure", "formulate: submit: validation errors"]);
    expect(button.disabled).toBe(false);
  });

  it("lets validation success listeners change the payload or cancel the submission", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const { formElement, button } = renderContactForm();
    fillContactForm(formElement);
    let cancel = true;
    formElement.addEventListener("formulate: validation: success", (event) => {
      const detail = (event as CustomEvent<{ cancelSubmit: boolean; payload: Record<string, unknown> }>).detail;
      detail.cancelSubmit = cancel;
      detail.payload.Campaign = "spring";
    });
    const cancelled = nextEvent(formElement, "formulate: submit: cancelled");

    button.click();
    await cancelled;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);

    cancel = false;
    const success = nextEvent(formElement, "formulate form: submit: success");
    button.click();
    await success;
    expect(sentFormData(fetchMock).get("Campaign")).toBe("spring");
  });

  it.each([
    ["an error status", () => mockFetch("Bad Request", 400)],
    ["a response that is not JSON", () => mockFetch("<html>Oops</html>")],
    ["an unsuccessful response without validation errors", () => mockFetch({ Success: false, ValidationErrors: [] })],
    [
      "a network error",
      () => vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))),
    ],
  ])("dispatches the failure event for %s and enables the button again", async (_name, arrange) => {
    arrange();
    const { formElement, button } = renderContactForm();
    fillContactForm(formElement);
    const failure = nextEvent(formElement, "formulate form: submit: failure");

    button.click();
    await failure;
    await flush();

    expect(button.disabled).toBe(false);
  });

  it("accepts a new submission as soon as listeners hear that the last one failed", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const { formElement, button } = renderContactForm();
    const started = vi.fn();
    formElement.addEventListener("formulate: submit: started", started);
    formElement.addEventListener(
      "formulate: submit: validation errors",
      () => {
        fillContactForm(formElement);
        button.click();
      },
      { once: true },
    );

    button.click();
    await flush();

    expect(started).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("posts once when the form is submitted again while the request is in flight", async () => {
    // The request never finishes, so the first submission stays in flight.
    const fetchMock = vi.fn(() => new Promise<never>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const { formElement } = renderContactForm();
    fillContactForm(formElement);

    formElement.requestSubmit();
    await flush();
    formElement.requestSubmit();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up on a request after 60 seconds and enables the button again", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    // Like fetch, the mock rejects with the signal's reason once the signal aborts.
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { formElement, button } = renderContactForm();
    fillContactForm(formElement);
    const failure = nextEvent(formElement, "formulate form: submit: failure");

    button.click();
    await flush();

    expect(timeout).toHaveBeenCalledWith(60_000);
    expect(fetchMock.mock.calls[0]?.[1].signal).toBe(controller.signal);
    expect(button.disabled).toBe(true);

    controller.abort(new DOMException("The request took too long.", "TimeoutError"));
    await failure;

    expect(button.disabled).toBe(false);
    expect(error).toHaveBeenCalledWith(
      "Formulate: unable to submit the form.",
      expect.objectContaining({ name: "TimeoutError" }),
    );
  });

  it("does not post payload values that are null", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const { formElement, button } = renderContactForm((form) => {
      form.data.payload.PageId = null;
    });
    fillContactForm(formElement);
    const success = nextEvent(formElement, "formulate form: submit: success");

    button.click();
    await success;

    const body = sentFormData(fetchMock);
    expect(body.has("PageId")).toBe(false);
    expect(body.get("FormId")).toBe("5c558cdf8e734c7da34079f09536b7e7");
  });

  it("shows the chosen file name and lets the visitor deselect it", () => {
    const { formElement } = renderContactForm();
    const upload = fieldByLabel(formElement, "Attach Your CV");
    const input = controlByLabel(formElement, "Attach Your CV");

    Object.defineProperty(input, "files", { configurable: true, value: [new File(["x"], "cv.pdf")] });
    input.dispatchEvent(new Event("change"));

    expect(upload.querySelector(".formulate__field--upload__filename")?.textContent).toBe("cv.pdf");
    const deselect = upload.querySelector<HTMLButtonElement>(".formulate__field--upload__deselect");
    expect(deselect?.type).toBe("button");
    Object.defineProperty(input, "files", { configurable: true, value: [] });
    deselect?.click();
    expect(upload.querySelector(".formulate__field--upload__filename")).toBeNull();
    expect(upload.querySelector(".formulate__field--upload__deselect")).toBeNull();
  });
});
