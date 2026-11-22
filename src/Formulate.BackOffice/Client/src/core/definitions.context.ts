import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { defer, type Observable } from '@umbraco-cms/backoffice/external/rxjs';
import { UmbBasicState } from '@umbraco-cms/backoffice/observable-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import {
	getFormulateConfig,
	getFormulateDefinitionDataValues,
	getFormulateDefinitionFormField,
	getFormulateDefinitionFormHandler,
	getFormulateDefinitionLayout,
	getFormulateDefinitionTemplate,
	getFormulateDefinitionValidation,
	type FormFieldDefinitionModel,
	type FormHandlerDefinitionModel,
	type FormulateConfigResponseModel,
	type KindDefinitionModel,
	type TemplateDefinitionModel,
} from '../api/index.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from './definitions.context-token.js';

export { FORMULATE_DEFINITIONS_CONTEXT };

/**
 * A value read from the server on first use and kept from then on. A read that fails is tried again on
 * the next use (the failure itself is reported to the user by tryExecute).
 */
class FormulateReadOnce<T> {
	#state: UmbBasicState<T>;
	#read: () => Promise<T | undefined>;
	#reading?: Promise<void>;

	/** The value, which is read when first observed. Emits the initial value until the read finishes. */
	readonly value: Observable<T>;

	constructor(initialValue: T, read: () => Promise<T | undefined>) {
		this.#state = new UmbBasicState(initialValue);
		this.#read = read;
		this.value = defer(() => {
			void this.get();
			return this.#state.asObservable();
		});
	}

	/** Reads the value if it has not been read yet, then returns it. */
	async get(): Promise<T> {
		this.#reading ??= this.#read().then((value) => {
			if (value === undefined) {
				this.#reading = undefined;
			} else {
				this.#state.setValue(value);
			}
		});

		await this.#reading;

		return this.#state.getValue();
	}

	destroy() {
		this.#state.destroy();
	}
}

/**
 * Gives every Formulate editor the definitions (kinds) of fields, handlers, validations, data values,
 * layouts and templates, and Formulate's configuration. Each is read from the server once, when it is
 * first used.
 */
export class FormulateDefinitionsContext extends UmbContextBase {
	#formFields = new FormulateReadOnce<Array<FormFieldDefinitionModel>>(
		[],
		async () => (await tryExecute(this, getFormulateDefinitionFormField())).data,
	);
	#formHandlers = new FormulateReadOnce<Array<FormHandlerDefinitionModel>>(
		[],
		async () => (await tryExecute(this, getFormulateDefinitionFormHandler())).data,
	);
	#validations = new FormulateReadOnce<Array<KindDefinitionModel>>(
		[],
		async () => (await tryExecute(this, getFormulateDefinitionValidation())).data,
	);
	#dataValues = new FormulateReadOnce<Array<KindDefinitionModel>>(
		[],
		async () => (await tryExecute(this, getFormulateDefinitionDataValues())).data,
	);
	#layouts = new FormulateReadOnce<Array<KindDefinitionModel>>(
		[],
		async () => (await tryExecute(this, getFormulateDefinitionLayout())).data,
	);
	#templates = new FormulateReadOnce<Array<TemplateDefinitionModel>>(
		[],
		async () => (await tryExecute(this, getFormulateDefinitionTemplate())).data,
	);
	#config = new FormulateReadOnce<FormulateConfigResponseModel | undefined>(
		undefined,
		async () => (await tryExecute(this, getFormulateConfig())).data,
	);

	/** The kinds of form field. */
	readonly formFieldDefinitions = this.#formFields.value;

	/** The kinds of form handler. */
	readonly formHandlerDefinitions = this.#formHandlers.value;

	/** The kinds of validation. */
	readonly validationDefinitions = this.#validations.value;

	/** The kinds of data values. */
	readonly dataValuesDefinitions = this.#dataValues.value;

	/** The kinds of layout. */
	readonly layoutDefinitions = this.#layouts.value;

	/** The templates a layout can be rendered with. */
	readonly templateDefinitions = this.#templates.value;

	/** Formulate's configuration (button kinds and field categories), or undefined until it has been read. */
	readonly config = this.#config.value;

	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_DEFINITIONS_CONTEXT);
	}

	getFormFieldDefinitions() {
		return this.#formFields.get();
	}

	getFormHandlerDefinitions() {
		return this.#formHandlers.get();
	}

	getValidationDefinitions() {
		return this.#validations.get();
	}

	getDataValuesDefinitions() {
		return this.#dataValues.get();
	}

	getLayoutDefinitions() {
		return this.#layouts.get();
	}

	getTemplateDefinitions() {
		return this.#templates.get();
	}

	/** Gets Formulate's configuration, or undefined if it could not be read. */
	getConfig() {
		return this.#config.get();
	}

	override destroy() {
		for (const value of [
			this.#formFields,
			this.#formHandlers,
			this.#validations,
			this.#dataValues,
			this.#layouts,
			this.#templates,
			this.#config,
		]) {
			value.destroy();
		}

		super.destroy();
	}
}

export { FormulateDefinitionsContext as api };
