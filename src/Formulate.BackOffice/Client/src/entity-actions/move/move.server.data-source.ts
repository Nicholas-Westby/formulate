import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbDataSourceErrorResponse } from '@umbraco-cms/backoffice/repository';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import type { UmbMoveDataSource, UmbMoveToRequestArgs } from '@umbraco-cms/backoffice/tree';
import {
	putFormulateDataValuesByIdMove,
	putFormulateFolderByIdMove,
	putFormulateFormByIdMove,
	putFormulateValidationByIdMove,
} from '../../api/index.js';

/** Sends a move to the API: the item's ID and the folder to move it to, or null for the top of the tree. */
type MoveRequest = (id: string, targetId: string | null) => Promise<unknown>;

/** The kinds of items that move. Layouts do not: a layout's parent is its form. */
export const FORMULATE_MOVE_REQUESTS = {
	form: (id, targetId) => putFormulateFormByIdMove({ path: { id }, body: { targetId } }),
	folder: (id, targetId) => putFormulateFolderByIdMove({ path: { id }, body: { targetId } }),
	validation: (id, targetId) => putFormulateValidationByIdMove({ path: { id }, body: { targetId } }),
	dataValues: (id, targetId) => putFormulateDataValuesByIdMove({ path: { id }, body: { targetId } }),
} satisfies Record<string, MoveRequest>;

/** Moves one kind of item to another folder of its tree, or to the top of the tree. */
export class FormulateMoveServerDataSource implements UmbMoveDataSource {
	#host: UmbControllerHost;
	#move: MoveRequest;

	constructor(host: UmbControllerHost, move: MoveRequest) {
		this.#host = host;
		this.#move = move;
	}

	async moveTo(args: UmbMoveToRequestArgs): Promise<UmbDataSourceErrorResponse> {
		// The API refuses a move without a body, so the top of the tree is sent as an empty target.
		const { error } = await tryExecute(this.#host, this.#move(args.unique, args.destination.unique));

		return { error };
	}
}
