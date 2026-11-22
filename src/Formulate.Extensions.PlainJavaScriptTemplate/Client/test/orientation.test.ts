import { afterEach, describe, expect, it } from "vitest";
import { renderForm } from "../src/steps/render-forms";
import { addPlaceholder, classSet, fieldData, loadFixture, resetPage } from "./helpers";

afterEach(resetPage);

/** Renders the fixture's two lists with the orientation (undefined removes the setting) and returns their fieldsets. */
function renderLists(orientation: string | null | undefined) {
  const form = loadFixture("all-field-types");
  for (const alias of ["size", "delivery"]) {
    const configuration = fieldData(form, alias).configuration;
    if (orientation === undefined) {
      delete configuration.orientation;
    } else {
      configuration.orientation = orientation;
    }
  }
  const wrapper = addPlaceholder(form);
  renderForm(form);
  return {
    radio: wrapper.querySelector(".formulate__field--radio-list"),
    extended: wrapper.querySelector(".formulate__field--extended-radio-list"),
  };
}

const modifiers = ["horizontal", "vertical"];

describe("radio button list orientation", () => {
  it.each([
    ["Horizontal", "horizontal"],
    ["Vertical", "vertical"],
    ["horizontal", "horizontal"],
    ["HORIZONTAL", "horizontal"],
    ["vertical", "vertical"],
    [" Horizontal ", "horizontal"],
  ])("gives both lists the %s class", (orientation, expected) => {
    const { radio, extended } = renderLists(orientation);

    expect(radio?.tagName).toBe("FIELDSET");
    const radioClasses = classSet(radio);
    const extendedClasses = classSet(extended);
    expect(radioClasses.has(`formulate__field--radio-list--${expected}`)).toBe(true);
    expect(extendedClasses.has(`formulate__field--extended-radio-list--${expected}`)).toBe(true);
    for (const other of modifiers.filter((x) => x !== expected)) {
      expect(radioClasses.has(`formulate__field--radio-list--${other}`)).toBe(false);
      expect(extendedClasses.has(`formulate__field--extended-radio-list--${other}`)).toBe(false);
    }
    // The classes the lists always had are still there.
    expect(radioClasses.has("formulate__field")).toBe(true);
    expect(radioClasses.has("formulate__field--radio-list")).toBe(true);
  });

  it.each([
    ["a missing setting", undefined],
    ["a null setting", null],
    ["an empty setting", ""],
    ["a blank setting", "  "],
    ["an unknown value", "Diagonal"],
  ])("gives neither class for %s, so the list is laid out as before", (_name, orientation) => {
    const { radio, extended } = renderLists(orientation);

    for (const element of [radio, extended]) {
      expect([...classSet(element)].filter((x) => /--(horizontal|vertical)$/.test(x))).toEqual([]);
    }
    expect(classSet(radio).has("formulate__field--radio-list")).toBe(true);
    expect(classSet(extended).has("formulate__field--extended-radio-list")).toBe(true);
  });
});
