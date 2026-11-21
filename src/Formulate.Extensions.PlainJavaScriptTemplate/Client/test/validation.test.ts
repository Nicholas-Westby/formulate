import { afterEach, describe, expect, it, vi } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import {
  addPlaceholder,
  buttonByText,
  classSet,
  controlByLabel,
  fieldByLabel,
  fillContactForm,
  inlineMessages,
  loadFixture,
  mockFetch,
  nextEvent,
  resetPage,
  summaryMessages,
  typeInto,
} from "./helpers";

afterEach(resetPage);

type ValidationErrorsDetail = { messages: string[]; isStep: boolean };

function renderContactForm(changeFixture?: (form: ReturnType<typeof loadFixture>) => void): HTMLFormElement {
  const form = loadFixture("contact");
  changeFixture?.(form);
  addPlaceholder(form);
  const formElement = renderForm(form);
  if (!formElement) {
    throw new Error("The form did not render.");
  }
  return formElement;
}

describe("client-side validation", () => {
  it("required validator blocks submit and shows inline + summary messages", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = renderContactForm();
    const errors = nextEvent<ValidationErrorsDetail>(formElement, "formulate: submit: validation errors");

    buttonByText(formElement, "Send Message").click();
    const event = await errors;

    const expected = [
      "Please enter your name.",
      "Please enter your email address.",
      "Please enter a valid email address.",
      "Please choose a topic.",
      "Please choose at least one interest.",
      "Please attach your CV.",
    ];
    expect(event.detail).toEqual({ messages: expected, isStep: false });
    expect(fetchMock).not.toHaveBeenCalled();

    // Inline messages below each invalid field.
    expect(inlineMessages(fieldByLabel(formElement, "Your Name"))).toEqual(["Please enter your name."]);
    expect(inlineMessages(fieldByLabel(formElement, "Email Address"))).toEqual([
      "Please enter your email address.",
      "Please enter a valid email address.",
    ]);
    expect(inlineMessages(fieldByLabel(formElement, "Topic"))).toEqual(["Please choose a topic."]);
    expect(inlineMessages(fieldByLabel(formElement, "Interests"))).toEqual(["Please choose at least one interest."]);
    expect(inlineMessages(fieldByLabel(formElement, "Attach Your CV"))).toEqual(["Please attach your CV."]);
    for (const label of ["Your Name", "Email Address", "Topic", "Interests", "Attach Your CV"]) {
      expect(fieldByLabel(formElement, label).classList, label).toContain("formulate__field--validation-error");
    }
    expect(fieldByLabel(formElement, "Message").classList).not.toContain("formulate__field--validation-error");
    const list = fieldByLabel(formElement, "Your Name").querySelector("ul");
    expect(classSet(list)).toEqual(new Set(["formulate__inline-validation-summary"]));

    // The summary lists every message, and the button can be used again.
    expect(summaryMessages(formElement)).toEqual(expected);
    expect(buttonByText(formElement, "Send Message").disabled).toBe(false);
  });

  it("removes the messages once the fields are valid", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = renderContactForm();
    const errors = nextEvent(formElement, "formulate: submit: validation errors");
    buttonByText(formElement, "Send Message").click();
    await errors;

    fillContactForm(formElement);
    const success = nextEvent(formElement, "formulate form: submit: success");
    buttonByText(formElement, "Send Message").click();
    await success;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(formElement.querySelectorAll(".formulate__inline-validation-summary")).toHaveLength(0);
    expect(formElement.querySelectorAll(".formulate__field--validation-error")).toHaveLength(0);
    expect(formElement.querySelector(".formulate__validation-summary")).toBeNull();
  });

  it("treats whitespace as an empty value, as the server does", async () => {
    mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = renderContactForm();
    fillContactForm(formElement);
    typeInto(controlByLabel(formElement, "Your Name"), "   ");
    const errors = nextEvent<ValidationErrorsDetail>(formElement, "formulate: submit: validation errors");

    buttonByText(formElement, "Send Message").click();

    expect((await errors).detail.messages).toEqual(["Please enter your name."]);
  });

  it("regex validator uses configured pattern", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = renderContactForm((form) => {
      const email = form.data.fields.find((x) => x.alias === "email");
      const regex = email?.validations.find((x) => x.validationType === "regex");
      if (regex) {
        regex.configuration = { message: "Use your example.org address.", pattern: "^[^@\\s]+@example\\.org$" };
      }
    });
    fillContactForm(formElement);
    typeInto(controlByLabel(formElement, "Email Address"), "ada@example.com");
    const errors = nextEvent<ValidationErrorsDetail>(formElement, "formulate: submit: validation errors");

    buttonByText(formElement, "Send Message").click();

    expect((await errors).detail.messages).toEqual(["Use your example.org address."]);
    expect(inlineMessages(fieldByLabel(formElement, "Email Address"))).toEqual(["Use your example.org address."]);

    typeInto(controlByLabel(formElement, "Email Address"), "ada@example.org");
    const success = nextEvent(formElement, "formulate form: submit: success");
    buttonByText(formElement, "Send Message").click();
    await success;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inlineMessages(fieldByLabel(formElement, "Email Address"))).toEqual([]);
  });

  it("ignores a pattern the browser cannot compile and leaves the check to the server", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = renderContactForm((form) => {
      const regex = form.data.fields
        .find((x) => x.alias === "email")
        ?.validations.find((x) => x.validationType === "regex");
      if (regex) {
        regex.configuration = { message: "Invalid.", pattern: "(?i)^[a-z]+$" };
      }
    });
    fillContactForm(formElement);
    const success = nextEvent(formElement, "formulate form: submit: success");

    buttonByText(formElement, "Send Message").click();

    await success;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("(?i)^[a-z]+$"), expect.anything());
  });

  it("lets a listener hide the built-in summary by cancelling the validation errors event", async () => {
    mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = renderContactForm();
    formElement.parentElement?.addEventListener("formulate: submit: validation errors", (event) => {
      event.preventDefault();
    });
    const errors = nextEvent(formElement, "formulate: submit: validation errors");

    buttonByText(formElement, "Send Message").click();
    await errors;

    expect(formElement.querySelector(".formulate__validation-summary")).toBeNull();
    expect(inlineMessages(fieldByLabel(formElement, "Your Name"))).toEqual(["Please enter your name."]);
  });
});
