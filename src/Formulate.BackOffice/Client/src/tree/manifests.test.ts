import { describe, expect, it } from 'vitest';
import * as constants from '../constants.js';
import { manifests } from './manifests.js';

/** Each tree, with the list of its workspaces that later work adds to. */
const TREES = [
	{
		alias: 'Formulate.Tree.Forms',
		workspaces: 'FORMULATE_FORMS_TREE_WORKSPACE_ALIASES',
		folderWorkspace: 'Formulate.Workspace.Folder.Forms',
		rootWorkspace: 'Formulate.Workspace.FormsRoot',
		structureApi: 'FormulateFormsMenuStructureWorkspaceContext',
	},
	{
		alias: 'Formulate.Tree.DataValues',
		workspaces: 'FORMULATE_DATA_VALUES_TREE_WORKSPACE_ALIASES',
		folderWorkspace: 'Formulate.Workspace.Folder.DataValues',
		rootWorkspace: 'Formulate.Workspace.DataValuesRoot',
		structureApi: 'FormulateDataValuesMenuStructureWorkspaceContext',
	},
	{
		alias: 'Formulate.Tree.Validations',
		workspaces: 'FORMULATE_VALIDATIONS_TREE_WORKSPACE_ALIASES',
		folderWorkspace: 'Formulate.Workspace.Folder.Validations',
		rootWorkspace: 'Formulate.Workspace.ValidationsRoot',
		structureApi: 'FormulateValidationsMenuStructureWorkspaceContext',
	},
];

interface Manifest {
	type: string;
	alias: string;
	kind?: string;
	meta?: { treeAlias?: string; menuItemAlias?: string; label?: string; pathname?: string; icon?: string };
	conditions?: unknown;
	api?: () => Promise<{ api: { name: string } }>;
}

describe('Formulate tree manifests', () => {
	it('give every tree the classic tree view, which Umbraco 20 no longer adds by itself', () => {
		const trees = manifests.filter((manifest) => manifest.type === 'tree').map((manifest) => manifest.alias);
		const viewed = manifests
			.filter((manifest) => manifest.type === 'treeView' && manifest.kind === 'classic')
			.flatMap((manifest) => (manifest as { forTrees?: Array<string> }).forTrees ?? []);

		expect(trees).toHaveLength(3);
		expect(viewed).toEqual(expect.arrayContaining(trees));
	});

	it("give the workspaces on each tree's list the tree's menu structure and breadcrumb, as Umbraco's trees do", async () => {
		const all = manifests as Array<Manifest>;
		const menuItems = all.filter((manifest) => manifest.type === 'menuItem');
		const structures = all.filter((manifest) => manifest.type === 'workspaceContext');
		const breadcrumbs = all.filter((manifest) => manifest.type === 'workspaceFooterApp');
		const lists = constants as unknown as Record<string, Array<string> | undefined>;

		const described = await Promise.all(
			structures.map(async (structure) => ({
				kind: structure.kind,
				// The menu item it expands down to the open item, by the tree it shows.
				tree: menuItems.find((item) => item.alias === structure.meta?.menuItemAlias)?.meta?.treeAlias,
				api: (await structure.api?.())?.api.name,
				conditions: structure.conditions,
			})),
		);

		expect(described).toStrictEqual(
			TREES.map((tree) => ({
				kind: 'menuStructure',
				tree: tree.alias,
				api: tree.structureApi,
				conditions: [{ alias: 'Umb.Condition.WorkspaceAlias', oneOf: lists[tree.workspaces] }],
			})),
		);
		expect(breadcrumbs.map((breadcrumb) => [breadcrumb.kind, breadcrumb.conditions])).toStrictEqual(
			TREES.map((tree) => ['menuBreadcrumb', [{ alias: 'Umb.Condition.WorkspaceAlias', oneOf: lists[tree.workspaces] }]]),
		);
		// Each tree's folder workspace is on its tree's list.
		expect(TREES.map((tree) => lists[tree.workspaces]?.includes(tree.folderWorkspace))).toStrictEqual([true, true, true]);
	});

	it("put the validation and data values workspaces on their own tree's list only", () => {
		const lists = constants as unknown as Record<string, Array<string> | undefined>;
		const listsWith = (alias: string) => TREES.filter((tree) => lists[tree.workspaces]?.includes(alias)).map((tree) => tree.alias);

		expect(listsWith('Formulate.Workspace.Validation')).toStrictEqual(['Formulate.Tree.Validations']);
		expect(listsWith('Formulate.Workspace.DataValues')).toStrictEqual(['Formulate.Tree.DataValues']);
	});

	it("list what is in each tree's root and folders in their workspaces, as Umbraco's trees do", () => {
		const views = (manifests as Array<Manifest>).filter((manifest) => manifest.type === 'workspaceView');

		expect(views.map((view) => [view.kind, view.meta, view.conditions])).toStrictEqual(
			TREES.map((tree) => [
				'tree',
				{ label: '#tree_children', pathname: 'children', icon: 'icon-bulleted-list', treeAlias: tree.alias },
				[{ alias: 'Umb.Condition.WorkspaceAlias', oneOf: [tree.rootWorkspace, tree.folderWorkspace] }],
			]),
		);
	});
});
