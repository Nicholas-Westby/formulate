/// <reference types="vite/client" />
import { parseSync } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import extendingDocs from "../../../../docs/extending.md?raw";
import * as api from "../src/api";
import apiSource from "../src/api.ts?raw";
import {
  FieldRendererBase,
  registerFieldRenderer,
  registerValidator,
  renderForm,
  RenderText,
  type FieldRendererRegistration,
  type FieldValidatorMap,
  type FormulateField,
  type FormulateForm,
} from "../src/api";
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
  sentFormData,
  typeInto,
} from "./helpers";

/** Where the renderer keeps what every copy of it on the page shares. */
const pageStateKey = Symbol.for("Formulate.PlainJavaScript.pageState");

function clearPageState(): void {
  delete (window as unknown as Record<symbol, unknown>)[pageStateKey];
}

beforeEach(() => {
  resetPage();
  clearPageState();
});
afterEach(() => {
  resetPage();
  clearPageState();
});

/** The names in the first column of a table in docs/extending.md, between <!-- marker:start --> and <!-- marker:end -->. */
function documentedNames(marker: string): string[] {
  const start = extendingDocs.indexOf(`<!-- ${marker}:start -->`);
  const end = extendingDocs.indexOf(`<!-- ${marker}:end -->`);
  expect(start, `docs/extending.md has <!-- ${marker}:start -->`).toBeGreaterThan(-1);
  expect(end, `docs/extending.md has <!-- ${marker}:end -->`).toBeGreaterThan(start);
  return [...extendingDocs.slice(start, end).matchAll(/^\|\s*`([A-Za-z_$][\w$]*)/gm)].map((x) => x[1]).sort();
}

/** A field the contact fixture does not have, with a Mandatory validation. */
function makeField(alias: string, label: string, fieldType: string, message = `Please enter your ${label.toLowerCase()}.`): FormulateField {
  return {
    alias,
    label,
    id: `${alias.padEnd(8, "0").slice(0, 8)}a5c44c1e9d0c7e4f2a3b8c91`,
    randomId: `${alias.padEnd(8, "0").slice(0, 8)}7d214f6e8b5a9c0d1e2f3a4b`,
    fieldType,
    validations: [
      {
        id: "c0ffee00000000000000000000000001",
        alias: "Mandatory",
        validationType: "required",
        configuration: { message },
      },
    ],
    configuration: {},
    initialValue: "",
    category: null,
  };
}

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

/** Submits the form and resolves with the messages of the validation errors event. */
async function submitWithErrors(formElement: HTMLFormElement): Promise<string[]> {
  const errors = nextEvent<{ messages: string[] }>(formElement, "formulate: submit: validation errors");
  buttonByText(formElement, "Send Message").click();
  return (await errors).detail.messages;
}

/** Submits the form and resolves with the values by alias of the success event. */
async function submitWithSuccess(formElement: HTMLFormElement): Promise<Record<string, unknown>> {
  const success = nextEvent<{ dataByAlias: Record<string, unknown> }>(formElement, "formulate form: submit: success");
  buttonByText(formElement, "Send Message").click();
  return (await success).detail.dataByAlias;
}

/** The phone field of the documentation: a text field with another input type. */
class RenderPhone extends RenderText {
  static override inputType = "tel";
}

describe("the API module", () => {
  it("exports exactly the values that docs/extending.md lists", () => {
    expect(Object.keys(api).sort()).toEqual(documentedNames("api-exports"));
  });

  it("exports every type in types.ts, plus exactly the types that docs/extending.md lists", () => {
    const { module, errors } = parseSync("api.ts", apiSource);
    expect(errors).toEqual([]);
    const typeExports = module.staticExports.flatMap((x) => x.entries).filter((x) => x.isType);
    const reExportedModules = typeExports.filter((x) => x.exportName.kind === "None").map((x) => x.moduleRequest?.value);
    const namedTypes = typeExports.filter((x) => x.exportName.kind === "Name").map((x) => x.exportName.name ?? "");

    expect(reExportedModules).toEqual(["./types.js"]);
    expect(namedTypes.sort()).toEqual(documentedNames("api-types"));
  });

  it("is what the entry module exports, and what window.formulatePlainJs holds besides its version", async () => {
    vi.resetModules();
    const freshApi = await import("../src/api");
    const entry = await import("../src/index");

    expect(Object.keys(entry).sort()).toEqual(Object.keys(freshApi).sort());
    expect(Object.keys(window.formulatePlainJs ?? {}).sort()).toEqual(["version", ...Object.keys(freshApi)].sort());
    for (const name of Object.keys(freshApi) as (keyof typeof freshApi)[]) {
      expect(entry[name], name).toBe(freshApi[name]);
      expect(window.formulatePlainJs?.[name], name).toBe(freshApi[name]);
    }
  });
});

describe("importing a module other than the entry", () => {
  const modules = import.meta.glob("../src/**/*.ts");
  const nonEntryModules = Object.keys(modules).filter((x) => x !== "../src/index.ts" && !x.endsWith(".d.ts"));

  it("covers every module but the entry", () => {
    expect(nonEntryModules.length).toBeGreaterThan(30);
  });

  it.each(nonEntryModules)("%s starts nothing", async (path) => {
    vi.resetModules();
    const queue: FormulateForm[] = [];
    window["formulate-plain-js-forms"] = queue;
    const windowKeys = Reflect.ownKeys(window);
    const listen = [vi.spyOn(document, "addEventListener"), vi.spyOn(window, "addEventListener")];
    const output = (["log", "info", "warn", "error"] as const).map((x) => vi.spyOn(console, x));

    await modules[path]();

    expect(window.formulatePlainJs).toBeUndefined();
    // The forms queue is still the page's own array, not the renderer's.
    expect(window["formulate-plain-js-forms"]).toBe(queue);
    expect(queue.push).toBe(Array.prototype.push);
    expect(Reflect.ownKeys(window)).toEqual(windowKeys);
    expect(document.documentElement.innerHTML).toBe("<head></head><body></body>");
    for (const spy of [...listen, ...output]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe("registerFieldRenderer", () => {
  it("adds a renderer that forms rendered after it use", async () => {
    registerFieldRenderer("phone", RenderPhone);
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const phone = makeField("phone", "Phone", "phone");
    const formElement = render(withField(loadFixture("contact"), phone));
    fillContactForm(formElement);

    const input = controlByLabel(formElement, "Phone");
    expect(input.type).toBe("tel");
    expect(await submitWithErrors(formElement)).toEqual(["Please enter your phone."]);

    typeInto(input, "+1 555 0100");
    expect((await submitWithSuccess(formElement)).phone).toBe("+1 555 0100");
    expect(sentFormData(fetchMock).get(phone.id)).toBe("+1 555 0100");
  });

  it("adds to the window registry, keeping what is there (even a single v3 registration)", () => {
    class StarRating {
      getElement() {
        return document.createElement("div");
      }
    }
    window["formulate-plain-js-fields"] = { key: "star-rating", renderer: StarRating };

    registerFieldRenderer("phone", RenderPhone);

    expect(window["formulate-plain-js-fields"]).toEqual([
      { key: "star-rating", renderer: StarRating },
      { key: "phone", renderer: RenderPhone },
    ]);
  });

  it("works alongside renderers added to the window array, in either order, and the last one for a key wins", () => {
    class RenderShout extends RenderText {
      constructor(...args: ConstructorParameters<typeof RenderText>) {
        super(...args);
        this.element.classList.add("shout");
      }
    }
    registerFieldRenderer("text", RenderShout);
    (window["formulate-plain-js-fields"] as FieldRendererRegistration[]).push({ key: "phone", renderer: RenderPhone });
    const formElement = render(withField(loadFixture("contact"), makeField("phone", "Phone", "phone")));

    expect(controlByLabel(formElement, "Your Name").classList).toContain("shout");
    expect(controlByLabel(formElement, "Phone").type).toBe("tel");
  });

  it("refuses a registration without a field type or a class", () => {
    expect(() => registerFieldRenderer("", RenderPhone)).toThrow(TypeError);
    expect(() => registerFieldRenderer(undefined as unknown as string, RenderPhone)).toThrow(TypeError);
    expect(() => registerFieldRenderer("phone", {} as unknown as typeof RenderPhone)).toThrow(TypeError);
    expect(window["formulate-plain-js-fields"]).toBeUndefined();
  });

  it("warns about a renderer registered after a form used its field type, and later forms use it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const first = render(withField(loadFixture("contact"), makeField("phone", "Phone", "phone")));
    expect(() => fieldByLabel(first, "Phone")).toThrow();
    warn.mockClear();

    registerFieldRenderer("phone", RenderPhone);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"phone"');
    const later = render(withField(loadFixture("contact"), makeField("phone", "Phone", "phone")));
    expect(controlByLabel(later, "Phone").type).toBe("tel");
  });

  it("does not warn about a renderer registered before any form used its field type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(loadFixture("contact"));

    registerFieldRenderer("phone", RenderPhone);

    expect(warn).not.toHaveBeenCalled();
  });
});

describe("registerValidator", () => {
  class NoPizzaValidator {
    validateText(value: string | null | undefined) {
      return !/pizza/i.test(value ?? "");
    }
  }

  function withNoPizza(form: FormulateForm): FormulateForm {
    form.data.fields
      .find((x) => x.alias === "message")
      ?.validations.push({
        id: "f0e1d2c3b4a5968778695a4b3c2d1e0f",
        alias: "No Pizza",
        validationType: "no-pizza",
        configuration: { message: "No pizza talk, please." },
      });
    return form;
  }

  it("adds a validator that forms rendered after it use", async () => {
    registerValidator("no-pizza", NoPizzaValidator);
    mockFetch({ Success: true, ValidationErrors: [] });
    const formElement = render(withNoPizza(loadFixture("contact")));
    fillContactForm(formElement);
    typeInto(controlByLabel<HTMLTextAreaElement>(formElement, "Message"), "I love pizza.");

    expect(await submitWithErrors(formElement)).toEqual(["No pizza talk, please."]);
    expect(inlineMessages(fieldByLabel(formElement, "Message"))).toEqual(["No pizza talk, please."]);
    expect(window["formulate-plain-js-validators"]).toEqual([{ key: "no-pizza", validator: NoPizzaValidator }]);
  });

  it("refuses a registration without a validation type or a class", () => {
    expect(() => registerValidator("", NoPizzaValidator)).toThrow(TypeError);
    expect(() => registerValidator("no-pizza", "NoPizzaValidator" as unknown as typeof NoPizzaValidator)).toThrow(TypeError);
    expect(window["formulate-plain-js-validators"]).toBeUndefined();
  });

  it("warns about a validator registered after a form used its validation type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(withNoPizza(loadFixture("contact")));
    warn.mockClear();

    registerValidator("no-pizza", NoPizzaValidator);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"no-pizza"');
  });
});

describe("a renderer built on a built-in one", () => {
  it("is a phone field in a few lines: a RenderText with another input type", () => {
    registerFieldRenderer("phone", RenderPhone);
    const formElement = render(withField(loadFixture("contact"), makeField("phone", "Phone", "phone")));
    const field = fieldByLabel(formElement, "Phone");
    const input = controlByLabel(formElement, "Phone");

    // The same markup as a text field, but for the input's type and the field type's class.
    expect(classSet(field)).toEqual(
      new Set(["formulate__field", "formulate__field--phone", "formulate__validation-type--required"]),
    );
    expect(input.type).toBe("tel");
    expect(input.placeholder).toBe("Phone");
    expect(field.querySelector("label")?.htmlFor).toBe(input.id);
  });
});

describe("a renderer built on FieldRendererBase", () => {
  /** A number field: everything but the element's type comes from the base class. */
  class RenderNumber extends FieldRendererBase<HTMLInputElement> {
    constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
      super(fieldData, fieldValidators);
      this.initializeField({ type: "number", cssClasses });
    }
  }

  /** A star rating made of buttons. It gives its value with getValue. */
  class RenderRating extends FieldRendererBase {
    private rating = 0;

    constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
      super(fieldData, fieldValidators);
      const fieldset = this.initializeGroup(cssClasses);
      for (let stars = 1; stars <= 5; stars++) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `${stars} stars`;
        button.addEventListener("click", () => {
          this.rating = stars;
        });
        fieldset.appendChild(button);
      }
    }

    override getValue(): string {
      return this.rating === 0 ? "" : String(this.rating);
    }
  }

  it("gets the label, wrapper, placeholder, messages, posting and checking from the base class", async () => {
    registerFieldRenderer("number", RenderNumber);
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const age = makeField("age", "Age", "number");
    const formElement = render(withField(loadFixture("contact"), age));
    fillContactForm(formElement);
    const field = fieldByLabel(formElement, "Age");
    const input = controlByLabel(formElement, "Age");

    expect(classSet(field)).toEqual(
      new Set(["formulate__field", "formulate__field--number", "formulate__validation-type--required"]),
    );
    expect(input.type).toBe("number");
    expect(input.placeholder).toBe("Age");

    expect(await submitWithErrors(formElement)).toEqual(["Please enter your age."]);
    expect(inlineMessages(field)).toEqual(["Please enter your age."]);
    expect(input.getAttribute("aria-invalid")).toBe("true");

    typeInto(input, "36");
    expect((await submitWithSuccess(formElement)).age).toBe("36");
    expect(sentFormData(fetchMock).get(age.id)).toBe("36");
    expect(inlineMessages(field)).toEqual([]);
  });

  it("posts and checks the value its getValue gives", async () => {
    registerFieldRenderer("rating", RenderRating);
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const rating = makeField("rating", "Rating", "rating", "Please rate us.");
    const formElement = render(withField(loadFixture("contact"), rating));
    fillContactForm(formElement);
    const field = fieldByLabel(formElement, "Rating");

    expect(field.tagName).toBe("FIELDSET");
    expect(await submitWithErrors(formElement)).toEqual(["Please rate us."]);
    expect(inlineMessages(field)).toEqual(["Please rate us."]);

    buttonByText(formElement, "4 stars").click();
    expect((await submitWithSuccess(formElement)).rating).toBe("4");
    expect(sentFormData(fetchMock).get(rating.id)).toBe("4");
  });

  it("posts nothing and is always valid when it has no value", async () => {
    class RenderNote extends FieldRendererBase<HTMLParagraphElement> {
      constructor(fieldData: FormulateField, fieldValidators: FieldValidatorMap, cssClasses: string[]) {
        super(fieldData, fieldValidators);
        this.initializeField({ nodeName: "p", cssClasses, useLabel: false, usePlaceholder: false, useWrapper: false });
        this.element.textContent = "We reply within a day.";
      }
    }
    registerFieldRenderer("note", RenderNote);
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const note = makeField("note", "Note", "note");
    const formElement = render(withField(loadFixture("contact"), note));
    fillContactForm(formElement);

    const dataByAlias = await submitWithSuccess(formElement);

    expect("note" in dataByAlias).toBe(false);
    expect(sentFormData(fetchMock).has(note.id)).toBe(false);
  });
});
