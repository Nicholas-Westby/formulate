import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeApi, jsonResponse } from '../../test/fake-api.js';
import { serveForms } from '../../test/forms.js';
import { LIST, MANDATORY, REGEX, US_STATES } from '../../test/kind-items.js';
import { loadFormulateEnglishTerms } from '../../test/localization.js';
import { createTestHost, type FormulateTestHostElement } from '../../test/test-host.js';
import { click, press } from '../../test/ui.js';
import { FormulateDefinitionsContext } from '../definitions.context.js';
import { manifests as itemManifests } from '../item/manifests.js';
import { FormulateItemStore } from '../item/item.store.js';
import { FormulateDataValuesPickerElement } from './data-values-picker.element.js';
import { createPickableFilter, type FormulatePickedItem } from './tree-item-picker.element.js';
import { FormulateValidationPickerElement } from './validation-picker.element.js';

const REQUIRED_ID = '5c2e8a41-7d3b-4f19-a6e0-3b9d1f7c2a03';
const EMAIL_ID = '6d3f9b52-8e4c-4a2a-b7f1-4c0e2a8d3b04';
const ZIP_ID = '7e4a0c63-9f5d-4b3b-88a2-5d1f3b9e4c05';
const STATES_ID = '8f5b1d74-0a6e-4c4c-99b3-6e2a4c0f5d06';
const COLORS_ID = '9a6c2e85-1b7f-4d5d-8ac4-7f3b5d1a6e07';
const GONE_ID = 'a07d3f96-2c8a-4e6e-9bd5-8a4c6e2b7f08';

const ITEMS: Record<string, FormulatePickedItem> = {
	[REQUIRED_ID]: { unique: REQUIRED_ID, name: 'Required', kindId: MANDATORY },
	[EMAIL_ID]: { unique: EMAIL_ID, name: 'Email address', kindId: REGEX },
	[ZIP_ID]: { unique: ZIP_ID, name: 'Zip code', kindId: REGEX },
	[STATES_ID]: { unique: STATES_ID, name: 'US States', kindId: US_STATES },
	[COLORS_ID]: { unique: COLORS_ID, name: 'Colors', kindId: LIST },
};

/** The pickers without the back office's item repository and tree picker: the items they can find, and the pick. */
class TestValidationPicker extends FormulateValidationPickerElement {
	picks?: Array<string>;
	requests: Array<Array<string>> = [];
	opened: Array<Array<string>> = [];
	/** Whether reading fails, as it does when the server cannot be reached. */
	failing = false;

	protected override async requestItems(ids: ReadonlyArray<string>) {
		this.requests.push([...ids]);
		if (this.failing) throw new Error('The server could not be reached.');
		return ids.map((id) => ITEMS[id]).filter((item) => item !== undefined);
	}

	protected override async pickIds(current: ReadonlyArray<string>) {
		this.opened.push([...current]);
		return this.picks;
	}
}
customElements.define('formulate-test-validation-picker', TestValidationPicker);

class TestDataValuesPicker extends FormulateDataValuesPickerElement {
	picks?: Array<string>;
	opened: Array<Array<string>> = [];

	protected override async requestItems(ids: ReadonlyArray<string>) {
		return ids.map((id) => ITEMS[id]).filter((item) => item !== undefined);
	}

	protected override async pickIds(current: ReadonlyArray<string>) {
		this.opened.push([...current]);
		return this.picks;
	}
}
customElements.define('formulate-test-data-values-picker', TestDataValuesPicker);

/** The validation picker that reads through the back office's item repository, as it does in the back office. */
class RepositoryValidationPicker extends FormulateValidationPickerElement {}
customElements.define('formulate-test-repository-validation-picker', RepositoryValidationPicker);

beforeAll(() => {
	umbExtensionsRegistry.registerMany(itemManifests);
	// The names of the Remove buttons; the other terms show as their keys.
	loadFormulateEnglishTerms(['formulate_removeItem']);
});

/**
 * Shows a picker in a back office host that has the definitions, so it can name the kinds.
 * @param setup Adds what else the host has.
 */
async function render<T extends FormulateValidationPickerElement | FormulateDataValuesPickerElement>(
	element: T,
	value: T['value'],
	readonly = false,
	setup?: (host: FormulateTestHostElement) => void,
) {
	serveForms();
	const host = createTestHost();
	new FormulateDefinitionsContext(host);
	setup?.(host);
	element.value = value as never;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? structuredClone(element.value) : 'not an UmbChangeEvent');
	});
	host.append(element);
	await settle(element);

	return { element, changes, shadow: element.shadowRoot! };
}

async function settle(element: HTMLElement & { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 3; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await element.updateComplete;
}

/** Each ref the picker shows: its name, detail line, and whether it says it is in error. */
function refs(shadow: ShadowRoot) {
	return [...shadow.querySelectorAll('uui-ref-node')].map((ref) => ({
		name: ref.getAttribute('name'),
		detail: ref.getAttribute('detail'),
		error: ref.hasAttribute('error'),
	}));
}

function chooseButton(shadow: ShadowRoot) {
	return shadow.querySelector('#btn-add');
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate validation picker', () => {
	it("shows each picked validation by name, with its kind's name under it, in the order they are checked", async () => {
		const { shadow, element } = await render(new TestValidationPicker(), [ZIP_ID, REQUIRED_ID]);

		expect(refs(shadow)).toStrictEqual([
			{ name: 'Zip code', detail: 'Regular Expression', error: false },
			{ name: 'Required', detail: 'Mandatory', error: false },
		]);
		// One request reads them all.
		expect(element.requests).toStrictEqual([[ZIP_ID, REQUIRED_ID]]);
		expect(chooseButton(shadow)?.getAttribute('label')).toBe('general_choose');
	});

	it('adds the validations picked in the tree after those already picked, and drops those no longer picked', async () => {
		const { shadow, element, changes } = await render(new TestValidationPicker(), [ZIP_ID, REQUIRED_ID]);
		// The tree picker gives its whole selection: what was picked before, then what was added.
		element.picks = [REQUIRED_ID, EMAIL_ID];

		click(chooseButton(shadow)!);
		await settle(element);

		expect(element.opened).toStrictEqual([[ZIP_ID, REQUIRED_ID]]);
		expect(changes).toStrictEqual([[REQUIRED_ID, EMAIL_ID]]);
		expect(refs(shadow).map((ref) => ref.name)).toStrictEqual(['Required', 'Email address']);
	});

	it('changes nothing when the tree picker is closed without a pick', async () => {
		const { shadow, element, changes } = await render(new TestValidationPicker(), [ZIP_ID]);
		element.picks = undefined;

		click(chooseButton(shadow)!);
		await settle(element);

		expect(changes).toStrictEqual([]);
	});

	it('removes a validation', async () => {
		const { shadow, element, changes } = await render(new TestValidationPicker(), [ZIP_ID, REQUIRED_ID]);

		click(shadow.querySelectorAll('uui-ref-node')[0].querySelector('uui-button')!);
		await settle(element);

		expect(changes).toStrictEqual([[REQUIRED_ID]]);
		expect(refs(shadow).map((ref) => ref.name)).toStrictEqual(['Required']);
	});

	it('moves a validation with the keyboard, which changes the order they are checked in', async () => {
		const { shadow, element, changes } = await render(new TestValidationPicker(), [ZIP_ID, REQUIRED_ID, EMAIL_ID]);
		const handle = shadow.querySelector<HTMLElement>('.row .handle')!;

		expect(handle.getAttribute('aria-label')).toBe('formulate_moveItem');
		handle.focus();
		press(handle, 'ArrowDown');
		await settle(element);

		expect(changes).toStrictEqual([[REQUIRED_ID, ZIP_ID, EMAIL_ID]]);
		expect(refs(shadow).map((ref) => ref.name)).toStrictEqual(['Required', 'Zip code', 'Email address']);
		expect(shadow.activeElement).toBe(shadow.querySelector(`.row[data-key="${ZIP_ID}"] .handle`));
	});

	it('says when a picked validation no longer exists, and lets it be removed', async () => {
		const { shadow, element, changes } = await render(new TestValidationPicker(), [GONE_ID, REQUIRED_ID]);

		expect(refs(shadow)[0]).toStrictEqual({ name: 'formulate_validationNotFound', detail: GONE_ID, error: true });

		click(shadow.querySelectorAll('uui-ref-node')[0].querySelector('uui-button')!);
		await settle(element);
		expect(changes).toStrictEqual([[REQUIRED_ID]]);
	});

	it('says when a validation could not be read, without calling it gone, and reads it again at the next update', async () => {
		const { shadow, element } = await render(new TestValidationPicker(), [ZIP_ID]);
		// Once the kinds are known, nothing else updates the picker on its own.
		await vi.waitFor(() => expect(refs(shadow)[0].detail).not.toBe(''));
		element.failing = true;
		element.value = [ZIP_ID, REQUIRED_ID];
		await settle(element);

		expect(refs(shadow)).toStrictEqual([
			{ name: 'Zip code', detail: 'Regular Expression', error: false },
			{ name: 'formulate_itemNotRead', detail: REQUIRED_ID, error: false },
		]);
		// Showing that it failed does not read it again, so a server that stays down is not asked over and over.
		await settle(element);
		expect(element.requests).toStrictEqual([[ZIP_ID], [REQUIRED_ID]]);

		element.failing = false;
		element.value = [ZIP_ID, REQUIRED_ID];
		await settle(element);

		expect(refs(shadow).map((ref) => ref.name)).toStrictEqual(['Zip code', 'Required']);
		expect(element.requests).toStrictEqual([[ZIP_ID], [REQUIRED_ID], [REQUIRED_ID]]);
	});

	it('takes a failed answer of the item endpoint as a read that failed, then shows the validations once it answers', async () => {
		const { shadow, element } = await render(new RepositoryValidationPicker(), [REQUIRED_ID, GONE_ID], false, (host) => {
			new UmbNotificationContext(host);
			new FormulateItemStore(host);
		});
		// The definitions and forms API does not have the item endpoint, so it answers 404. The repository is
		// loaded first, which can take longer than an update.
		await vi.waitFor(() => expect(refs(shadow)[0].name).not.toBe(''));
		expect(refs(shadow).map((ref) => [ref.name, ref.error])).toStrictEqual([
			['formulate_itemNotRead', false],
			['formulate_itemNotRead', false],
		]);

		fakeApi(() =>
			jsonResponse([
				{ id: REQUIRED_ID, entityType: 'formulate-validation', name: 'Required', icon: 'icon-check', parentId: null, parentName: null, kindId: MANDATORY },
			]),
		);
		element.value = [REQUIRED_ID, GONE_ID];
		await vi.waitFor(() => expect(refs(shadow)[0].name).toBe('Required'));

		expect(refs(shadow).map((ref) => [ref.name, ref.error])).toStrictEqual([
			['Required', false],
			['formulate_validationNotFound', true],
		]);
	});

	it('names each Remove button after its validation, keeping Remove as what it shows', async () => {
		const { shadow } = await render(new TestValidationPicker(), [ZIP_ID, GONE_ID]);
		const buttons = [...shadow.querySelectorAll('uui-ref-node uui-button')];

		expect(buttons.map((button) => [button.getAttribute('label'), button.getAttribute('aria-label')])).toStrictEqual([
			['general_remove', 'Remove Zip code'],
			['general_remove', 'Remove item 2'],
		]);
	});

	it('only reads the validations it has not read yet', async () => {
		const { shadow, element } = await render(new TestValidationPicker(), [ZIP_ID]);
		element.picks = [ZIP_ID, EMAIL_ID];

		click(chooseButton(shadow)!);
		await settle(element);

		expect(element.requests).toStrictEqual([[ZIP_ID], [EMAIL_ID]]);
	});

	it('shows only Choose when no validation is picked, with the list there for the sorter to find', async () => {
		const errors: Array<unknown> = [];
		const onError = (event: ErrorEvent) => errors.push(event.error);
		window.addEventListener('error', onError);

		try {
			const { shadow } = await render(new TestValidationPicker(), []);
			// The sorter looks for its list in the next animation frame after the picker is shown.
			await new Promise((resolve) => requestAnimationFrame(resolve));
			await new Promise((resolve) => requestAnimationFrame(resolve));

			expect([refs(shadow), shadow.querySelector('#rows') !== null, chooseButton(shadow) !== null]).toStrictEqual([[], true, true]);
			expect(errors).toStrictEqual([]);
		} finally {
			window.removeEventListener('error', onError);
		}
	});

	it("shows the validations as rows of one list, as Umbraco's pickers of many items do", async () => {
		const { shadow } = await render(new TestValidationPicker(), [ZIP_ID, REQUIRED_ID]);

		expect([...shadow.querySelectorAll('uui-ref-node')].map((ref) => ref.hasAttribute('standalone'))).toStrictEqual([false, false]);
	});

	it('shows the validations, but nothing to change them with, while read-only', async () => {
		const { shadow } = await render(new TestValidationPicker(), [ZIP_ID, REQUIRED_ID], true);

		expect(refs(shadow).map((ref) => ref.name)).toStrictEqual(['Zip code', 'Required']);
		expect([chooseButton(shadow), shadow.querySelector('.handle'), shadow.querySelector('uui-ref-node uui-button')]).toStrictEqual([
			null,
			null,
			null,
		]);
	});
});

describe('Formulate data values picker', () => {
	it("shows the picked data values by name, with its kind's name under it, and no Choose", async () => {
		const { shadow } = await render(new TestDataValuesPicker(), STATES_ID);

		expect(refs(shadow)).toStrictEqual([
			{ name: 'US States', detail: 'List of States and Territories in the United States', error: false },
		]);
		expect(chooseButton(shadow)).toBeNull();
	});

	it("shows the picked data values in a box of its own, as Umbraco's pickers of one item do", async () => {
		const { shadow } = await render(new TestDataValuesPicker(), STATES_ID);

		expect(shadow.querySelector('uui-ref-node')?.hasAttribute('standalone')).toBe(true);
	});

	it('shows Choose when nothing is picked, also for the empty ID the API gives for none', async () => {
		for (const value of [undefined, '00000000-0000-0000-0000-000000000000']) {
			const { shadow } = await render(new TestDataValuesPicker(), value);

			expect([refs(shadow), chooseButton(shadow)?.getAttribute('label')]).toStrictEqual([[], 'general_choose']);
			document.body.replaceChildren();
		}
	});

	it('picks one data values item in the tree', async () => {
		const { shadow, element, changes } = await render(new TestDataValuesPicker(), undefined);
		element.picks = [COLORS_ID];

		click(chooseButton(shadow)!);
		await settle(element);

		expect(element.opened).toStrictEqual([[]]);
		expect(changes).toStrictEqual([COLORS_ID]);
		expect(refs(shadow)).toStrictEqual([{ name: 'Colors', detail: 'List', error: false }]);
	});

	it('removes the pick', async () => {
		const { shadow, element, changes } = await render(new TestDataValuesPicker(), COLORS_ID);

		click(shadow.querySelector('uui-ref-node uui-button')!);
		await settle(element);

		expect(changes).toStrictEqual([undefined]);
		expect(chooseButton(shadow)).not.toBeNull();
	});

	it('says when the picked data values no longer exist', async () => {
		const { shadow } = await render(new TestDataValuesPicker(), GONE_ID);

		expect(refs(shadow)).toStrictEqual([{ name: 'formulate_dataValuesNotFound', detail: GONE_ID, error: true }]);
	});
});

describe('Formulate tree item pickers, in the tree', () => {
	it('let only items of their entity type be picked: not folders, nor the root', () => {
		const pickable = createPickableFilter('formulate-validation');
		const item = (entityType: string, unique: string | null) =>
			({ entityType, unique, name: 'x', hasChildren: false, isFolder: entityType.endsWith('folder'), icon: null, parent: { unique: null, entityType: 'formulate-validations-root' } }) as never;

		expect([
			pickable(item('formulate-validation', ZIP_ID)),
			pickable(item('formulate-validation-folder', COLORS_ID)),
			pickable(item('formulate-validations-root', null)),
		]).toStrictEqual([true, false, false]);
	});
});
