// The renderer of the sample Phone field (src/Website/SampleFields): a text field with the input type "tel".
// It imports Formulate's API by its public URL, the same URL the renderer itself uses, so the page loads each
// module once. docs/extending.md and formulate.rocks show this same code.
import { RenderText, registerFieldRenderer } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";

class RenderPhone extends RenderText {
  static inputType = "tel";
}

registerFieldRenderer("phone", RenderPhone);
