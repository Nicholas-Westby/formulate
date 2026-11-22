import { describe, expect, it } from 'vitest';
import { manifests as dataValuesManifests } from '../../data-values/workspace/manifests.js';
import { manifests as validationManifests } from '../../validations/workspace/manifests.js';

interface Manifest {
	type: string;
	kind?: string;
	alias: string;
	meta?: Record<string, unknown>;
	conditions?: unknown;
	api?: () => Promise<{ api: { name: string } }>;
	element?: () => Promise<{ element?: { name: string }; default?: { name: string } }>;
}

/** The manifests of a workspace, each with what its code loads. */
async function describeManifests(manifests: Array<UmbExtensionManifest>) {
	return Promise.all(
		(manifests as Array<Manifest>).map(async ({ type, kind, alias, meta, conditions, api, element }) => {
			const loaded = await element?.();
			return {
				type,
				kind,
				alias,
				meta,
				conditions,
				api: (await api?.())?.api.name,
				element: (loaded?.element ?? loaded?.default)?.name,
			};
		}),
	);
}

const WORKSPACES = [
	{
		manifests: validationManifests,
		alias: 'Formulate.Workspace.Validation',
		name: 'Validation',
		entityType: 'formulate-validation',
		context: 'FormulateValidationWorkspaceContext',
	},
	{
		manifests: dataValuesManifests,
		alias: 'Formulate.Workspace.DataValues',
		name: 'DataValues',
		entityType: 'formulate-data-values',
		context: 'FormulateDataValuesWorkspaceContext',
	},
];

describe('Formulate validation and data values workspace manifests', () => {
	for (const workspace of WORKSPACES) {
		it(`give the ${workspace.name} workspace one Settings view and Save, as Umbraco's own workspaces do`, async () => {
			const inWorkspace = [{ alias: 'Umb.Condition.WorkspaceAlias', match: workspace.alias }];

			expect(await describeManifests(workspace.manifests)).toStrictEqual([
				{
					type: 'workspace',
					kind: 'routable',
					alias: workspace.alias,
					meta: { entityType: workspace.entityType },
					conditions: undefined,
					api: workspace.context,
					element: undefined,
				},
				{
					type: 'workspaceView',
					kind: undefined,
					alias: `Formulate.WorkspaceView.${workspace.name}.Settings`,
					meta: { label: '#general_settings', pathname: 'settings', icon: 'icon-settings' },
					conditions: inWorkspace,
					api: undefined,
					element: 'FormulateKindItemWorkspaceViewSettingsElement',
				},
				{
					type: 'workspaceAction',
					kind: 'default',
					alias: `Formulate.WorkspaceAction.${workspace.name}.Save`,
					meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
					conditions: inWorkspace,
					// Umbraco's Save, which also stays disabled while the item is read-only.
					api: 'FormulateKindItemSaveWorkspaceAction',
					element: undefined,
				},
			]);
		});
	}
});
