import { afterEach, describe, expect, it } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import {
  addPlaceholder,
  buttonByText,
  controlByLabel,
  fieldByLabel,
  fieldId,
  fillContactForm,
  loadFixture,
  mockFetch,
  nextEvent,
  resetPage,
  typeInto,
} from "./helpers";

afterEach(resetPage);

function render(name: Parameters<typeof loadFixture>[0]) {
  const form = loadFixture(name);
  addPlaceholder(form);
  const formElement = renderForm(form);
  if (!formElement) {
    throw new Error("The form did not render.");
  }
  return { form, formElement };
}

/** Returns the text of each element the control's aria-describedby points at. */
function descriptions(control: Element): string[] {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `(no element with the ID "${id}")`);
}

/** Clicks the button and waits for the validation errors event. */
async function clickAndWaitForErrors(formElement: HTMLFormElement, buttonText: string): Promise<void> {
  const errors = nextEvent(formElement, "formulate: submit: validation errors");
  buttonByText(formElement, buttonText).click();
  await errors;
}

describe("accessibility", () => {
  it("marks invalid controls with aria-invalid and points aria-describedby at their messages", async () => {
    const { formElement } = render("contact");
    const name = controlByLabel(formElement, "Your Name");
    const help = document.createElement("p");
    help.id = "name-help";
    help.textContent = "As it appears on your passport.";
    formElement.appendChild(help);
    name.setAttribute("aria-describedby", "name-help");

    await clickAndWaitForErrors(formElement, "Send Message");

    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(descriptions(name)).toEqual(["As it appears on your passport.", "Please enter your name."]);
    // Every checkbox in an invalid list is marked and described.
    for (const checkbox of fieldByLabel(formElement, "Interests").querySelectorAll("input")) {
      expect(checkbox.getAttribute("aria-invalid")).toBe("true");
      expect(descriptions(checkbox)).toEqual(["Please choose at least one interest."]);
    }
    const message = controlByLabel<HTMLTextAreaElement>(formElement, "Message");
    expect(message.hasAttribute("aria-invalid")).toBe(false);
    expect(message.hasAttribute("aria-describedby")).toBe(false);

    // Once the field is valid, both are cleared, and other descriptions stay.
    typeInto(name, "Ada Lovelace");
    await clickAndWaitForErrors(formElement, "Send Message");

    expect(name.hasAttribute("aria-invalid")).toBe(false);
    expect(name.getAttribute("aria-describedby")).toBe("name-help");
  });

  it("moves focus to the first invalid field when a submission fails validation", async () => {
    const { formElement } = render("contact");
    typeInto(controlByLabel(formElement, "Your Name"), "Ada Lovelace");
    typeInto(controlByLabel(formElement, "Email Address"), "ada@example.com");
    buttonByText(formElement, "Send Message").focus();

    await clickAndWaitForErrors(formElement, "Send Message");

    expect(document.activeElement).toBe(controlByLabel(formElement, "Topic"));
  });

  it("moves focus to the first invalid field of the step when Next fails validation", async () => {
    const { formElement } = render("multi-step");

    await clickAndWaitForErrors(formElement, "Next");

    expect(document.activeElement).toBe(controlByLabel(formElement, "First Name"));
  });

  it("moves focus to the first field the server rejected", async () => {
    const { form, formElement } = render("contact");
    mockFetch({
      Success: false,
      ValidationErrors: [
        { FieldName: "Email Address", FieldId: fieldId(form, "email"), Messages: ["That address is blocked."] },
      ],
    });
    fillContactForm(formElement);

    await clickAndWaitForErrors(formElement, "Send Message");

    expect(document.activeElement).toBe(controlByLabel(formElement, "Email Address"));
  });

  it("puts role=alert on a wrapper around the validation summary, so the list stays a list", async () => {
    const { formElement } = render("contact");

    await clickAndWaitForErrors(formElement, "Send Message");

    const list = formElement.querySelector(".formulate__validation-summary");
    expect(list?.tagName).toBe("UL");
    expect(list?.hasAttribute("role")).toBe(false);
    const alert = list?.parentElement;
    expect(alert?.tagName).toBe("DIV");
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.parentElement).toBe(formElement);

    // A valid submission removes the whole summary.
    mockFetch({ Success: true, ValidationErrors: [] });
    fillContactForm(formElement);
    const success = nextEvent(formElement, "formulate form: submit: success");
    buttonByText(formElement, "Send Message").click();
    await success;

    expect(formElement.querySelector("[role='alert']")).toBeNull();
  });

  it("names controls with their labels rather than aria-label, so descriptions are included", () => {
    const { formElement } = render("all-field-types");

    expect(formElement.querySelectorAll("input[aria-label], select[aria-label], textarea[aria-label]")).toHaveLength(0);
    const deliveryLabels = [...fieldByLabel(formElement, "Delivery").querySelectorAll("label")];
    expect(deliveryLabels.map((x) => x.textContent)).toEqual([
      "Standard Arrives in 3-5 days",
      "Express Arrives tomorrow",
    ]);
  });
});
