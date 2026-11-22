import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbId } from '@umbraco-cms/backoffice/id';
import type { UmbDataSourceResponse, UmbDetailDataSource } from '@umbraco-cms/backoffice/repository';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import type { UmbFolderModel } from '@umbraco-cms/backoffice/tree';
import {
	deleteFormulateFolderById,
	getFormulateFolderById,
	postFormulateFolder,
	putFormulateFolderById,
	type FolderResponseModel,
} from '../api/index.js';
import { isNotFoundError, reportItemGone } from '../core/item-gone.js';
import { FORMULATE_DATA_VALUES_TREE, FORMULATE_FORMS_TREE, FORMULATE_VALIDATIONS_TREE } from '../tree/trees.js';
import type { FormulateTreeDefinition } from '../tree/types.js';

/**
 * Reads, creates, renames and deletes the folders of one Formulate tree through the Management API.
 * Deleting a folder deletes everything in it. A 404 when reading, renaming or deleting means the folder
 * was deleted elsewhere: this says so and drops it from the tree, as Umbraco would show nothing.
 */
export class FormulateFolderServerDataSource implements UmbDetailDataSource<UmbFolderModel> {
	#host: UmbControllerHost;
	#tree: FormulateTreeDefinition;

	constructor(host: UmbControllerHost, tree: FormulateTreeDefinition) {
		this.#host = host;
		this.#tree = tree;
	}

	async createScaffold(preset: Partial<UmbFolderModel> = {}): Promise<UmbDataSourceResponse<UmbFolderModel>> {
		return { data: { entityType: this.#tree.folderEntityType, unique: UmbId.new(), name: '', ...preset } };
	}

	async read(unique: string): Promise<UmbDataSourceResponse<UmbFolderModel>> {
		const { data, error } = await tryExecute(this.#host, getFormulateFolderById({ path: { id: unique } }));

		if (data) {
			return { data: this.#toModel(data) };
		}

		await this.#reportIfGone(error, unique);
		return { error };
	}

	async create(model: UmbFolderModel, parentUnique: string | null): Promise<UmbDataSourceResponse<UmbFolderModel>> {
		if (!model.unique) throw new Error('The folder has no unique.');

		// The top of a tree is not an item, so a folder there is sent without a parent ID.
		const { error } = await tryExecute(
			this.#host,
			postFormulateFolder({
				body: {
					id: model.unique,
					...(parentUnique ? { parentId: parentUnique } : {}),
					treeAlias: this.#tree.apiAlias,
					name: model.name,
				},
			}),
		);

		return error ? { error } : this.read(model.unique);
	}

	async update(model: UmbFolderModel): Promise<UmbDataSourceResponse<UmbFolderModel>> {
		if (!model.unique) throw new Error('The folder has no unique.');

		const { data, error } = await tryExecute(
			this.#host,
			putFormulateFolderById({ path: { id: model.unique }, body: { name: model.name } }),
		);

		if (data) {
			return { data: this.#toModel(data) };
		}

		await this.#reportIfGone(error, model.unique);
		return { error };
	}

	async delete(unique: string): Promise<UmbDataSourceResponse<unknown>> {
		const { error } = await tryExecute(this.#host, deleteFormulateFolderById({ path: { id: unique } }));

		await this.#reportIfGone(error, unique);
		return { error };
	}

	/**
	 * Says that a folder deleted elsewhere is gone, as Umbraco shows nothing for a 404, and announces it as
	 * deleted, so its workspace leaves.
	 */
	async #reportIfGone(error: unknown, unique: string) {
		if (isNotFoundError(error)) {
			await reportItemGone(this.#host, { entityType: this.#tree.folderEntityType, unique }, { deleted: true });
		}
	}

	#toModel(folder: FolderResponseModel): UmbFolderModel {
		return { entityType: this.#tree.folderEntityType, unique: folder.id, name: folder.name };
	}
}

export class FormulateFormsFolderServerDataSource extends FormulateFolderServerDataSource {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_FORMS_TREE);
	}
}

export class FormulateDataValuesFolderServerDataSource extends FormulateFolderServerDataSource {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_DATA_VALUES_TREE);
	}
}

export class FormulateValidationsFolderServerDataSource extends FormulateFolderServerDataSource {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_VALIDATIONS_TREE);
	}
}
