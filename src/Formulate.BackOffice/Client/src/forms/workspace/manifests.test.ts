import { describe, expect, it } from 'vitest';
import { manifests as bundle } from '../../bundle.manifests.js';
import { manifests as modalManifests } from '../modals/manifests.js';
import { manifests } from './manifests.js';

interface Manifest {
	type: string;
	kind?: string;
	alias: string;
	weight?: number;
	meta?: Record<string, unknown>;
	conditions?: unknown;
	api?: () => Promise<{ api: { name: string } }>;
	element?: () => Promise<{ element?: { name: string }; default?: { name: string } }>;
}

/** Each manifest, with what its code loads. */
async function describeManifests(list: Array<UmbExtensionManifest>) {
	return Promise.all(
		(list as Array<Manifest>).map(async ({ type, kind, alias, weight, meta, conditions, api, element }) => {
			const loaded = await element?.();
			return {
				type,
				kind,
				alias,
				weight,
				meta,
				conditions,
				api: (await api?.())?.api.name,
				element: (loaded?.element ?? loaded?.default)?.name,
			};
		}),
	);
}

describe('Formulate form workspace manifests', () => {
	it('give forms a workspace with Fields first, then Handlers, and Save', async () => {
		const inWorkspace = [{ alias: 'Umb.Condition.WorkspaceAlias', match: 'Formulate.Workspace.Form' }];

		expect(await describeManifests(manifests)).toStrictEqual([
			{
				type: 'workspace',
				kind: 'routable',
				alias: 'Formulate.Workspace.Form',
				weight: undefined,
				meta: { entityType: 'formulate-form' },
				conditions: undefined,
				api: 'FormulateFormWorkspaceContext',
				element: undefined,
			},
			{
				type: 'workspaceView',
				kind: undefined,
				alias: 'Formulate.WorkspaceView.Form.Fields',
				weight: 200,
				meta: { label: '#formulate_fields', pathname: 'fields', icon: 'icon-thumbnail-list' },
				conditions: inWorkspace,
				api: undefined,
				element: 'FormulateFormFieldsWorkspaceViewElement',
			},
			{
				type: 'workspaceView',
				kind: undefined,
				alias: 'Formulate.WorkspaceView.Form.Handlers',
				weight: 100,
				meta: { label: '#formulate_handlers', pathname: 'handlers', icon: 'icon-lightning' },
				conditions: inWorkspace,
				api: undefined,
				element: 'FormulateFormHandlersWorkspaceViewElement',
			},
			{
				type: 'workspaceAction',
				kind: 'default',
				alias: 'Formulate.WorkspaceAction.Form.Save',
				weight: undefined,
				meta: { label: '#buttons_save', look: 'primary', color: 'positive' },
				conditions: inWorkspace,
				api: 'FormulateKindItemSaveWorkspaceAction',
				element: undefined,
			},
		]);
	});

	it('register the dialogs of the form designer by the aliases their tokens open', async () => {
		const described = await describeManifests(modalManifests);

		expect(described.map(({ type, alias, element }) => [type, alias, element])).toStrictEqual([
			['modal', 'Formulate.Modal.PickKind', 'FormulatePickKindModalElement'],
			['modal', 'Formulate.Modal.EditField', 'FormulateEditFieldModalElement'],
			['modal', 'Formulate.Modal.EditHandler', 'FormulateEditHandlerModalElement'],
		]);
	});

	it("are in Formulate's bundle", () => {
		const aliases = new Set(bundle.map((manifest) => manifest.alias));

		expect([...manifests, ...modalManifests].every((manifest) => aliases.has(manifest.alias))).toBe(true);
	});
});
