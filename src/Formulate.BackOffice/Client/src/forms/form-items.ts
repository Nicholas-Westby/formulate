import { UmbId } from '@umbraco-cms/backoffice/id';
import type { FormFieldModel, FormHandlerModel } from '../api/index.js';
import type { FormulateFormFieldModel, FormulateFormHandlerModel } from './types.js';

/** The configuration part of an item: none for a missing or null configuration, never an explicit null. */
function configurationPart(configuration: unknown): { configuration?: unknown } {
	return configuration === null || configuration === undefined ? {} : { configuration };
}

/** A copy of a kind's default configuration, for a new item, which must not share it with other items. */
function defaultConfigurationPart(defaultConfiguration: unknown): { configuration?: unknown } {
	return configurationPart(
		defaultConfiguration === null || defaultConfiguration === undefined ? undefined : structuredClone(defaultConfiguration),
	);
}

/**
 * A field as the form designer holds it.
 * @param field The field, as the API gives it.
 * @returns The field with all of its parts, a missing one as none, always in the same order. The
 * configuration is kept exactly as it is, also for a kind that is not installed, so it is saved unchanged.
 */
export function toFormField(field: FormFieldModel | FormulateFormFieldModel): FormulateFormFieldModel {
	return {
		id: field.id,
		kindId: field.kindId,
		name: field.name ?? null,
		alias: field.alias ?? null,
		label: field.label ?? null,
		category: field.category ?? null,
		validations: [...(field.validations ?? [])],
		...configurationPart(field.configuration),
	};
}

/**
 * A field as the API takes it.
 * @param field The field, as the form designer holds it.
 * @returns The field, without a configuration when it has none.
 */
export function toFormFieldRequest(field: FormulateFormFieldModel): FormFieldModel {
	return toFormField(field);
}

/**
 * A handler as the form designer holds it.
 * @param handler The handler, as the API gives it.
 * @returns The handler with all of its parts, a missing one as none, always in the same order, and its
 * configuration exactly as it is.
 */
export function toFormHandler(handler: FormHandlerModel | FormulateFormHandlerModel): FormulateFormHandlerModel {
	return {
		id: handler.id,
		kindId: handler.kindId,
		name: handler.name ?? null,
		alias: handler.alias ?? null,
		enabled: handler.enabled !== false,
		...configurationPart(handler.configuration),
	};
}

/**
 * A handler as the API takes it.
 * @param handler The handler, as the form designer holds it.
 * @returns The handler, without a configuration when it has none.
 */
export function toFormHandlerRequest(handler: FormulateFormHandlerModel): FormHandlerModel {
	return toFormHandler(handler);
}

/** What a new item needs of its kind's definition. */
interface KindDefaults {
	kindId: string;
	defaultConfiguration?: unknown;
}

/**
 * A new field of a kind, as "Add field" starts it.
 * @param definition The kind's definition.
 * @returns The field, with a new ID and its own copy of the kind's default configuration (none when the
 * kind has none: the API refuses a configuration its kind cannot read, such as an explicit null).
 */
export function newFormField(definition: KindDefaults): FormulateFormFieldModel {
	return {
		id: UmbId.new(),
		kindId: definition.kindId,
		name: null,
		alias: null,
		label: null,
		category: null,
		validations: [],
		...defaultConfigurationPart(definition.defaultConfiguration),
	};
}

/**
 * A new handler of a kind, as "Add handler" starts it: enabled, as a handler is added to be run.
 * @param definition The kind's definition.
 * @returns The handler, with a new ID and its own copy of the kind's default configuration.
 */
export function newFormHandler(definition: KindDefaults): FormulateFormHandlerModel {
	return {
		id: UmbId.new(),
		kindId: definition.kindId,
		name: null,
		alias: null,
		enabled: true,
		...defaultConfigurationPart(definition.defaultConfiguration),
	};
}
