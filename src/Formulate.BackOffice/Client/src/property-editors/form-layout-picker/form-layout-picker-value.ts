import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import { FORMULATE_LAYOUT_ENTITY_TYPE } from '../../constants.js';

/**
 * What the Form Layout Picker stores: the ID of the picked layout. The server reads exactly this shape
 * (FormLayoutPickerPropertyValue, a DataContract with one member, "id", a Guid), and finds the layout's
 * form from the layout, so the form's ID is not stored.
 */
export interface FormLayoutPickerValue {
	id: string;
}

/**
 * The value to store for a picked layout.
 * @param layoutId The picked layout's ID, or undefined when nothing is picked.
 * @returns { id }, or undefined (never an empty object) when nothing is picked.
 */
export function toPropertyValue(layoutId: string | undefined): FormLayoutPickerValue | undefined {
	return layoutId ? { id: layoutId } : undefined;
}

/**
 * The picked layout's ID in a stored value.
 * @param value The property's value.
 * @returns The ID, or undefined when the value holds none.
 */
export function readPickedLayoutId(value: unknown): string | undefined {
	const id = (value as { id?: unknown } | null | undefined)?.id;

	return typeof id === 'string' && id !== '' ? id : undefined;
}

/**
 * The tree picker's filter: only layouts can be picked. Forms and folders can be opened, to reach the
 * layouts inside them, but not picked; neither can the tree's root.
 * @param onSeen Told of each item the picker asks about, so the element can keep the names it shows.
 * @returns True for a layout.
 */
export function createLayoutPickableFilter(
	onSeen?: (item: UmbTreeItemModel | UmbTreeRootModel) => void,
): (item: UmbTreeItemModel | UmbTreeRootModel) => boolean {
	return (item) => {
		onSeen?.(item);

		return item.unique !== null && item.entityType === FORMULATE_LAYOUT_ENTITY_TYPE;
	};
}
