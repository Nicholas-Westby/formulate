import {
	FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
	FORMULATE_DATA_VALUES_TREE_API_ALIAS,
	FORMULATE_FORM_FOLDER_ENTITY_TYPE,
	FORMULATE_FORMS_ROOT_ENTITY_TYPE,
	FORMULATE_FORMS_TREE_API_ALIAS,
	FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
	FORMULATE_VALIDATIONS_TREE_API_ALIAS,
} from '../constants.js';
import type { FormulateTreeDefinition } from './types.js';

/** Folders, forms and the forms' layouts. */
export const FORMULATE_FORMS_TREE: FormulateTreeDefinition = {
	apiAlias: FORMULATE_FORMS_TREE_API_ALIAS,
	rootEntityType: FORMULATE_FORMS_ROOT_ENTITY_TYPE,
	folderEntityType: FORMULATE_FORM_FOLDER_ENTITY_TYPE,
	rootName: '#formulate_forms',
};

/** Folders and data values (the lists of choices fields can use). */
export const FORMULATE_DATA_VALUES_TREE: FormulateTreeDefinition = {
	apiAlias: FORMULATE_DATA_VALUES_TREE_API_ALIAS,
	rootEntityType: FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE,
	folderEntityType: FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE,
	rootName: '#formulate_dataValues',
};

/** Folders and validations (the validation library). */
export const FORMULATE_VALIDATIONS_TREE: FormulateTreeDefinition = {
	apiAlias: FORMULATE_VALIDATIONS_TREE_API_ALIAS,
	rootEntityType: FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE,
	folderEntityType: FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE,
	rootName: '#formulate_validationLibrary',
};
