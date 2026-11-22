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
// The menu's items, one per tree.
export const FORMULATE_FORMS_MENU_ITEM_ALIAS = 'Formulate.MenuItem.Forms';
export const FORMULATE_DATA_VALUES_MENU_ITEM_ALIAS = 'Formulate.MenuItem.DataValues';
export const FORMULATE_VALIDATIONS_MENU_ITEM_ALIAS = 'Formulate.MenuItem.Validations';

// Trees and their repositories.
export const FORMULATE_FORMS_TREE_ALIAS = 'Formulate.Tree.Forms';
export const FORMULATE_DATA_VALUES_TREE_ALIAS = 'Formulate.Tree.DataValues';
export const FORMULATE_VALIDATIONS_TREE_ALIAS = 'Formulate.Tree.Validations';
export const FORMULATE_FORMS_TREE_REPOSITORY_ALIAS = 'Formulate.Repository.Tree.Forms';
export const FORMULATE_DATA_VALUES_TREE_REPOSITORY_ALIAS = 'Formulate.Repository.Tree.DataValues';
export const FORMULATE_VALIDATIONS_TREE_REPOSITORY_ALIAS = 'Formulate.Repository.Tree.Validations';

// Folders: one repository per tree, sharing one store.
export const FORMULATE_FORMS_FOLDER_REPOSITORY_ALIAS = 'Formulate.Repository.Folder.Forms';
export const FORMULATE_DATA_VALUES_FOLDER_REPOSITORY_ALIAS = 'Formulate.Repository.Folder.DataValues';
export const FORMULATE_VALIDATIONS_FOLDER_REPOSITORY_ALIAS = 'Formulate.Repository.Folder.Validations';
export const FORMULATE_FOLDER_STORE_ALIAS = 'Formulate.Store.Folder';
// Picking a tree's root opens the root's workspace, which lists what is at the top of the tree.
export const FORMULATE_FORMS_ROOT_WORKSPACE_ALIAS = 'Formulate.Workspace.FormsRoot';
export const FORMULATE_DATA_VALUES_ROOT_WORKSPACE_ALIAS = 'Formulate.Workspace.DataValuesRoot';
export const FORMULATE_VALIDATIONS_ROOT_WORKSPACE_ALIAS = 'Formulate.Workspace.ValidationsRoot';
// Picking a folder in a tree opens it in its tree's folder workspace, where it can be renamed.
export const FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS = 'Formulate.Workspace.Folder.Forms';
export const FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS = 'Formulate.Workspace.Folder.DataValues';
export const FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS = 'Formulate.Workspace.Folder.Validations';
// Picking a validation or data values item opens it in its workspace, which edits it with its kind's editor.
export const FORMULATE_VALIDATION_WORKSPACE_ALIAS = 'Formulate.Workspace.Validation';
export const FORMULATE_DATA_VALUES_WORKSPACE_ALIAS = 'Formulate.Workspace.DataValues';
// Picking a form opens it in its workspace: the form designer, where its fields and handlers are edited.
export const FORMULATE_FORM_WORKSPACE_ALIAS = 'Formulate.Workspace.Form';
// Picking a layout opens it in its workspace, where its template is chosen and its kind's editor lays out the
// fields of its form.
export const FORMULATE_LAYOUT_WORKSPACE_ALIAS = 'Formulate.Workspace.Layout';

// The workspaces of each tree's items. Each one shows the tree's breadcrumb in its footer, and opening one
// expands the tree down to its item. A new workspace for a tree's items goes on that tree's list.
export const FORMULATE_FORMS_TREE_WORKSPACE_ALIASES: ReadonlyArray<string> = [
	FORMULATE_FORMS_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_FORM_WORKSPACE_ALIAS,
	FORMULATE_LAYOUT_WORKSPACE_ALIAS,
];
export const FORMULATE_DATA_VALUES_TREE_WORKSPACE_ALIASES: ReadonlyArray<string> = [
	FORMULATE_DATA_VALUES_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_DATA_VALUES_WORKSPACE_ALIAS,
];
export const FORMULATE_VALIDATIONS_TREE_WORKSPACE_ALIASES: ReadonlyArray<string> = [
	FORMULATE_VALIDATIONS_FOLDER_WORKSPACE_ALIAS,
	FORMULATE_VALIDATION_WORKSPACE_ALIAS,
];

// Items of every entity type, as pickers and entity actions show them.
export const FORMULATE_ITEM_REPOSITORY_ALIAS = 'Formulate.Repository.Item';
export const FORMULATE_ITEM_STORE_ALIAS = 'Formulate.Store.Item';

// Details (whole entities, as workspaces edit them).
export const FORMULATE_FORM_DETAIL_REPOSITORY_ALIAS = 'Formulate.Repository.Detail.Form';
export const FORMULATE_LAYOUT_DETAIL_REPOSITORY_ALIAS = 'Formulate.Repository.Detail.Layout';
export const FORMULATE_VALIDATION_DETAIL_REPOSITORY_ALIAS = 'Formulate.Repository.Detail.Validation';
export const FORMULATE_DATA_VALUES_DETAIL_REPOSITORY_ALIAS = 'Formulate.Repository.Detail.DataValues';
export const FORMULATE_FORM_DETAIL_STORE_ALIAS = 'Formulate.Store.Detail.Form';
export const FORMULATE_LAYOUT_DETAIL_STORE_ALIAS = 'Formulate.Store.Detail.Layout';
export const FORMULATE_VALIDATION_DETAIL_STORE_ALIAS = 'Formulate.Store.Detail.Validation';
export const FORMULATE_DATA_VALUES_DETAIL_STORE_ALIAS = 'Formulate.Store.Detail.DataValues';

// Moving items to another folder of their tree. Layouts have none: a layout's parent is its form.
export const FORMULATE_FORM_MOVE_REPOSITORY_ALIAS = 'Formulate.Repository.Move.Form';
export const FORMULATE_FOLDER_MOVE_REPOSITORY_ALIAS = 'Formulate.Repository.Move.Folder';
export const FORMULATE_VALIDATION_MOVE_REPOSITORY_ALIAS = 'Formulate.Repository.Move.Validation';
export const FORMULATE_DATA_VALUES_MOVE_REPOSITORY_ALIAS = 'Formulate.Repository.Move.DataValues';

// Copying forms. The copy goes next to the original.
export const FORMULATE_FORM_DUPLICATE_REPOSITORY_ALIAS = 'Formulate.Repository.Duplicate.Form';
