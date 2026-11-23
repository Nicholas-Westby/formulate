import type { FormFieldDefinitionModel } from '../../../api/index.js';
import type { FormulatePickableField } from '../../../core/pickers/form-field-kinds.js';

/**
 * Whether the Send Email handler can write a line for a field picked in its Fields to include, as the server
 * decides it (SendEmailContentBuilder.Build): a server side only field, such as a Text Constant, adds its text;
 * any other field only what the visitor posted, and the server takes no posted value for a field whose kind is
 * hidden or transitory, such as a Header or a Button, or not installed (AttemptSubmitForm.GetInputFieldIds). The
 * value of a kind that stores nothing, such as reCAPTCHA, is left out. An upload adds a line about its files.
 * @param _field The field.
 * @param definition The definition of its kind; undefined when the kind is not installed.
 */
export function givesEmailLine(_field: FormulatePickableField, definition: FormFieldDefinitionModel | undefined): boolean {
	if (!definition) {
		return false;
	}

	if (definition.isServerSideOnly) {
		return true;
	}

	return !definition.isHidden && !definition.isTransitory && definition.isStored;
}
