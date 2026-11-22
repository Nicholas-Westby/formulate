import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbDetailStoreBase } from '@umbraco-cms/backoffice/store';
import type { UmbFolderModel } from '@umbraco-cms/backoffice/tree';

/** Keeps the folders of all three trees that have been read, so workspaces and modals can observe them. */
export class FormulateFolderStore extends UmbDetailStoreBase<UmbFolderModel> {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_FOLDER_STORE_CONTEXT.toString());
	}
}

export const FORMULATE_FOLDER_STORE_CONTEXT = new UmbContextToken<FormulateFolderStore>('FormulateFolderStore');

export { FormulateFolderStore as api };
