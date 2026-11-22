import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { UmbRepositoryBase, type UmbRepositoryErrorResponse } from '@umbraco-cms/backoffice/repository';
import type { UmbMoveRepository, UmbMoveToRequestArgs } from '@umbraco-cms/backoffice/tree';
import { FORMULATE_MOVE_REQUESTS, FormulateMoveServerDataSource } from './move.server.data-source.js';

/** Moves one kind of item, then tells the user, as Umbraco's own move repositories do. */
class FormulateMoveRepository extends UmbRepositoryBase implements UmbMoveRepository {
	#dataSource: FormulateMoveServerDataSource;
	#localize = new UmbLocalizationController(this);

	constructor(host: UmbControllerHost, move: (typeof FORMULATE_MOVE_REQUESTS)[keyof typeof FORMULATE_MOVE_REQUESTS]) {
		super(host);
		this.#dataSource = new FormulateMoveServerDataSource(this, move);
	}

	async requestMoveTo(args: UmbMoveToRequestArgs): Promise<UmbRepositoryErrorResponse> {
		const { error } = await this.#dataSource.moveTo(args);

		if (!error) {
			const notifications = await this.getContext(UMB_NOTIFICATION_CONTEXT);
			notifications?.peek('positive', { data: { message: this.#localize.term('formulate_moved') } });
		}

		return { error };
	}
}

/** Moves forms, with their layouts (Formulate.Repository.Move.Form). */
export class FormulateFormMoveRepository extends FormulateMoveRepository {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_MOVE_REQUESTS.form);
	}
}

/** Moves folders of any tree, with everything in them (Formulate.Repository.Move.Folder). */
export class FormulateFolderMoveRepository extends FormulateMoveRepository {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_MOVE_REQUESTS.folder);
	}
}

/** Moves validations (Formulate.Repository.Move.Validation). */
export class FormulateValidationMoveRepository extends FormulateMoveRepository {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_MOVE_REQUESTS.validation);
	}
}

/** Moves data values (Formulate.Repository.Move.DataValues). */
export class FormulateDataValuesMoveRepository extends FormulateMoveRepository {
	constructor(host: UmbControllerHost) {
		super(host, FORMULATE_MOVE_REQUESTS.dataValues);
	}
}
