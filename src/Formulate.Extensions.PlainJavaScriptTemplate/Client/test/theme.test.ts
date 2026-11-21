// @vitest-environment node
import * as sass from "sass";
import { describe, expect, it } from "vitest";

// Compiles the theme the way a site would: a Sass file that uses its entry point.
// The url makes the relative path resolve against the Client folder.
const base = new URL("../theme-check.scss", import.meta.url);

function compile(configuration = "") {
  const warnings: string[] = [];
  const logger: sass.Logger = { warn: (message) => warnings.push(message) };
  const { css } = sass.compileString(`@use "themes/basic/app"${configuration};`, {
    url: base,
    logger,
  });
  return { css, warnings };
}

describe("the Basic theme", () => {
  const { css, warnings } = compile();

  it("compiles without any Sass warnings or deprecations", () => {
    expect(warnings).toEqual([]);
  });

  it("never lets a display rule show an element the renderer hid", () => {
    expect(css).toMatch(
      /\.formulate-wrapper \[hidden\],\s*\.formulate__form \[hidden\]\s*\{\s*display: none !important;/,
    );
  });

  it("styles the main parts of a form", () => {
    for (const selector of [
      ".formulate__form",
      ".formulate__row",
      ".formulate__cell--6-columns",
      ".formulate__field--text input[type=text]",
      ".formulate__field--button button",
      ".formulate__step--active.formulate__step--animating",
      ".formulate__inline-validation-summary__error",
    ]) {
      expect(css, selector).toContain(selector);
    }
    expect(css).toContain("calc(50% - 10px)");
  });

  it("lets a site override a variable when it compiles the theme", () => {
    const custom = compile(" with ($formulate-color--border: #48a)");
    expect(custom.warnings).toEqual([]);
    expect(custom.css).toContain("border: 2px solid #48a;");
  });
});
