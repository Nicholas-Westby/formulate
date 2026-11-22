import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, describe, expect, it } from 'vitest';
import { click } from '../../test/ui.js';
import { FormulateFormLayoutPickerElement } from './form-layout-picker.element.js';

const LAYOUT_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03';
const OTHER_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d04';

/** The element without the back office: the layouts it can find, and the layout the user picks. */
class TestPickerElement extends FormulateFormLayoutPickerElement {
	static layouts: Record<string, { name: string; formName: string | null }> = {
		[LAYOUT_ID]: { name: 'Default', formName: 'Contact' },
		[OTHER_ID]: { name: 'Compact', formName: 'Newsletter' },
	};
	picks: { id: string; layout?: { name: string; formName: string | null } } | undefined;
	requests: Array<string> = [];

	protected override async requestLayout(id: string) {
		this.requests.push(id);

		return TestPickerElement.layouts[id];
	}

	protected override async pickLayoutId() {
		return this.picks;
	}
}
customElements.define('formulate-test-form-layout-picker', TestPickerElement);

async function render(value: unknown, init: (element: TestPickerElement) => void = () => {}) {
	const element = new TestPickerElement();
	element.value = value as TestPickerElement['value'];
	init(element);
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? element.value : 'not an UmbChangeEvent');
	});
	document.body.append(element);
	await settle(element);

	return { element, changes, shadow: element.shadowRoot! };
}

function expectRef(shadow: ShadowRoot, name: string, detail: string) {
	const ref = shadow.querySelector('uui-ref-node');

	expect([ref?.getAttribute('name'), ref?.getAttribute('detail')]).toStrictEqual([name, detail]);
}

async function settle(element: TestPickerElement) {
	await element.updateComplete;
	await new Promise((resolve) => setTimeout(resolve, 0));
	await element.updateComplete;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate Form Layout Picker', () => {
	it('shows the form name and the layout name of the picked layout', async () => {
		const { shadow } = await render({ id: LAYOUT_ID });

		expectRef(shadow, 'Contact', 'Default');
		expect(shadow.querySelector('#btn-add')).toBeNull();
	});

	it('offers Choose, and no reference, when nothing is picked', async () => {
		const { shadow } = await render(undefined);

		expect(shadow.querySelector('uui-ref-node')).toBeNull();
		expect(shadow.querySelector('#btn-add')).not.toBeNull();
	});

	it('stores { id } when a layout is picked, and says it changed', async () => {
		const { element, changes, shadow } = await render(undefined, (picker) => (picker.picks = { id: OTHER_ID }));

		click(shadow.querySelector('#btn-add')!);
		await settle(element);

		expect(element.value).toStrictEqual({ id: OTHER_ID });
		expect(changes).toStrictEqual([{ id: OTHER_ID }]);
		expectRef(shadow, 'Newsletter', 'Compact');
	});

	it('keeps the names the picker knew, so a pick needs no request', async () => {
		const { element, shadow } = await render(undefined, (picker) => {
			picker.picks = { id: OTHER_ID, layout: { name: 'Compact', formName: 'Newsletter' } };
		});

		click(shadow.querySelector('#btn-add')!);
		await settle(element);

		expectRef(shadow, 'Newsletter', 'Compact');
		expect((element as TestPickerElement).requests).toStrictEqual([]);
	});

	it('changes nothing when the picker is cancelled', async () => {
		const { element, changes, shadow } = await render(undefined);

		click(shadow.querySelector('#btn-add')!);
		await settle(element);

		expect(element.value).toBeUndefined();
		expect(changes).toStrictEqual([]);
	});

	it('clears the value to undefined when the layout is removed', async () => {
		const { element, changes, shadow } = await render({ id: LAYOUT_ID });

		click(shadow.querySelector('uui-ref-node uui-button')!);
		await settle(element);

		expect(element.value).toBeUndefined();
		expect(changes).toStrictEqual([undefined]);
		expect(shadow.querySelector('uui-ref-node')).toBeNull();
		expect(shadow.querySelector('#btn-add')).not.toBeNull();
	});

	it('still lets the user remove a layout that no longer exists', async () => {
		const { element, shadow } = await render({ id: '00000000-0000-4000-8000-000000000000' });

		expect(shadow.querySelector('uui-ref-node')?.hasAttribute('error')).toBe(true);
		click(shadow.querySelector('uui-ref-node uui-button')!);
		await settle(element);

		expect(element.value).toBeUndefined();
	});

	it('changes only what is shown when the value is set from outside', async () => {
		const { element, changes, shadow } = await render({ id: LAYOUT_ID });

		element.value = { id: OTHER_ID };
		await settle(element);

		expectRef(shadow, 'Newsletter', 'Compact');
		expect(changes).toStrictEqual([]);
	});

	it('cannot be changed when it is read only', async () => {
		const { shadow } = await render({ id: LAYOUT_ID }, (picker) => (picker.readonly = true));

		expect(shadow.querySelector('uui-ref-node uui-button')).toBeNull();
		expect(shadow.querySelector('#btn-add')).toBeNull();
	});

	it('is invalid when it is mandatory and nothing is picked', async () => {
		const { element } = await render(undefined, (picker) => (picker.mandatory = true));

		expect(element.checkValidity()).toBe(false);

		element.value = { id: LAYOUT_ID };
		await settle(element);
		expect(element.checkValidity()).toBe(true);
	});
});
