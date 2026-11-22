import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { umbOpenModal } from '@umbraco-cms/backoffice/modal';
import type { FormFieldDefinitionModel } from '../../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../definitions.context-token.js';
import { isSameGuid } from '../guid.js';
import { FormulateIconNames } from '../icon-names.js';
import { isSameKind } from '../kind-id.js';
import { FORMULATE_PICK_FIELDS_MODAL, type FormulatePickFieldsModalData, type FormulatePickFieldsOption } from './pick-fields-modal.token.js';

/** A field of the form being edited, as the pickers read it: the designer's field, or the API's. */
export interface FormulatePickableField {
	id: string;
	kindId: string;
	name?: string | null;
	alias?: string | null;
}

/** The icon of a field whose kind's icon the back office has not got, as the form designer shows it. */
const FIELD_ICON = 'icon-autofill';

/** The icon of a field whose kind is not installed, or that is no longer on the form. */
const PROBLEM_ICON = 'icon-alert';

/**
 * The form field it was picked by: the field with the same ID, in any of the forms GUIDs come in.
 * @param fields The form's fields.
 * @param id A picked field's ID, as it is stored.
 * @returns The field, or undefined when it is no longer on the form.
 */
export function findField<Field extends FormulatePickableField>(fields: ReadonlyArray<Field>, id: string): Field | undefined {
	return fields.find((field) => isSameGuid(field.id, id));
}

/**
 * Lets the user pick fields of the form in the dialog that picks fields.
 * @param host The element that opens the dialog.
 * @param data What the dialog shows.
 * @param selection The IDs of the fields picked now, as the form has them.
 * @returns The dialog's whole selection, or undefined when it was closed without one.
 */
export async function pickFormFields(
	host: UmbControllerHost,
	data: FormulatePickFieldsModalData,
	selection: Array<string>,
): Promise<Array<string> | undefined> {
	const picked = await umbOpenModal(host, FORMULATE_PICK_FIELDS_MODAL, { data, value: { selection } }).catch(() => undefined);

	return picked?.selection;
}

/**
 * Knows the kinds of the form's fields, for the pickers of fields: each field's kind (its definition) and
 * icon. It asks its host to show itself again once the kinds or the back office's icons are known.
 */
export class FormulateFormFieldKinds extends UmbControllerBase {
	#host: UmbLitElement;
	#icons: FormulateIconNames;
	#kinds?: ReadonlyArray<FormFieldDefinitionModel>;

	constructor(host: UmbLitElement) {
		super(host);
		this.#host = host;
		this.#icons = new FormulateIconNames(host);

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, (definitions) => {
			this.observe(
				definitions?.formFieldDefinitions,
				(kinds) => {
					this.#kinds = kinds?.length ? kinds : undefined;
					host.requestUpdate();
				},
				'_formulateObserveFieldKinds',
			);
		});
	}

	/** Whether the kinds are known yet. */
	get known(): boolean {
		return this.#kinds !== undefined;
	}

	/** The name of a field, as the form designer shows it: "Unnamed" for a field that has none. */
	nameOf(field: FormulatePickableField): string {
		return field.name || this.#host.localize.term('formulate_unnamed');
	}

	/** The form's fields as the dialog that picks fields shows them. */
	pickOptions(fields: ReadonlyArray<FormulatePickableField>): Array<FormulatePickFieldsOption> {
		return fields.map((field) => ({ id: field.id, name: this.nameOf(field), alias: field.alias ?? '', icon: this.iconOf(field) }));
	}

	/**
	 * The definition of a field's kind.
	 * @returns The definition; undefined when the kind is not installed, or the kinds are not known yet.
	 */
	of(field: FormulatePickableField): FormFieldDefinitionModel | undefined {
		return this.#kinds?.find((kind) => isSameKind(kind.kindId, field.kindId));
	}

	/**
	 * The icon of a field: its kind's, or the fields' own when the back office has no icon of that name, and an
	 * alert for a field whose kind is not installed or that is gone (undefined). None until the kinds and the
	 * back office's icons are known.
	 */
	iconOf(field: FormulatePickableField | undefined): string | undefined {
		if (!this.#kinds) {
			return undefined;
		}

		const kind = field && this.of(field);

		return kind ? this.#icons.choose(kind.icon, FIELD_ICON) : this.#icons.choose(PROBLEM_ICON, PROBLEM_ICON);
	}
}
