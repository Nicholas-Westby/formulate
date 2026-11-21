import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import {
  addPlaceholder,
  buttonByText,
  classSet,
  controlByLabel,
  fieldByLabel,
  fieldId,
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

beforeEach(() => {
  window.formulateMultiStepAnimationDelay = 1;
});
afterEach(resetPage);

type ValidationErrorsDetail = { messages: string[]; isStep: boolean };

function renderMultiStepForm() {
  const form = loadFixture("multi-step");
  addPlaceholder(form);
  const formElement = renderForm(form);
  if (!formElement) {
    throw new Error("The form did not render.");
  }
  return { form, formElement };
}

function activeStep(formElement: HTMLFormElement): HTMLElement {
  const steps = formElement.querySelectorAll<HTMLElement>(".formulate__step--active");
  expect(steps).toHaveLength(1);
  return steps[0];
}

/** Returns the indexes of the steps that are not hidden (with no CSS, the ones a visitor sees). */
function visibleSteps(formElement: HTMLFormElement): number[] {
  return [...formElement.querySelectorAll<HTMLElement>(":scope > section")]
    .map((step, index) => (step.hidden ? -1 : index))
    .filter((index) => index !== -1);
}

function activeButton(formElement: HTMLFormElement, text: string): HTMLButtonElement {
  return buttonByText(activeStep(formElement), text);
}

async function goToStep2(formElement: HTMLFormElement): Promise<void> {
  typeInto(controlByLabel(formElement, "First Name"), "Grace");
  let next = nextEvent(formElement, "formulate: validation: next: success");
  activeButton(formElement, "Next").click();
  await next;
  typeInto(controlByLabel(formElement, "Email Address"), "grace@example.com");
  next = nextEvent(formElement, "formulate: validation: next: success");
  activeButton(formElement, "Next").click();
  await next;
}

describe("multi-step forms", () => {
  it("renders rows between step dividers as steps, with only the first one active", () => {
    const { formElement } = renderMultiStepForm();

    const steps = [...formElement.querySelectorAll(":scope > section")];
    expect(steps.map(classSet)).toEqual([
      new Set(["formulate__step", "formulate__step--active", "formulate__step-0"]),
      new Set(["formulate__step", "formulate__step--inactive", "formulate__step-1"]),
      new Set(["formulate__step", "formulate__step--inactive", "formulate__step-2"]),
    ]);
    expect(steps.map((x) => x.getAttribute("aria-label"))).toEqual(["Form Step #1", "Form Step #2", "Form Step #3"]);
    expect([...steps[1].children].map(classSet)).toEqual([
      new Set(["formulate__row", "formulate__row--step-1", "formulate__row--inactive"]),
      new Set(["formulate__row", "formulate__row--step-1", "formulate__row--inactive"]),
    ]);
    // Next and Previous are plain buttons; the submit button waits for the last step.
    expect(buttonByText(steps[0], "Next").type).toBe("button");
    expect(buttonByText(steps[1], "Previous").type).toBe("button");
    expect(buttonByText(steps[2], "Register").type).toBe("submit");
    expect(buttonByText(steps[2], "Register").disabled).toBe(true);
  });

  it("multi-step next validates only current step", async () => {
    const { formElement } = renderMultiStepForm();
    const errors = nextEvent<ValidationErrorsDetail>(formElement, "formulate: submit: validation errors");

    activeButton(formElement, "Next").click();

    expect((await errors).detail).toEqual({ messages: ["Please enter your first name."], isStep: true });
    expect(activeStep(formElement).classList).toContain("formulate__step-0");
    expect(inlineMessages(fieldByLabel(formElement, "First Name"))).toEqual(["Please enter your first name."]);
    expect(summaryMessages(formElement)).toEqual(["Please enter your first name."]);
    // The email field (step 2) is empty and required, but it was not validated.
    expect(fieldByLabel(formElement, "Email Address").classList).not.toContain("formulate__field--validation-error");

    typeInto(controlByLabel(formElement, "First Name"), "Grace");
    const next = nextEvent<{ fields: unknown[]; payload: Record<string, unknown> }>(
      formElement,
      "formulate: validation: next: success",
    );
    activeButton(formElement, "Next").click();
    const nextEventDetail = (await next).detail;

    expect(nextEventDetail.fields).toHaveLength(2);
    expect(nextEventDetail.payload.FormId).toBe("e2e297dbf327433da9c5d9f35f32e976");
    const [step0, step1] = formElement.querySelectorAll(":scope > section");
    expect(classSet(step0)).toEqual(
      new Set([
        "formulate__step",
        "formulate__step-0",
        "formulate__step--inactive",
        "formulate__step--animating",
      ]),
    );
    expect(classSet(step1)).toEqual(
      new Set([
        "formulate__step",
        "formulate__step-1",
        "formulate__step--active",
        "formulate__step--animating",
      ]),
    );
    expect([...step1.children].every((x) => x.classList.contains("formulate__row--active"))).toBe(true);
    expect([...step0.children].every((x) => x.classList.contains("formulate__row--inactive"))).toBe(true);
    expect(fieldByLabel(formElement, "Email Address").classList).not.toContain("formulate__field--validation-error");
    expect(formElement.querySelector(".formulate__validation-summary")).toBeNull();

    // The animating class goes away after window.formulateMultiStepAnimationDelay.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(formElement.querySelectorAll(".formulate__step--animating")).toHaveLength(0);
  });

  it("previous never validates and the last step submits", async () => {
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    const { form, formElement } = renderMultiStepForm();
    typeInto(controlByLabel(formElement, "First Name"), "Grace");
    const next = nextEvent(formElement, "formulate: validation: next: success");
    activeButton(formElement, "Next").click();
    await next;
    const onErrors = vi.fn();
    formElement.addEventListener("formulate: submit: validation errors", onErrors);
    const previous = nextEvent(formElement, "formulate: submit: previous");

    // The email field is empty (and required), but going back does not validate it.
    activeButton(formElement, "Previous").click();
    await previous;
    await flush();

    expect(onErrors).not.toHaveBeenCalled();
    expect(activeStep(formElement).classList).toContain("formulate__step-0");
    expect(fieldByLabel(formElement, "Email Address").classList).not.toContain("formulate__field--validation-error");

    await goToStep2(formElement);
    expect(activeStep(formElement).classList).toContain("formulate__step-2");
    const register = activeButton(formElement, "Register");
    expect(register.disabled).toBe(false);
    typeInto(controlByLabel<HTMLTextAreaElement>(formElement, "Comments"), "See you there.");
    const success = nextEvent(formElement, "formulate form: submit: success");
    register.click();
    await success;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentFormData(fetchMock);
    expect(body.get(fieldId(form, "firstName"))).toBe("Grace");
    expect(body.get(fieldId(form, "email"))).toBe("grace@example.com");
    expect(body.get(fieldId(form, "comments"))).toBe("See you there.");
  });

  it("failed server validation jumps to the step containing the first invalid field", async () => {
    const { form, formElement } = renderMultiStepForm();
    mockFetch({
      Success: false,
      ValidationErrors: [
        { FieldName: "First Name", FieldId: fieldId(form, "firstName"), Messages: ["That name is taken."] },
      ],
    });
    await goToStep2(formElement);
    const errors = nextEvent<ValidationErrorsDetail>(formElement, "formulate: submit: validation errors");

    activeButton(formElement, "Register").click();

    expect((await errors).detail).toEqual({ messages: ["That name is taken."], isStep: false });
    expect(activeStep(formElement).classList).toContain("formulate__step-0");
    expect(inlineMessages(fieldByLabel(formElement, "First Name"))).toEqual(["That name is taken."]);
    expect(summaryMessages(formElement)).toEqual(["That name is taken."]);
    // The submit button belongs to the last step, so it stays disabled until the visitor returns.
    expect(buttonByText(formElement, "Register").disabled).toBe(true);
  });

  it("shows only the active step without any CSS, using the hidden attribute", async () => {
    const { formElement } = renderMultiStepForm();
    expect(visibleSteps(formElement)).toEqual([0]);

    typeInto(controlByLabel(formElement, "First Name"), "Grace");
    const next = nextEvent(formElement, "formulate: validation: next: success");
    activeButton(formElement, "Next").click();
    await next;
    // The incoming step shows at once; the outgoing step hides after the animation delay.
    expect(visibleSteps(formElement)).toEqual([0, 1]);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(visibleSteps(formElement)).toEqual([1]);
  });

  describe("with the default animation delay", () => {
    beforeEach(() => {
      delete window.formulateMultiStepAnimationDelay;
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function goToStep1(formElement: HTMLFormElement): Promise<void> {
      typeInto(controlByLabel(formElement, "First Name"), "Grace");
      const next = nextEvent(formElement, "formulate: validation: next: success");
      activeButton(formElement, "Next").click();
      await next;
    }

    it("hides the outgoing step after 500 ms when the delay is not set", async () => {
      const { formElement } = renderMultiStepForm();
      await goToStep1(formElement);
      const [step0, step1] = formElement.querySelectorAll<HTMLElement>(":scope > section");

      vi.advanceTimersByTime(499);
      expect(step0.hidden).toBe(false);
      expect(step0.classList).toContain("formulate__step--animating");

      vi.advanceTimersByTime(1);
      expect(step0.hidden).toBe(true);
      expect(classSet(step0)).toEqual(new Set(["formulate__step", "formulate__step-0", "formulate__step--inactive"]));
      expect(classSet(step1)).toEqual(new Set(["formulate__step", "formulate__step-1", "formulate__step--active"]));
    });

    it("leaves step 0 visible and active after Next then Previous within the delay", async () => {
      const { formElement } = renderMultiStepForm();
      await goToStep1(formElement);
      const [step0, step1] = formElement.querySelectorAll<HTMLElement>(":scope > section");
      vi.advanceTimersByTime(100);

      activeButton(formElement, "Previous").click();
      // Past the time the first transition's timer was due (500 ms), before the second one's (600 ms).
      vi.advanceTimersByTime(450);

      expect(step0.hidden).toBe(false);
      expect(classSet(step0)).toEqual(
        new Set(["formulate__step", "formulate__step-0", "formulate__step--active", "formulate__step--animating"]),
      );
      expect(classSet(step1)).toEqual(
        new Set(["formulate__step", "formulate__step-1", "formulate__step--inactive", "formulate__step--animating"]),
      );

      vi.advanceTimersByTime(100);

      expect(visibleSteps(formElement)).toEqual([0]);
      expect(classSet(step0)).toEqual(new Set(["formulate__step", "formulate__step-0", "formulate__step--active"]));
      expect(classSet(step1)).toEqual(new Set(["formulate__step", "formulate__step-1", "formulate__step--inactive"]));
    });
  });

  it("starts with an active step when the layout begins with a step divider", () => {
    const form = loadFixture("multi-step");
    form.data.rows.unshift({ isStep: true, cells: [] });
    form.data.rows.splice(3, 0, { isStep: true, cells: [] });
    addPlaceholder(form);

    const formElement = renderForm(form);

    const steps = [...(formElement?.querySelectorAll(":scope > section") ?? [])];
    expect(steps.map(classSet)).toEqual([
      new Set(["formulate__step", "formulate__step--active", "formulate__step-0"]),
      new Set(["formulate__step", "formulate__step--inactive", "formulate__step-1"]),
      new Set(["formulate__step", "formulate__step--inactive", "formulate__step-2"]),
    ]);
  });
});
