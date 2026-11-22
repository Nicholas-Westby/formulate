import { UMB_AUTH_CONTEXT } from '@umbraco-cms/backoffice/auth';
import type { UmbEntryPointOnInit, UmbEntryPointOnUnload } from '@umbraco-cms/backoffice/extension-api';
import { client } from '../api/client.gen.js';

/**
 * Connects the generated API client to the back office sign-in. configureClient sets the server
 * address and credentials, adds the sign-in to each request and binds the back office's own
 * response handling (such as retrying after the user signs in again). Umbraco waits for onInit,
 * so the client is ready before any Formulate element calls the API.
 */
export const onInit: UmbEntryPointOnInit = async (host) => {
	const authContext = await host.getContext(UMB_AUTH_CONTEXT);

	if (!authContext) {
		console.warn('Formulate: the back office auth context is not available, so Formulate cannot call its API.');
		return;
	}

	authContext.configureClient(client);
};

/** Nothing to undo: the client stays connected for as long as the back office runs. */
export const onUnload: UmbEntryPointOnUnload = () => undefined;
