import { describe, expect, it } from 'vitest';
import { manifests as bundle } from '../../bundle.manifests.js';
import { manifests } from './manifests.js';

interface Manifest {
	type: string;
	kind?: string;
	alias: string;
	meta?: Record<string, unknown>;
	conditions?: unknown;
	api?: () => Promise<{ api: { name: string } }>;
	element?: () => Promise<{ element?: { name: string }; default?: { name: string } }>;
}

describe('Formulate layout workspace manifests', () => {
	it('give layouts a workspace with the Design view, and Save', async () => {
		const inWorkspace = [{ alias: 'Umb.Condition.WorkspaceAlias', match: 'Formulate.Workspace.Layout' }];
		const described = await Promise.all(
			(manifests as Array<Manifest>).map(async ({ type, kind, alias, meta, conditions, api, element }) => {
				const loaded = await element?.();
				return { type, kind, alias, meta, conditions, api: (await api?.())?.api.name, element: (loaded?.element ?? loaded?.default)?.name };
			}),
		);

		expect(described).toStrictEqual([
			{
				type: 'workspace',
				kind: 'routable',
				alias: 'Formulate.Workspace.Layout',
				meta: { entityType: 'formulate-layout' },
				conditions: undefined,
				api: 'FormulateLayoutWorkspaceContext',
				element: undefined,
			},
			{
				type: 'workspaceView',
				kind: undefined,
				alias: 'Formulate.WorkspaceView.Layout.Design',
				meta: { label: '#general_design', pathname: 'design', icon: 'icon-layout' },
				conditions: inWorkspace,
				api: undefined,
				element: 'FormulateLayoutWorkspaceViewDesignElement',
			},
			{
				type: 'workspaceAction',
				kind: 'default',
				alias: 'Formulate.WorkspaceAction.Layout.Save',
				meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
				conditions: inWorkspace,
				api: 'FormulateKindItemSaveWorkspaceAction',
				element: undefined,
			},
		]);
	});

	it("are in Formulate's bundle", () => {
		const aliases = new Set(bundle.map((manifest) => manifest.alias));

		expect(manifests.every((manifest) => aliases.has(manifest.alias))).toBe(true);
	});
});
