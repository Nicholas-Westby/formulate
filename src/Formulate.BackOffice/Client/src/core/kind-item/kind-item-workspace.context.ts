import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbObjectState } from '@umbraco-cms/backoffice/observable-api';
import { UmbReadOnlyGuardManager, type UmbGuardRule } from '@umbraco-cms/backoffice/utils';
import {
	UmbEntityNamedDetailWorkspaceContextBase,
	UmbWorkspaceIsNewRedirectController,
	type UmbEntityDetailWorkspaceContextCreateArgs,
	type UmbRoutableWorkspaceContext,
	type UmbSubmittableWorkspaceContext,
} from '@umbraco-cms/backoffice/workspace';
import type { KindDefinitionModel } from '../../api/index.js';
import { FORMULATE_CREATE_ROUTE_PATH, readCreateRouteParams } from '../../entity-actions/create/create-path.js';
import { FORMULATE_DEFINITIONS_CONTEXT } from '../definitions.context-token.js';
import type { FormulateDefinitionsContext } from '../definitions.context.js';
import type { FormulateKindEditorType } from '../kind-editor.js';
import { isSameKind } from '../kind-id.js';
import { FormulateKindItemWorkspaceEditorElement } from './kind-item-workspace-editor.element.js';
import { findFieldProblem } from './problem-field.js';
import type { FormulateKindItemDetailModel } from './types.js';

/** What a workspace for one kind of item needs to know. */
export interface FormulateKindItemWorkspaceContextArgs {
	workspaceAlias: string;
	entityType: string;
	detailRepositoryAlias: string;
	/** The extension type of the editors of this kind of item's kinds. */
	editorType: FormulateKindEditorType;
	/** Reads the definitions of this kind of item's kinds. */
	getDefinitions: (definitions: FormulateDefinitionsContext) => Promise<Array<KindDefinitionModel>>;
}

// The read-only rules of the workspace: Umbraco 19's base declares them, 17 and 18 do not, so they are
// declared here instead of in the class, where 19 would need an override modifier that 17 refuses.
export interface FormulateKindItemWorkspaceContext<
	Model extends FormulateKindItemDetailModel = FormulateKindItemDetailModel,
> {
	/** Rules that make the item read-only, such as being of a legacy kind. */
	readonly readOnlyGuard: UmbReadOnlyGuardManager<UmbGuardRule>;
}

/** The read-only rule of legacy items. */
const LEGACY_RULE = 'Formulate.ReadOnly.Legacy';

/**
 * The workspace of an item with a kind and a configuration, such as a validation or data values: its name
 * and alias, and its configuration, edited by its kind's editor.
 *
 * - The create route (create/parent/{parentEntityType}/{parentUnique}/{kindId}) makes a new item of the
 *   kind, with the kind's default configuration from the definitions endpoint (left out when the kind has
 *   none), then moves to the item's edit route once it is saved.
 * - A problem the API reports for the name, alias or configuration shows on that input.
 * - Legacy items are read-only, and Save is disabled for them.
 */
export abstract class FormulateKindItemWorkspaceContext<
		Model extends FormulateKindItemDetailModel = FormulateKindItemDetailModel,
	>
	extends UmbEntityNamedDetailWorkspaceContextBase<Model>
	implements UmbRoutableWorkspaceContext, UmbSubmittableWorkspaceContext
{
	readonly IS_FORMULATE_KIND_ITEM_WORKSPACE_CONTEXT = true;

	/** Its header shows and changes its name and alias. */
	readonly IS_FORMULATE_ALIASED_WORKSPACE_CONTEXT = true as const;

	/** The extension type of the editors of this kind of item's kinds. */
	readonly editorType: FormulateKindEditorType;

	readonly alias = this._data.createObservablePartOfCurrent((data) => data?.alias);

	readonly kindId = this._data.createObservablePartOfCurrent((data) => data?.kindId);

	readonly configuration = this._data.createObservablePartOfCurrent((data) => data?.configuration);

	#definition = new UmbObjectState<KindDefinitionModel | null | undefined>(undefined);

	/** The definition of the item's kind: undefined while it is read, null when the kind is not installed. */
	readonly definition = this.#definition.asObservable();

	/** The problems the API reported for the configuration, until the configuration changes. */
	readonly configurationProblems = this.validationContext.messages.messagesOfTypeAndPath('server', '$.configuration');

	#getDefinitions: FormulateKindItemWorkspaceContextArgs['getDefinitions'];
	#definitions?: FormulateDefinitionsContext;
	#destroyed = false;

	constructor(host: UmbControllerHost, args: FormulateKindItemWorkspaceContextArgs) {
		super(host, {
			workspaceAlias: args.workspaceAlias,
			entityType: args.entityType,
			detailRepositoryAlias: args.detailRepositoryAlias,
		});

		this.editorType = args.editorType;
		this.#getDefinitions = args.getDefinitions;

		// Umbraco 19's workspaces have read-only rules of their own, which its Save reads; 17 and 18 have none.
		const workspace = this as { readOnlyGuard?: UmbReadOnlyGuardManager<UmbGuardRule> };
		workspace.readOnlyGuard ??= new UmbReadOnlyGuardManager(this);

		this.consumeContext(FORMULATE_DEFINITIONS_CONTEXT, (definitions) => {
			this.#definitions = definitions;

			if (definitions) {
				void this.#findDefinition();
			}
		});

		this.observe(this.kindId, () => void this.#findDefinition(), '_formulateObserveKindId');

		this.observe(
			this._data.createObservablePartOfCurrent((data) => data?.isLegacy === true),
			(isLegacy) => {
				if (isLegacy) {
					this.readOnlyGuard.addRule({ unique: LEGACY_RULE, permitted: true });
				} else {
					this.readOnlyGuard.removeRule(LEGACY_RULE);
				}
			},
			'_formulateObserveLegacy',
		);

		this.routes.setRoutes([
			{
				path: FORMULATE_CREATE_ROUTE_PATH,
				component: FormulateKindItemWorkspaceEditorElement,
				setup: async (_component, info) => {
					const { parent, kindId } = readCreateRouteParams(info.match.params);
					await this.create(parent, kindId);

					new UmbWorkspaceIsNewRedirectController(
						this,
						this,
						this.getHostElement().shadowRoot!.querySelector('umb-router-slot')!,
					);
				},
			},
			{
				path: 'edit/:unique',
				component: FormulateKindItemWorkspaceEditorElement,
				setup: (_component, info) => {
					void this.load(info.match.params.unique!);
				},
			},
		]);
	}

	getAlias() {
		return this._data.getCurrent()?.alias;
	}

	/**
	 * Sets the alias; an empty alias is stored as none.
	 * @param alias The alias.
	 */
	setAlias(alias: string | null | undefined) {
		this._data.updateCurrent({ alias: alias || null } as Partial<Model>);
	}

	getKindId() {
		return this._data.getCurrent()?.kindId;
	}

	getConfiguration() {
		return this._data.getCurrent()?.configuration;
	}

	/**
	 * Sets the configuration, as the kind's editor gives it. A problem the API reported for the old
	 * configuration no longer holds, so it goes.
	 * @param configuration The configuration.
	 */
	setConfiguration(configuration: unknown) {
		this._data.updateCurrent({ configuration } as Partial<Model>);
		this.validationContext.messages.removeMessagesByTypeAndPath('server', '$.configuration');
	}

	getDefinition() {
		return this.#definition.getValue();
	}

	/**
	 * Starts a new item of a kind, with the kind's default configuration.
	 * @param parent The folder the item goes in, or the tree's root (unique null).
	 * @param kindId The item's kind.
	 * @returns The new item.
	 */
	async create(parent: UmbEntityModel, kindId: string) {
		const definition = await this.#requestDefinition(kindId);
		const configuration = definition?.defaultConfiguration;
		// Never an explicit null: the API refuses a configuration its kind cannot read.
		const preset = {
			kindId,
			...(configuration === null || configuration === undefined ? {} : { configuration: structuredClone(configuration) }),
		} as UmbEntityDetailWorkspaceContextCreateArgs<Model>['preset'];

		return this.createScaffold({ parent, preset });
	}

	/** Saves nothing while the item is read-only, such as with the keyboard shortcut. */
	override async requestSubmit() {
		if (this.readOnlyGuard.getPermitted()) {
			return;
		}

		return super.requestSubmit();
	}

	override async submit() {
		try {
			await super.submit();
		} catch (error) {
			const problem = findFieldProblem(error);

			// The input clears the message once its value changes (umbBindToValidation, setConfiguration).
			if (problem) {
				this.validationContext.messages.addMessage('server', problem.path, problem.message);
			}

			throw error;
		}
	}

	override resetState() {
		super.resetState();
		this.#definition.setValue(undefined);
	}

	async #requestDefinitions(): Promise<Array<KindDefinitionModel>> {
		const definitions =
			this.#definitions ?? (await this.getContext(FORMULATE_DEFINITIONS_CONTEXT).catch(() => undefined));

		return definitions ? this.#getDefinitions(definitions) : [];
	}

	async #requestDefinition(kindId: string) {
		return (await this.#requestDefinitions()).find((definition) => isSameKind(definition.kindId, kindId));
	}

	async #findDefinition() {
		const kindId = this.getKindId();

		if (!kindId || !this.#definitions) {
			this.#definition.setValue(undefined);
			return;
		}

		const definition = await this.#requestDefinition(kindId);

		// The workspace may have closed, or opened another item, meanwhile.
		if (!this.#destroyed && this.getKindId() === kindId) {
			this.#definition.setValue(definition ?? null);
		}
	}

	override destroy() {
		this.#destroyed = true;
		super.destroy();
		this.#definition.destroy();
	}
}
