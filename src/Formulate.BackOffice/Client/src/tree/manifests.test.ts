import { describe, expect, it } from 'vitest';
import { manifests } from './manifests.js';

describe('Formulate tree manifests', () => {
	it('give every tree the classic tree view, which Umbraco 20 no longer adds by itself', () => {
		const trees = manifests.filter((manifest) => manifest.type === 'tree').map((manifest) => manifest.alias);
		const viewed = manifests
			.filter((manifest) => manifest.type === 'treeView' && manifest.kind === 'classic')
			.flatMap((manifest) => (manifest as { forTrees?: Array<string> }).forTrees ?? []);

		expect(trees).toHaveLength(3);
		expect(viewed).toEqual(expect.arrayContaining(trees));
	});
});
