import { afterEach, describe, expect, it, vi } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import type { FormulateField, FormulateForm } from "../src/types";
import {
  addPlaceholder,
  buttonByText,
  classSet,
  controlByLabel,
  fieldByLabel,
  fieldId,
  fillContactForm,
  inlineMessages,
  loadFixture,
  mockFetch,
  nextEvent,
  resetPage,
  sentFormData,
  typeInto,
} from "./helpers";

afterEach(resetPage);

/**
 * A custom field written the way the v3 documentation describes: a plain class
 * with getElement, setData and checkValidity (returning an array of promises).
 */
class StarRating {
  static lastValidators: Record<string, unknown> | undefined;
  id: string;
  alias: string | null;
  wrapper: HTMLDivElement;
  element: HTMLInputElement;

  constructor(fieldData: FormulateField, fieldValidators: Record<string, unknown>, cssClasses: string[]) {
    StarRating.lastValidators = fieldValidators;
    this.id = fieldData.id;
    this.alias = fieldData.alias;
    this.wrapper = document.createElement("div");
    cssClasses.forEach((x) => this.wrapper.classList.add(x));
    this.element = document.createElement("input");
    this.element.type = "number";
    this.element.id = `rating-${fieldData.randomId}`;
    this.element.value = "0";
    const label = document.createElement("label");
    label.className = "formulate__field__label";
    label.htmlFor = this.element.id;
    label.textContent = fieldData.label;
    this.wrapper.append(this.element, label);
  }

  getElement() {
    return this.wrapper;
  }

  setData(data: FormData | Record<string, unknown>, options?: { rawDataByAlias?: boolean }) {
    if (options?.rawDataByAlias) {
      if (this.alias) {
        (data as Record<string, unknown>)[this.alias] = this.element.value;
      }
    } else {
      (data as FormData).append(this.id, this.element.value);
    }
  }

  checkValidity() {
    const valid = this.element.value !== "0";
    return [Promise.resolve(valid ? { success: true } : { success: false, message: "Please rate us." })];
  }
}

const ratingField: FormulateField = {
  alias: "rating",
  label: "Rating",
  id: "6b1f5bd2a5c44c1e9d0c7e4f2a3b8c91",
  randomId: "a0c95b3e7d214f6e8b5a9c0d1e2f3a4b",
  fieldType: "star-rating",
  validations: [],
  configuration: {},
  initialValue: "",
  category: null,
};

/** Adds a field to the contact fixture, in its own row above the submit button. */
function withField(form: FormulateForm, field: FormulateField): FormulateForm {
  form.data.fields.push(field);
  form.data.rows.splice(form.data.rows.length - 1, 0, {
    isStep: false,
    cells: [{ columns: 12, fields: [{ id: field.id }] }],
  });
  return form;
}

function render(form: FormulateForm): HTMLFormElement {
  addPlaceholder(form);
  const formElement = renderForm(form);
  if (!formElement) {
    throw new Error("The form did not render.");
  }
  return formElement;
}

describe("extension points", () => {
  it("custom field renderer registered on window is used", async () => {
    window["formulate-plain-js-fields"] = [{ key: "star-rating", renderer: StarRating }];
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const form = withField(loadFixture("contact"), ratingField);
    const formElement = render(form);

    const rating = fieldByLabel(formElement, "Rating");
    expect(classSet(rating)).toEqual(new Set(["formulate__field", "formulate__field--star-rating"]));
    expect(typeof StarRating.lastValidators?.required).toBe("function");
    expect(typeof StarRating.lastValidators?.regex).toBe("function");

    fillContactForm(formElement);
    const errors = nextEvent<{ messages: string[] }>(formElement, "formulate: submit: validation errors");
    buttonByText(formElement, "Send Message").click();
    expect((await errors).detail.messages).toEqual(["Please rate us."]);

    typeInto(controlByLabel(formElement, "Rating"), "4");
    const success = nextEvent<{ dataByAlias: Record<string, unknown> }>(
      formElement,
      "formulate form: submit: success",
    );
    buttonByText(formElement, "Send Message").click();
    expect((await success).detail.dataByAlias.rating).toBe("4");
    expect(sentFormData(fetchMock).get(ratingField.id)).toBe("4");
  });

  it("accepts a single renderer object assigned to the window, as the v3 documentation shows", () => {
    window["formulate-plain-js-fields"] = { key: "star-rating", renderer: StarRating };

    const formElement = render(withField(loadFixture("contact"), ratingField));

    expect(fieldByLabel(formElement, "Rating").classList).toContain("formulate__field--star-rating");
  });

  it("uses custom validators registered on window", async () => {
    class NoPizzaValidator {
      validateText(value: string) {
        return Promise.resolve(!/pizza/i.test(value));
      }
    }
    window["formulate-plain-js-validators"] = [{ key: "no-pizza", validator: NoPizzaValidator }];
    mockFetch({ Success: true, ValidationErrors: [] });
    const form = loadFixture("contact");
    form.data.fields
      .find((x) => x.alias === "message")
      ?.validations.push({
        id: "f0e1d2c3b4a5968778695a4b3c2d1e0f",
        alias: "No Pizza",
        validationType: "no-pizza",
        configuration: { message: "No pizza talk, please." },
      });
    const formElement = render(form);
    fillContactForm(formElement);
    typeInto(controlByLabel<HTMLTextAreaElement>(formElement, "Message"), "I love pizza.");
    const errors = nextEvent<{ messages: string[] }>(formElement, "formulate: submit: validation errors");

    buttonByText(formElement, "Send Message").click();

    expect((await errors).detail.messages).toEqual(["No pizza talk, please."]);
    const message = fieldByLabel(formElement, "Message");
    expect(message.classList).toContain("formulate__validation-type--no-pizza");
    expect(inlineMessages(message)).toEqual(["No pizza talk, please."]);
  });

  it("warns about a validation type that has no validator and leaves it to the server", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const form = loadFixture("contact");
    form.data.fields
      .find((x) => x.alias === "message")
      ?.validations.push({
        id: "0f1e2d3c4b5a69788796a5b4c3d2e1f0",
        alias: "Profanity Filter",
        validationType: "profanity",
        configuration: {},
      });
    const formElement = render(form);
    fillContactForm(formElement);
    const success = nextEvent(formElement, "formulate form: submit: success");

    buttonByText(formElement, "Send Message").click();
    await success;

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"profanity"'));
    expect(sentFormData(fetchMock).get(fieldId(form, "message"))).toBe("Hello there.");
  });
});
