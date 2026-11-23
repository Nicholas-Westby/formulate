import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UMB_ENTITY_CONTEXT, type UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { observeMultiple, UmbArrayState } from '@umbraco-cms/backoffice/observable-api';
import { UmbTreeActionBase, type UmbTreeCreateOption } from '@umbraco-cms/backoffice/tree';
import type { CreateOptionModel } from '../../api/index.js';
import { getFormulateTree } from '../../tree/trees.js';
import type { FormulateTreeDefinition } from '../../tree/types.js';
import { describeCreateOption, isFolderOption, requestCreateOptions } from './create-options.js';
import { getCreatePath } from './create-path.js';
import { runCreateOption } from './run-create-option.js';

/**
 * The Create button above the list on a tree's root page and on its folders' pages, as Umbraco's own trees have one
 * (the tree action of kind create, whose button shows these options). The options are what the API says can be
 * created where the list starts, as in the tree's create dialog: the kinds, then the folder. A kind's option links
 * to its workspace on the create route; the folder's opens Umbraco's folder dialog.
 */
export class FormulateTreeCreateActionApi extends UmbTreeActionBase {
	#options = new UmbArrayState<UmbTreeCreateOption>([], (option) => option.alias);

	/** The options the button shows. */
	readonly options = this.#options.asObservable();

	/** Whether the button shows its options in a menu, rather than running the only one. */
	readonly multipleOptions = this.#options.asObservablePart((options) => options.length > 1);

	/** The API's options, by the aliases the button knows them by. */
	#createOptions = new Map<string, CreateOptionModel>();

	#parent?: UmbEntityModel;
	#tree?: FormulateTreeDefinition;

	/** How many reads were started, so that only the latest one's answer is shown. */
	#reads = 0;

	constructor(host: UmbControllerHost) {
		super(host);

		// The tree in the page says where its list starts: the tree's root, or a folder.
		this.consumeContext(UMB_ENTITY_CONTEXT, (context) => {
			this.observe(
				context ? observeMultiple([context.entityType, context.unique]) : undefined,
				(parent) => void this.#read(parent?.[0], parent?.[1]),
				'_formulateObserveParent',
			);
		});
	}

	async #read(entityType: string | undefined, unique: string | null | undefined) {
		const read = ++this.#reads;
		const tree = entityType ? getFormulateTree(entityType) : undefined;
		this.#createOptions.clear();
		this.#options.setValue([]);

		if (!entityType || unique === undefined || !tree) {
			return;
		}

		const parent = { entityType, unique };
		const options = await requestCreateOptions(this, tree, parent);

		if (read !== this.#reads || !options) {
			return;
		}

		this.#parent = parent;
		this.#tree = tree;
		this.#options.setValue(
			options.map((option, index) => {
				const alias = `Formulate.TreeCreateOption.${index}`;
				this.#createOptions.set(alias, option);
				const { name, icon } = describeCreateOption(option, tree);

				return {
					alias,
					label: name,
					icon,
					// A kind opens its workspace, and the folder the folder dialog: both ask for more, as core's options do.
					additionalOptions: true,
					href: isFolderOption(option, tree) || !option.kindId ? undefined : getCreatePath(option, parent),
				};
			}),
		);
	}

	/**
	 * Runs an option the button shows: what a click does on an option without a link, such as the folder.
	 * @param alias The option's alias.
	 */
	async executeByAlias(alias: string) {
		const option = this.#createOptions.get(alias);

		if (option && this.#tree && this.#parent) {
			await runCreateOption(this, option, this.#tree, this.#parent);
		}
	}

	/** The button runs its options by their aliases instead. */
	override async execute() {}
}

export { FormulateTreeCreateActionApi as api };
