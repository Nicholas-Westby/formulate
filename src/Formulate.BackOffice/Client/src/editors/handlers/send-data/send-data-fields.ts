import type { FormFieldDefinitionModel } from '../../../api/index.js';
import { FORMULATE_KIND_IDS } from '../../../core/field-kind-ids.js';
import { isSameKind } from '../../../core/kind-id.js';
import type { FormulatePickableField } from '../../../core/pickers/form-field-kinds.js';

/**
 * Whether the Send Data handler sends a value for a field that a mapping names, as the server decides it: a
 * Text Constant sends its text (SendDataPayloadBuilder.GetData); any other field only what the visitor posted,
 * and the server takes no posted value for a field whose kind is server side only, hidden or transitory, or
 * not installed (AttemptSubmitForm.GetInputFieldIds); and files are never sent.
 * @param field The field.
 * @param definition The definition of its kind; undefined when the kind is not installed.
 */
export function sendsValue(field: FormulatePickableField, definition: FormFieldDefinitionModel | undefined): boolean {
	if (isSameKind(field.kindId, FORMULATE_KIND_IDS.textConstant)) {
		return true;
	}

	if (!definition || definition.isServerSideOnly || definition.isHidden || definition.isTransitory) {
		return false;
	}

	return !isSameKind(field.kindId, FORMULATE_KIND_IDS.upload);
}

/**
 * Whether "Add all fields" adds a field: it sends a value, and the value is one a submission keeps. A
 * reCAPTCHA's is not: its response token means nothing to the receiver, so it is sent only when a mapping
 * names the field on purpose.
 * @param field The field.
 * @param definition The definition of its kind; undefined when the kind is not installed.
 */
export function isAddedByAddAll(field: FormulatePickableField, definition: FormFieldDefinitionModel | undefined): boolean {
	return sendsValue(field, definition) && definition?.isStored !== false;
}
