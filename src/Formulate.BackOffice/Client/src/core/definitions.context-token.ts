import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { FormulateDefinitionsContext } from './definitions.context.js';

/** The global context with the definitions (kinds) of fields, handlers, validations, data values, layouts and templates. */
export const FORMULATE_DEFINITIONS_CONTEXT = new UmbContextToken<FormulateDefinitionsContext>(
	'FormulateDefinitionsContext',
);
