import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbId } from '@umbraco-cms/backoffice/id';
import type { UmbDataSourceResponse, UmbDetailDataSource } from '@umbraco-cms/backoffice/repository';
import { tryExecute } from '@umbraco-cms/backoffice/resources';

/** A Formulate entity as a workspace edits it. */
export interface FormulateDetailModel {
	entityType: string;
	unique: string;
}

/** The API calls behind one kind of entity, and how its answers become models. */
export interface FormulateDetailRequests<Model extends FormulateDetailModel, Response> {
	/** The entity type of the models. */
	entityType: Model['entityType'];

	/** The content of a new model, before the preset of the create route is applied. */
	scaffold: () => Omit<Model, 'entityType' | 'unique'>;

	read: (id: string) => Promise<{ data: Response }>;

	/** Creates the entity; the parent is the folder or form it goes in, or null at the top of its tree. */
	create: (model: Model, parentUnique: string | null) => Promise<unknown>;

	/** Saves the entity and answers with what the API stored. */
	update: (model: Model) => Promise<{ data: Response }>;

	delete: (id: string) => Promise<unknown>;

	toModel: (response: Response) => Model;
}

/**
 * Reads, creates, saves and deletes one kind of Formulate entity through the Management API. Problems
 * the API reports are given back as the error. tryExecute shows them to the user, except 401, 403 and 404:
 * a 404 (the entity was deleted elsewhere) shows nothing, so a caller that can get one must say so itself.
 */
export class FormulateDetailServerDataSource<Model extends FormulateDetailModel, Response>
	implements UmbDetailDataSource<Model>
{
	#host: UmbControllerHost;
	#requests: FormulateDetailRequests<Model, Response>;

	constructor(host: UmbControllerHost, requests: FormulateDetailRequests<Model, Response>) {
		this.#host = host;
		this.#requests = requests;
	}

	async createScaffold(preset: Partial<Model> = {}): Promise<UmbDataSourceResponse<Model>> {
		return {
			data: {
				...this.#requests.scaffold(),
				entityType: this.#requests.entityType,
				unique: UmbId.new(),
				...preset,
			} as Model,
		};
	}

	async read(unique: string): Promise<UmbDataSourceResponse<Model>> {
		const { data, error } = await tryExecute(this.#host, this.#requests.read(unique));

		return data ? { data: this.#requests.toModel(data) } : { error };
	}

	async create(model: Model, parentUnique: string | null): Promise<UmbDataSourceResponse<Model>> {
		const { error } = await tryExecute(this.#host, this.#requests.create(model, parentUnique));

		return error ? { error } : this.read(model.unique);
	}

	async update(model: Model): Promise<UmbDataSourceResponse<Model>> {
		const { data, error } = await tryExecute(this.#host, this.#requests.update(model));

		return data ? { data: this.#requests.toModel(data) } : { error };
	}

	async delete(unique: string): Promise<UmbDataSourceResponse<unknown>> {
		const { error } = await tryExecute(this.#host, this.#requests.delete(unique));

		return { error };
	}
}

/**
 * The configuration of a new item, for its create request: left out when there is none (or it is null),
 * so the API gives the item its kind's default configuration.
 */
export function newConfiguration(configuration: unknown): { configuration?: unknown } {
	return configuration === null || configuration === undefined ? {} : { configuration };
}
