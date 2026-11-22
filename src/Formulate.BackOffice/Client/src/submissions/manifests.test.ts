import { describe, expect, it } from 'vitest';
import { manifests as bundle } from '../bundle.manifests.js';
import { manifests as workspaceManifests } from '../forms/workspace/manifests.js';
import { manifests } from './manifests.js';

interface Manifest {
	type: string;
	alias: string;
	weight?: number;
	meta?: Record<string, unknown>;
	conditions?: unknown;
	element?: () => Promise<{ element?: { name: string }; default?: { name: string } }>;
}

/** Each manifest, with the element its code loads. */
async function describeManifests(list: Array<UmbExtensionManifest>) {
	return Promise.all(
		(list as Array<Manifest>).map(async ({ type, alias, weight, meta, conditions, element }) => {
			const loaded = await element?.();
			return { type, alias, weight, meta, conditions, element: (loaded?.element ?? loaded?.default)?.name };
		}),
	);
}

describe('Formulate submissions manifests', () => {
	it('give saved forms a Submissions view after Fields and Handlers, and a sidebar for a submission', async () => {
		expect(await describeManifests(manifests)).toStrictEqual([
			{
				type: 'workspaceView',
				alias: 'Formulate.WorkspaceView.Form.Submissions',
				weight: 50,
				meta: { label: '#formulate_submissions', pathname: 'submissions', icon: 'icon-inbox' },
				// A new form has no submissions: the view shows once the form is saved.
				conditions: [
					{ alias: 'Umb.Condition.WorkspaceAlias', match: 'Formulate.Workspace.Form' },
					{ alias: 'Umb.Condition.WorkspaceEntityIsNew', match: false },
				],
				element: 'FormulateFormSubmissionsWorkspaceViewElement',
			},
			{
				type: 'modal',
				alias: 'Formulate.Modal.Submission',
				weight: undefined,
				meta: undefined,
				conditions: undefined,
				element: 'FormulateSubmissionModalElement',
			},
		]);

		// The views of the form workspace, from first to last (a higher weight comes first).
		const views = [...workspaceManifests, ...manifests]
			.filter((manifest) => manifest.type === 'workspaceView')
			.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
		expect(views.map((view) => view.alias)).toStrictEqual([
			'Formulate.WorkspaceView.Form.Fields',
			'Formulate.WorkspaceView.Form.Handlers',
			'Formulate.WorkspaceView.Form.Submissions',
		]);
	});

	it("are in Formulate's bundle", () => {
		const aliases = new Set(bundle.map((manifest) => manifest.alias));

		expect(manifests.map((manifest) => [manifest.alias, aliases.has(manifest.alias)])).toStrictEqual([
			['Formulate.WorkspaceView.Form.Submissions', true],
			['Formulate.Modal.Submission', true],
		]);
	});
});
