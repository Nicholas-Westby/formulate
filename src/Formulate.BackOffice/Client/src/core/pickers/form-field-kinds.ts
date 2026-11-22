import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import type { FormFieldDefinitionModel } from '../../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../definitions.context-token.js';
import { isSameGuid } from '../guid.js';
import { FormulateIconNames } from '../icon-names.js';
import { isSameKind } from '../kind-id.js';

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
 * Knows the kinds of the form's fields, for the pickers of fields: each field's kind (its definition) and
 * icon. It asks its host to show itself again once the kinds or the back office's icons are known.
 */
export class FormulateFormFieldKinds extends UmbControllerBase {
	#icons: FormulateIconNames;
	#kinds?: ReadonlyArray<FormFieldDefinitionModel>;

	constructor(host: UmbLitElement) {
		super(host);
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
