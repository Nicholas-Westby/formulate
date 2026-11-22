// Names shared by every part of the Formulate back office client. The entity types and tree API
// aliases match the server (src/Formulate.BackOffice/Api/EntityTypes.cs and TreeAliases.cs).

// Entity types.
export const FORMULATE_FORMS_ROOT_ENTITY_TYPE = 'formulate-forms-root';
export const FORMULATE_FORM_FOLDER_ENTITY_TYPE = 'formulate-form-folder';
export const FORMULATE_FORM_ENTITY_TYPE = 'formulate-form';
export const FORMULATE_LAYOUT_ENTITY_TYPE = 'formulate-layout';
export const FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE = 'formulate-data-values-root';
export const FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE = 'formulate-data-values-folder';
export const FORMULATE_DATA_VALUES_ENTITY_TYPE = 'formulate-data-values';
export const FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE = 'formulate-validations-root';
export const FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE = 'formulate-validation-folder';
export const FORMULATE_VALIDATION_ENTITY_TYPE = 'formulate-validation';

export type FormulateFormsRootEntityType = typeof FORMULATE_FORMS_ROOT_ENTITY_TYPE;
export type FormulateFormFolderEntityType = typeof FORMULATE_FORM_FOLDER_ENTITY_TYPE;
export type FormulateFormEntityType = typeof FORMULATE_FORM_ENTITY_TYPE;
export type FormulateLayoutEntityType = typeof FORMULATE_LAYOUT_ENTITY_TYPE;
export type FormulateDataValuesRootEntityType = typeof FORMULATE_DATA_VALUES_ROOT_ENTITY_TYPE;
export type FormulateDataValuesFolderEntityType = typeof FORMULATE_DATA_VALUES_FOLDER_ENTITY_TYPE;
export type FormulateDataValuesEntityType = typeof FORMULATE_DATA_VALUES_ENTITY_TYPE;
export type FormulateValidationsRootEntityType = typeof FORMULATE_VALIDATIONS_ROOT_ENTITY_TYPE;
export type FormulateValidationFolderEntityType = typeof FORMULATE_VALIDATION_FOLDER_ENTITY_TYPE;
export type FormulateValidationEntityType = typeof FORMULATE_VALIDATION_ENTITY_TYPE;

// The trees' names in the Management API routes, as in formulate/tree/{treeAlias}/root.
export const FORMULATE_FORMS_TREE_API_ALIAS = 'forms';
export const FORMULATE_DATA_VALUES_TREE_API_ALIAS = 'data-values';
export const FORMULATE_VALIDATIONS_TREE_API_ALIAS = 'validations';

// Section and menu.
export const FORMULATE_SECTION_ALIAS = 'Formulate.Section';
export const FORMULATE_SECTION_PATHNAME = 'formulate';
export const FORMULATE_MENU_ALIAS = 'Formulate.Menu';

// Trees and their repositories.
export const FORMULATE_FORMS_TREE_ALIAS = 'Formulate.Tree.Forms';
export const FORMULATE_DATA_VALUES_TREE_ALIAS = 'Formulate.Tree.DataValues';
export const FORMULATE_VALIDATIONS_TREE_ALIAS = 'Formulate.Tree.Validations';
export const FORMULATE_FORMS_TREE_REPOSITORY_ALIAS = 'Formulate.Repository.Tree.Forms';
export const FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS = 'Formulate.Repository.Tree.DataValues';
export const FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS = 'Formulate.Repository.Tree.Validations';
