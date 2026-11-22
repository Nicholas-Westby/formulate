import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbDuplicateRepository, UmbDuplicateRequestArgs } from '@umbraco-cms/backoffice/entity-action';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { UmbRepositoryBase, type UmbRepositoryErrorResponse } from '@umbraco-cms/backoffice/repository';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { postFormulateFormByIdDuplicate } from '../../api/index.js';

/**
 * Copies forms (Formulate.Repository.Duplicate.Form). The API names the copy "{name} (copy)", gives its
 * fields and handlers new IDs, and puts it next to the original. Umbraco's duplicate action then reloads
 * the original's parent, which shows the copy.
 */
export class FormulateFormDuplicateRepository extends UmbRepositoryBase implements UmbDuplicateRepository {
	#localize = new UmbLocalizationController(this);

	constructor(host: UmbControllerHost) {
		super(host);
	}

	async requestDuplicate(args: UmbDuplicateRequestArgs): Promise<UmbRepositoryErrorResponse> {
		// Without a parent ID, the copy goes where the original is.
		const { error } = await tryExecute(this, postFormulateFormByIdDuplicate({ path: { id: args.unique }, body: {} }));

		if (!error) {
			const notifications = await this.getContext(UMB_NOTIFICATION_CONTEXT);
			notifications?.peek('positive', { data: { message: this.#localize.term('formulate_duplicated') } });
		}

		return { error };
	}
}

export { FormulateFormDuplicateRepository as api };
