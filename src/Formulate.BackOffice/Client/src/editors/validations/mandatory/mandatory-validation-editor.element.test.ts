import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, describe, expect, it } from 'vitest';
import { typeInto } from '../../../test/ui.js';
import { FormulateMandatoryValidationEditorElement } from './mandatory-validation-editor.element.js';

async function render(value: unknown, readonly = false) {
	const element = new FormulateMandatoryValidationEditorElement();
	element.value = value;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? JSON.parse(JSON.stringify(element.value)) : 'not an UmbChangeEvent');
	});
	document.body.append(element);
	await element.updateComplete;

	const shadow = element.shadowRoot!;
	return {
		element,
		changes,
		message: shadow.querySelector('uui-input#message') as HTMLInputElement,
		clientSideOnly: shadow.querySelector('uui-toggle#client-side-only') as HTMLInputElement,
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate Mandatory validation editor', () => {
	it('shows the error message and whether only the browser checks the field', async () => {
		const { message, clientSideOnly } = await render({ message: 'Please fill this in.', clientSideOnly: true });

		expect([message.value, clientSideOnly.checked]).toStrictEqual(['Please fill this in.', true]);
	});

	it('stores the message as it is typed and the client side only setting as it is switched', async () => {
		const { message, clientSideOnly, changes } = await render({ message: null, clientSideOnly: false });

		typeInto(message, 'Required.');
		clientSideOnly.checked = true;
		clientSideOnly.dispatchEvent(new Event('change'));

		expect(changes).toStrictEqual([
			{ message: 'Required.', clientSideOnly: false },
			{ message: 'Required.', clientSideOnly: true },
		]);
	});

	it('starts from no configuration, and keeps settings it does not edit', async () => {
		const empty = await render(undefined);
		expect([empty.message.value, empty.clientSideOnly.checked]).toStrictEqual(['', false]);
		typeInto(empty.message, 'Needed.');
		expect(empty.changes).toStrictEqual([{ message: 'Needed.' }]);

		const other = await render({ message: 'x', clientSideOnly: false, severity: 'high' });
		typeInto(other.message, 'y');
		expect(other.changes).toStrictEqual([{ message: 'y', clientSideOnly: false, severity: 'high' }]);
	});

	it('changes nothing when read-only', async () => {
		const { message, clientSideOnly } = await render({ message: 'x', clientSideOnly: false }, true);

		expect([message.hasAttribute('readonly'), clientSideOnly.hasAttribute('readonly')]).toStrictEqual([true, true]);
	});
});
