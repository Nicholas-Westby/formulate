import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import type { FormulateField } from "../src/types";
import {
  addPlaceholder,
  buttonByText,
  fieldByLabel,
  fieldData,
  fillContactForm,
  inlineMessages,
  loadFixture,
  mockFetch,
  nextEvent,
  resetPage,
  sentFormData,
} from "./helpers";

/** Loads a fresh copy of the entry script, as a page load would. */
async function loadScript(): Promise<void> {
  vi.resetModules();
  await import("../src/index");
}

/**
 * Makes the navigation timing report when DOMContentLoaded started (0 when it
 * has not fired yet), or report no navigation entry at all (null, as in jsdom).
 */
function stubNavigationTiming(domContentLoadedEventStart: number | null): void {
  const entries = domContentLoadedEventStart === null ? [] : [{ entryType: "navigation", domContentLoadedEventStart }];
  vi.spyOn(performance, "getEntriesByType").mockImplementation(
    (type: string) => (type === "navigation" ? entries : []) as unknown as PerformanceEntryList,
  );
}

/** A custom field renderer, registered the way a site's script would. */
class Marker {
  private readonly element = document.createElement("div");

  constructor(fieldData: FormulateField) {
    this.element.classList.add("custom-marker");
    this.element.textContent = fieldData.label;
  }

  getElement(): HTMLElement {
    return this.element;
  }
}

beforeEach(resetPage);
afterEach(resetPage);

describe("the entry script", () => {
  it("two forms render independently", async () => {
    const contact = loadFixture("contact");
    const steps = loadFixture("multi-step");
    const contactWrapper = addPlaceholder(contact);
    const stepsWrapper = addPlaceholder(steps);
    window["formulate-plain-js-forms"] = [contact, steps];

    await loadScript();

    const contactForm = contactWrapper.querySelector("form");
    const stepsForm = stepsWrapper.querySelector("form");
    expect(contactForm).not.toBeNull();
    expect(stepsForm).not.toBeNull();
    expect(contactWrapper.querySelectorAll("form")).toHaveLength(1);
    expect(stepsWrapper.querySelectorAll("form")).toHaveLength(1);
    expect(fieldByLabel(contactWrapper, "Your Name")).toBeTruthy();
    expect(fieldByLabel(stepsWrapper, "First Name")).toBeTruthy();

    // Both forms have an "Email Address" field, but no element IDs collide.
    const ids = [...document.querySelectorAll("[id]")].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Validating one form leaves the other alone.
    if (!contactForm || !stepsForm) {
      return;
    }
    const errors = nextEvent(contactForm, "formulate: submit: validation errors");
    buttonByText(contactForm, "Send Message").click();
    await errors;
    expect(inlineMessages(fieldByLabel(contactForm, "Email Address"))).not.toEqual([]);
    expect(stepsForm.querySelectorAll(".formulate__field--validation-error")).toHaveLength(0);
    expect(stepsForm.querySelector(".formulate__validation-summary")).toBeNull();

    // Submitting one form sends only that form.
    const fetchMock = mockFetch({ Success: true, ValidationErrors: [] });
    fillContactForm(contactForm);
    const success = nextEvent(contactForm, "formulate form: submit: success");
    buttonByText(contactForm, "Send Message").click();
    await success;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(contact.data.url);
    expect(sentFormData(fetchMock).get("FormId")).toBe(contact.data.payload.FormId);
    expect([...stepsForm.querySelectorAll("button")].filter((x) => x.disabled).map((x) => x.textContent)).toEqual([
      "Register",
    ]);
  });

  it("renders forms pushed after the script has started", async () => {
    await loadScript();
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);

    window["formulate-plain-js-forms"] ??= [];
    window["formulate-plain-js-forms"].push(form);

    expect(wrapper.querySelector("form.formulate__form")).not.toBeNull();
  });

  it("waits for DOMContentLoaded while the page is still loading", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);
    window["formulate-plain-js-forms"] = [form];

    await loadScript();
    expect(wrapper.querySelector("form")).toBeNull();

    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(wrapper.querySelector("form")).not.toBeNull();
  });

  it("waits for DOMContentLoaded when it runs as a deferred script, so later scripts can register fields", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    stubNavigationTiming(0);
    const form = loadFixture("contact");
    fieldData(form, "message").fieldType = "marker";
    const wrapper = addPlaceholder(form);
    window["formulate-plain-js-forms"] = [form];

    await loadScript();
    // A custom field script deferred after formulate.js runs now, before DOMContentLoaded.
    window["formulate-plain-js-fields"] = [{ key: "marker", renderer: Marker }];
    expect(wrapper.querySelector("form")).toBeNull();

    document.dispatchEvent(new Event("DOMContentLoaded"));
    window.dispatchEvent(new Event("load"));

    expect(wrapper.querySelectorAll("form")).toHaveLength(1);
    expect(wrapper.querySelector(".custom-marker")?.textContent).toBe("Message");
  });

  it("starts at once when DOMContentLoaded has already fired", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    stubNavigationTiming(250);
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);
    window["formulate-plain-js-forms"] = [form];

    await loadScript();

    expect(wrapper.querySelector("form")).not.toBeNull();
  });

  it("starts at once when there is no navigation timing and the page is interactive", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    stubNavigationTiming(null);
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);
    window["formulate-plain-js-forms"] = [form];

    await loadScript();

    expect(wrapper.querySelector("form")).not.toBeNull();
  });

  it("starts on the load event if DOMContentLoaded never arrives", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("interactive");
    stubNavigationTiming(0);
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);
    window["formulate-plain-js-forms"] = [form];

    await loadScript();
    expect(wrapper.querySelector("form")).toBeNull();

    window.dispatchEvent(new Event("load"));

    expect(wrapper.querySelector("form")).not.toBeNull();
  });

  it("keeps rendering the other forms when one cannot be rendered", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    window["formulate-plain-js-fields"] = [
      {
        key: "broken",
        renderer: class {
          constructor() {
            throw new Error("This renderer is broken.");
          }
          getElement() {
            return document.createElement("div");
          }
        },
      },
    ];
    const broken = loadFixture("contact");
    const message = broken.data.fields.find((x) => x.alias === "message");
    if (message) {
      message.fieldType = "broken";
    }
    const working = loadFixture("multi-step");
    const brokenWrapper = addPlaceholder(broken);
    const workingWrapper = addPlaceholder(working);
    window["formulate-plain-js-forms"] = [broken, working];

    await loadScript();

    expect(error).toHaveBeenCalledWith(expect.stringContaining('"Contact Us"'), expect.any(Error));
    expect(brokenWrapper.querySelector("form")).toBeNull();
    expect(workingWrapper.querySelector("form")).not.toBeNull();
  });

  it("exposes the version and renderForm on window.formulatePlainJs", async () => {
    await loadScript();
    const form = loadFixture("contact");
    const slot = document.createElement("div");
    document.body.appendChild(slot);

    expect(window.formulatePlainJs?.version).toBe(packageJson.version);
    const formElement = window.formulatePlainJs?.renderForm(form, slot);

    expect(formElement?.parentElement).toBe(document.body);
    expect(document.body.querySelector("form.formulate__form")).toBe(formElement);
  });

  it("ignores a second copy of the script", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await loadScript();
    const first = window.formulatePlainJs;
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);

    await loadScript();
    window["formulate-plain-js-forms"]?.push(form);

    expect(window.formulatePlainJs).toBe(first);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("more than once"));
    expect(wrapper.querySelectorAll("form")).toHaveLength(1);
  });
});
