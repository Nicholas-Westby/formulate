import { afterEach, describe, expect, it, vi } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import { addPlaceholder, classSet, controlByLabel, fieldByLabel, fieldData, loadFixture, resetPage } from "./helpers";

afterEach(resetPage);

describe("rendering", () => {
  it("renders rows, cells and fields with v3 BEM classes", () => {
    const form = loadFixture("contact");
    const wrapper = addPlaceholder(form);

    const formElement = renderForm(form);

    // The form replaces the placeholder script inside the wrapper.
    expect(formElement).toBeInstanceOf(HTMLFormElement);
    expect(formElement?.parentElement).toBe(wrapper);
    expect(document.getElementById(`formulate-form-${form.data.randomId}`)).toBeNull();
    expect(classSet(formElement)).toEqual(new Set(["formulate__form"]));

    // A form without step dividers has one active step.
    const steps = wrapper.querySelectorAll("form > section");
    expect(steps).toHaveLength(1);
    expect(classSet(steps[0])).toEqual(new Set(["formulate__step", "formulate__step--active", "formulate__step-0"]));

    const rows = steps[0].querySelectorAll(":scope > div");
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(classSet(row)).toEqual(new Set(["formulate__row", "formulate__row--step-0", "formulate__row--active"]));
    }
    expect([...rows[1].children].map(classSet)).toEqual([
      new Set(["formulate__cell", "formulate__cell--6-columns"]),
      new Set(["formulate__cell", "formulate__cell--6-columns"]),
    ]);
    expect(classSet(rows[0].children[0])).toEqual(new Set(["formulate__cell", "formulate__cell--12-columns"]));

    // Text field: the input comes before its label (the themes rely on "input + label").
    const name = fieldByLabel(wrapper, "Your Name");
    expect(classSet(name)).toEqual(
      new Set([
        "formulate__field",
        "formulate__field--text",
        "formulate__validation-type--required",
      ]),
    );
    const nameInput = controlByLabel(wrapper, "Your Name");
    expect(nameInput.type).toBe("text");
    expect(nameInput.placeholder).toBe("Your Name");
    // The label names the input (there is no aria-label).
    expect([...(nameInput.labels ?? [])].map((x) => x.textContent)).toEqual(["Your Name"]);
    expect(nameInput.hasAttribute("aria-label")).toBe(false);
    expect(nameInput.dataset.category).toBe("Contact Details");
    expect(classSet(nameInput.nextElementSibling)).toEqual(new Set(["formulate__field__label"]));
    expect(classSet(fieldByLabel(wrapper, "Email Address"))).toEqual(
      new Set([
        "formulate__field",
        "formulate__field--text",
        "formulate__validation-type--required",
        "formulate__validation-type--regex",
      ]),
    );

    // Drop down: the first option repeats the label.
    const topic = fieldByLabel(wrapper, "Topic");
    expect(classSet(topic)).toEqual(
      new Set([
        "formulate__field",
        "formulate__field--select",
        "formulate__validation-type--required",
        "formulate__field--select--initial",
      ]),
    );
    const options = [...topic.querySelectorAll("option")].map((x) => [x.value, x.textContent, classSet(x)]);
    expect(options).toEqual([
      ["", "Topic", new Set(["formulate__field__select__option", "formulate__field__select__option--initial"])],
      ["sales", "Sales", new Set(["formulate__field__select__option"])],
      ["support", "Support", new Set(["formulate__field__select__option"])],
      ["other", "Something else", new Set(["formulate__field__select__option"])],
    ]);

    // Checkbox list: a fieldset with a legend and one label (input first) per item.
    const interests = fieldByLabel(wrapper, "Interests");
    expect(interests.tagName).toBe("FIELDSET");
    expect(classSet(interests)).toEqual(
      new Set([
        "formulate__field",
        "formulate__field--checkbox-list",
        "formulate__validation-type--required",
      ]),
    );
    expect(interests.firstElementChild?.tagName).toBe("LEGEND");
    expect(classSet(interests.firstElementChild)).toEqual(
      new Set([
        "formulate__field__label",
        "formulate__field__label--group",
      ]),
    );
    const itemLabels = interests.querySelectorAll("label.formulate__field__label");
    expect([...itemLabels].map((x) => x.textContent)).toEqual(["Newsletter", "Events", "Offers"]);
    expect(itemLabels[0].firstElementChild?.outerHTML).toMatch(/^<input type="checkbox"/);
    expect(classSet(itemLabels[0].lastElementChild)).toEqual(new Set(["formulate__field__label-text"]));

    // Upload: the label wraps the input and the label text.
    const upload = fieldByLabel(wrapper, "Attach Your CV");
    expect(classSet(upload)).toEqual(
      new Set([
        "formulate__field",
        "formulate__field--upload",
        "formulate__validation-type--required",
      ]),
    );
    expect(controlByLabel(wrapper, "Attach Your CV").type).toBe("file");

    // Header, hidden field and submit button.
    const header = wrapper.querySelector("h2");
    expect(classSet(header)).toEqual(new Set(["formulate__field", "formulate__field--header"]));
    expect(header?.textContent).toBe("Get in touch");
    const hidden = wrapper.querySelector<HTMLInputElement>(".formulate__field--hidden > input");
    expect(hidden?.type).toBe("hidden");
    expect(hidden?.value).toBe("website");
    const button = wrapper.querySelector<HTMLButtonElement>(".formulate__field.formulate__field--button > button");
    expect(button?.type).toBe("submit");
    expect(button?.textContent).toBe("Send Message");
  });

  it("renders a renderer for every field type key", () => {
    const form = loadFixture("all-field-types");
    const wrapper = addPlaceholder(form);

    renderForm(form);

    const keys = [
      "text",
      "textarea",
      "hidden",
      "select",
      "checkbox",
      "checkbox-list",
      "radio-list",
      "extended-radio-list",
      "date",
      "upload",
      "button",
      "header",
      "rich-text",
      "recaptcha",
    ];
    for (const key of keys) {
      expect(wrapper.querySelectorAll(`.formulate__field--${key}`), key).toHaveLength(1);
    }

    expect(controlByLabel(wrapper, "Birthday").type).toBe("date");
    expect(controlByLabel(wrapper, "I accept the terms").type).toBe("checkbox");
    expect(controlByLabel<HTMLTextAreaElement>(wrapper, "Anything else you'd like to say?").tagName).toBe("TEXTAREA");

    // Radio buttons share a name within a list, and each list has its own name.
    const sizes = [...wrapper.querySelectorAll<HTMLInputElement>(".formulate__field--radio-list input")];
    const deliveries = [...wrapper.querySelectorAll<HTMLInputElement>(".formulate__field--extended-radio-list input")];
    expect(sizes.map((x) => x.type)).toEqual(["radio", "radio", "radio"]);
    expect(new Set(sizes.map((x) => x.name)).size).toBe(1);
    expect(new Set(deliveries.map((x) => x.name)).size).toBe(1);
    expect(sizes[0].name).not.toBe(deliveries[0].name);

    // Extended radio buttons show the label and the description.
    const express = deliveries[1].closest("label");
    expect([...(express?.querySelectorAll(".formulate__field__label-text") ?? [])].map((x) => x.textContent)).toEqual([
      "Express",
      "Arrives tomorrow",
    ]);
    expect(deliveries[1].value).toBe("express");

    const recaptcha = wrapper.querySelector<HTMLElement>(".formulate__field--recaptcha");
    expect(recaptcha?.classList).toContain("g-recaptcha");
    expect(recaptcha?.dataset.sitekey).toBe("6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI");
  });

  it("inserts labels and header text as text, and rich text as its configured HTML", () => {
    const form = loadFixture("all-field-types");
    const wrapper = addPlaceholder(form);

    const formElement = renderForm(form);

    const nickname = "Nickname </script><script>window.__formulateXss = true</script>";
    expect(fieldByLabel(wrapper, nickname)).toBeTruthy();
    expect(controlByLabel(wrapper, nickname).placeholder).toBe(nickname);
    expect(wrapper.querySelector("h2")?.textContent).toBe("Say </script> and <!-- out loud");
    expect(formElement?.querySelectorAll("script")).toHaveLength(0);

    const richText = wrapper.querySelector(".formulate__field--rich-text");
    expect(richText?.innerHTML).toBe(
      "<p>We <strong>respect</strong> your privacy &amp; never share &lt;/script&gt; tags.</p>",
    );
    expect(richText?.textContent).toBe("We respect your privacy & never share </script> tags.");
  });

  it("prefills fields from their initial values", () => {
    const form = loadFixture("all-field-types");
    const wrapper = addPlaceholder(form);

    renderForm(form);

    expect(controlByLabel(wrapper, "Nickname </script><script>window.__formulateXss = true</script>").value).toBe(
      "Sam",
    );
    const favoriteNumber = controlByLabel<HTMLSelectElement>(wrapper, "Favorite Number");
    expect(favoriteNumber.value).toBe("two");
    expect(fieldByLabel(wrapper, "Favorite Number").classList).not.toContain("formulate__field--select--initial");
    expect(controlByLabel(wrapper, "Medium").checked).toBe(true);
    expect(controlByLabel(wrapper, "Small").checked).toBe(false);
    expect(controlByLabel(wrapper, "Blue").checked).toBe(true);
    expect(controlByLabel(wrapper, "Red").checked).toBe(false);
    // The server resolves hidden values (query string first, then the configured text).
    expect(wrapper.querySelector<HTMLInputElement>(".formulate__field--hidden > input")?.value).toBe(
      "spring-newsletter",
    );
  });

  it.each([
    ["true", true],
    ["on", true],
    ["1", true],
    ["Yes", true],
    ["no", false],
    ["false", false],
    ["maybe", false],
  ])("checks a lone checkbox prefilled with %j only when the value means yes", (initialValue, checked) => {
    const form = loadFixture("all-field-types");
    fieldData(form, "acceptTerms").initialValue = initialValue;
    const wrapper = addPlaceholder(form);

    renderForm(form);

    expect(controlByLabel(wrapper, "I accept the terms").checked).toBe(checked);
  });

  it.each([
    ["agree", true],
    ["no", false],
    ["false", false],
    ["other", false],
  ])("checks the item of a one-item checkbox list prefilled with %j only when it matches", (initialValue, checked) => {
    // This is how a consent box is built in Formulate 4.
    const form = loadFixture("contact");
    const interests = fieldData(form, "interests");
    interests.configuration.items = [{ value: "agree", label: "You may contact me", selected: false }];
    interests.initialValue = initialValue;
    const wrapper = addPlaceholder(form);

    renderForm(form);

    expect(controlByLabel(wrapper, "You may contact me").checked).toBe(checked);
  });

  it("warns about a field type that has no renderer and skips the field", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const form = loadFixture("contact");
    const message = form.data.fields.find((x) => x.alias === "message");
    if (message) {
      message.fieldType = "star-rating";
    }
    const wrapper = addPlaceholder(form);

    renderForm(form);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"star-rating"'));
    expect(wrapper.querySelector(".formulate__field--star-rating")).toBeNull();
    expect(fieldByLabel(wrapper, "Your Name")).toBeTruthy();
  });

  it("renders into an explicit placeholder element", () => {
    const form = loadFixture("contact");
    const container = document.createElement("div");
    const slot = document.createElement("span");
    container.appendChild(slot);
    document.body.appendChild(container);

    const formElement = renderForm(form, slot);

    expect(formElement?.parentElement).toBe(container);
    expect(slot.isConnected).toBe(false);
  });

  it("returns null and warns when the placeholder is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(renderForm(loadFixture("contact"))).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("formulate-form-22b1ec9e4f8848d0a6a65824ec877b10"));
  });
});
