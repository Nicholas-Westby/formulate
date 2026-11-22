import type { FieldRendererRegistration } from "../types.js";
import { RenderText } from "./plain-text.js";

/** Renders a date field: a text field with the input type "date". Its value is an ISO date (yyyy-MM-dd). */
export class RenderDate extends RenderText {
  static override inputType = "date";
}

export default { key: "date", renderer: RenderDate } satisfies FieldRendererRegistration;
