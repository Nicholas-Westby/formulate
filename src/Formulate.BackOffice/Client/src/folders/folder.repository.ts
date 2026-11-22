import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbFolderModel } from '@umbraco-cms/backoffice/tree';
import {
	FormulateDataValuesFolderServerDataSource,
	FormulateFormsFolderServerDataSource,
	FormulateValidationsFolderServerDataSource,
} from './folder.server.data-source.js';
import { FORMULATE_FOLDER_STORE_CONTEXT } from './folder.store.js';

/**
 * The folders of the Forms tree. Umbraco's folder actions and dialogs (create, rename, delete) use it
 * through its alias, Formulate.Repository.Folder.Forms.
 */
export class FormulateFormsFolderRepository extends UmbDetailRepositoryBase<UmbFolderModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateFormsFolderServerDataSource, FORMULATE_FOLDER_STORE_CONTEXT);
	}
}

/** The folders of the Data Values tree (Formulate.Repository.Folder.DataValues). */
export class FormulateDataValuesFolderRepository extends UmbDetailRepositoryBase<UmbFolderModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateDataValuesFolderServerDataSource, FORMULATE_FOLDER_STORE_CONTEXT);
	}
}

/** The folders of the Validation Library tree (Formulate.Repository.Folder.Validations). */
export class FormulateValidationsFolderRepository extends UmbDetailRepositoryBase<UmbFolderModel> {
	constructor(host: UmbControllerHost) {
		super(host, FormulateValidationsFolderServerDataSource, FORMULATE_FOLDER_STORE_CONTEXT);
	}
}
