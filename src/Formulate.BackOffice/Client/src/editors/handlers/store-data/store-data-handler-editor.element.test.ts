import { afterEach, describe, expect, it } from 'vitest';
import { FormulateStoreDataHandlerEditorElement } from './store-data-handler-editor.element.js';

afterEach(() => {
	document.body.replaceChildren();
});

// The server's Store Data handler has nothing to configure: its back office configuration is always empty.
describe('Formulate Store Data handler editor', () => {
	it('says what the handler stores, and stores nothing itself', async () => {
		const element = new FormulateStoreDataHandlerEditorElement();
		element.value = { kept: 'as is' };
		const changes: Array<unknown> = [];
		element.addEventListener('change', () => changes.push(element.value));
		document.body.append(element);
		await element.updateComplete;

		expect(element.shadowRoot!.querySelector('#description')?.textContent?.trim()).toBe('formulate_storeDataDescription');
		expect([changes, element.value]).toStrictEqual([[], { kept: 'as is' }]);
	});
});
