import { umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestHost } from '../test/test-host.js';
import type { ManifestFormulateKindEditor } from './extension-types.js';
import { FormulateKindEditorSlotElement } from './kind-editor-slot.element.js';

// The field editor that docs/extending.md shows ("An editor for the field's settings"): a plain custom element that
// imports nothing from Formulate or Umbraco, as another package can write one. Keep the two the same, apart from the
// types and the override keyword that TypeScript needs.
class PhoneFieldEditor extends HTMLElement {
	#value: { autocomplete?: string } | undefined;
	#readonly = false;
	#input = document.createElement('input');

	constructor() {
		super();
		this.#input.addEventListener('change', () => {
			// A new object, which keeps the settings this editor does not edit.
			this.#value = { ...this.#value, autocomplete: this.#input.value };
			this.dispatchEvent(new Event('change'));
		});
	}

	get value() {
		return this.#value;
	}

	set value(value) {
		this.#value = value;
		this.#update();
	}

	get readonly() {
		return this.#readonly;
	}

	set readonly(readonly) {
		this.#readonly = readonly;
		this.#update();
	}

	override connectedCallback() {
		this.append(this.#input);
		this.#update();
	}

	#update() {
		this.#input.value = this.#value?.autocomplete ?? '';
		this.#input.disabled = this.#readonly;
	}
}

customElements.define('my-phone-field-editor', PhoneFieldEditor);

const ALIAS = 'My.FieldEditor.Phone';

/** Registers the editor as the guide's umbraco-package.json does, with the element itself instead of its file. */
function registerPhoneEditor() {
	umbExtensionsRegistry.register({
		type: 'formulateFieldEditor',
		alias: ALIAS,
		name: 'Phone field editor',
		element: PhoneFieldEditor,
		meta: { editorAlias: 'my-phone-field' },
	} as unknown as ManifestFormulateKindEditor);
}

/** Shows the slot for the Phone field's editor alias, and records the values it reports as changed. */
async function renderSlot(props: { value?: unknown; readonly?: boolean }) {
	const slot = new FormulateKindEditorSlotElement();
	Object.assign(slot, { type: 'formulateFieldEditor', editorAlias: 'my-phone-field', ...props });
	const changes: Array<unknown> = [];
	slot.addEventListener('change', () => changes.push(slot.value));
	createTestHost().append(slot);
	await slot.updateComplete;
	const findInput = () => slot.shadowRoot!.querySelector<HTMLInputElement>('my-phone-field-editor input');
	await expect.poll(findInput).not.toBeNull();

	return { slot, changes, input: findInput()! };
}

/** Types a value into the input, as a person would, which ends with a change event. */
function type(input: HTMLInputElement, value: string) {
	input.value = value;
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => {
	umbExtensionsRegistry.unregister(ALIAS);
	document.body.replaceChildren();
});

describe('a field editor written as a plain custom element, as the extending guide shows', () => {
	it('shows the saved setting, and its change keeps the settings it does not edit', async () => {
		registerPhoneEditor();
		const { changes, input } = await renderSlot({ value: { autocomplete: 'tel', other: 1 } });

		expect(input.value).toBe('tel');
		type(input, 'tel-national');

		expect(changes).toStrictEqual([{ autocomplete: 'tel-national', other: 1 }]);
	});

	it('starts empty for a new field', async () => {
		registerPhoneEditor();
		const { changes, input } = await renderSlot({ value: undefined });

		expect(input.value).toBe('');
		type(input, 'tel');

		expect(changes).toStrictEqual([{ autocomplete: 'tel' }]);
	});

	it('can be changed only while the slot is not read-only', async () => {
		registerPhoneEditor();
		const { slot, input } = await renderSlot({ value: { autocomplete: 'tel' }, readonly: true });

		expect(input.disabled).toBe(true);

		slot.readonly = false;
		await slot.updateComplete;

		expect(input.disabled).toBe(false);
	});
});
