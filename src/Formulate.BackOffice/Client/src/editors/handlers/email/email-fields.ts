import type { FormFieldDefinitionModel } from '../../../api/index.js';
import { isSameKind } from '../../../core/kind-id.js';

/** The kind of Hidden fields (HiddenFieldDefinition.Constants.KindId), which the email counts as hidden. */
const HIDDEN_KIND_ID = '3DF6FACD2FFA4055B0BE94E8FA8E7C4A';

/**
 * Whether the Send Email handler can write a line for a field picked in its Fields to include, as the server
 * decides it (SendEmailContentBuilder.Build): a server side only field, such as a Text Constant, adds its text;
 * any other field only what the visitor posted, and the server takes no posted value for a field whose kind is
 * hidden or transitory, such as a Header or a Button, or not installed (AttemptSubmitForm.GetInputFieldIds). The
 * value of a kind that stores nothing, such as reCAPTCHA, is left out. An upload adds a line about its files. A
 * Hidden field, or one of a kind whose definition is hidden, adds its line only when the handler includes hidden
 * fields.
 * @param definition The definition of the field's kind; undefined when the kind is not installed.
 * @param includeHiddenFields Whether the handler includes hidden fields, its Include hidden fields setting.
 */
export function givesEmailLine(definition: FormFieldDefinitionModel | undefined, includeHiddenFields: boolean): boolean {
	if (!definition) {
		return false;
	}

	if (!includeHiddenFields && (definition.isHidden || isSameKind(definition.kindId, HIDDEN_KIND_ID))) {
		return false;
	}

	if (definition.isServerSideOnly) {
		return true;
	}

	return !definition.isHidden && !definition.isTransitory && definition.isStored;
}
