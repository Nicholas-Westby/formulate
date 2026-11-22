/*
 * The renderer's API: what a site needs to register its own field renderers
 * and validators, built on the built-in ones. The build makes it api.js
 * (readable) and api.min.js (minified). Importing it starts nothing: the entry,
 * formulate.min.js, renders the forms, and it exports all of this as well (as
 * does window.formulatePlainJs, for scripts that are not modules).
 *
 * docs/extending.md lists these exports, and test/api.test.ts checks that the
 * list is complete.
 */

// Registering, and rendering a form.
export { registerFieldRenderer } from "./steps/get-field-renderers.js";
export { registerValidator } from "./steps/get-field-validators.js";
export { renderForm } from "./steps/render-forms.js";

// The base class of the field renderers, and the built-in renderers.
export { FieldRendererBase, getInitialValues, setData, type InitializeFieldOptions } from "./utils/field.js";
export { RenderButton } from "./fields/plain-button.js";
export { RenderCheckbox } from "./fields/plain-checkbox.js";
export { RenderCheckboxList } from "./fields/plain-checkbox-list.js";
export { RenderDate } from "./fields/plain-date.js";
export { RenderExtendedRadioList } from "./fields/plain-extended-radio-button-list.js";
export { RenderHeader } from "./fields/plain-header.js";
export { RenderHidden } from "./fields/plain-hidden.js";
export { RenderRadioList } from "./fields/plain-radio-button-list.js";
export { RenderRecaptcha } from "./fields/plain-recaptcha.js";
export { RenderRichText } from "./fields/plain-rich-text.js";
export { RenderSelect } from "./fields/plain-select.js";
export { RenderText } from "./fields/plain-text.js";
export { RenderTextarea } from "./fields/plain-textarea.js";
export { RenderUpload } from "./fields/plain-upload.js";

// The built-in validators.
export { RegexValidator } from "./validators/regex.js";
export { RequiredValidator } from "./validators/required.js";

// Helpers for field renderers.
export { addClasses } from "./utils/add-classes.js";
export { dispatchFormEvent, FormulateEvents } from "./utils/events.js";
export { generateId } from "./utils/generate-id.js";
export {
  addValidationMessages,
  checkBoolValidity,
  checkFileValidity,
  checkTextArrayValidity,
  checkTextValidity,
  checkValidityCommon,
  prepareValidators,
  resolveFieldValidity,
  showFieldValidity,
  toFieldValidity,
  type FieldValidity,
  type PreparedValidator,
} from "./utils/validation.js";

// The types of the data the server sends and of the renderer and validator contracts.
export type * from "./types.js";
