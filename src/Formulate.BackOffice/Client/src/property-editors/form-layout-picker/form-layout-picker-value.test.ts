import { describe, expect, it } from 'vitest';
import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import {
	createLayoutPickableFilter,
	readPickedLayoutId,
	toPropertyValue,
} from './form-layout-picker-value.js';

const LAYOUT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03';

function treeItem(entityType: string, unique: string | null): UmbTreeItemModel | UmbTreeRootModel {
	return { entityType, unique, name: 'Item', hasChildren: false } as UmbTreeItemModel;
}

describe('Form layout picker value', () => {
	it('stores the picked layout as { id }, which is what the server converter reads', () => {
		expect(toPropertyValue(LAYOUT_ID)).toStrictEqual({ id: LAYOUT_ID });
	});

	it('stores no value, never {}, when nothing is picked', () => {
		expect(toPropertyValue(undefined)).toBeUndefined();
	});

	it('reads the layout ID of a stored value, and nothing from anything else', () => {
		expect(readPickedLayoutId({ id: LAYOUT_ID })).toBe(LAYOUT_ID);
		expect([undefined, null, {}, { id: '' }, { id: 5 }, 'text', []].map(readPickedLayoutId)).toStrictEqual(
			Array(7).fill(undefined),
		);
	});
});

describe('Form layout picker pickable filter', () => {
	it('tells the element about every item it is asked about', () => {
		const seen: Array<string | null> = [];
		const filter = createLayoutPickableFilter((item) => seen.push(item.unique));

		filter(treeItem('formulate-form', 'f'));
		filter(treeItem('formulate-layout', 'l'));

		expect(seen).toStrictEqual(['f', 'l']);
	});

	it('allows layouts only', () => {
		const filter = createLayoutPickableFilter();

		expect(filter(treeItem('formulate-layout', LAYOUT_ID))).toBe(true);
		expect(
			['formulate-form', 'formulate-form-folder', 'formulate-forms-root', 'formulate-validation'].map((type) =>
				filter(treeItem(type, type === 'formulate-forms-root' ? null : 'x')),
			),
		).toStrictEqual([false, false, false, false]);
	});
});
