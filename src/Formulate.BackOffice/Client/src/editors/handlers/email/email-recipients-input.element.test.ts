import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadFormulateEnglishTerms } from '../../../test/localization.js';
import { click, press, typeInto, valuesOf } from '../../../test/ui.js';
import { FormulateEmailRecipientsInputElement } from './email-recipients-input.element.js';

beforeAll(() => {
	loadFormulateEnglishTerms(['formulate_recipientPosition', 'formulate_removeItem', 'formulate_moveItem', 'formulate_addRecipient']);
});

afterEach(() => {
	document.body.replaceChildren();
});

/** Shows the input with recipients, as the email editors do, and records the recipients it stores. */
async function render(value: ReadonlyArray<Record<string, unknown>>, readonly = false) {
	const element = new FormulateEmailRecipientsInputElement();
	element.value = value;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? structuredClone(element.value) : 'not an UmbChangeEvent');
	});
	document.body.append(element);
	await element.updateComplete;

	const shadow = element.shadowRoot!;
	const rows = () => [...shadow.querySelectorAll('#rows > .row')];
	const inputs = () => shadow.querySelectorAll('#rows > .row uui-input.email');

	return { element, changes, shadow, rows, inputs, emails: () => valuesOf(inputs()) };
}

// The server reads EmailRecipient: { email }, which can hold a name and several addresses.
const RECIPIENTS = [{ email: 'team@example.com' }, { email: 'Sales <sales@example.com>', note: 'kept' }];

describe('Formulate email recipients input', () => {
	it("shows each recipient's address in an input of its own, named by its place, and stores nothing", async () => {
		const { shadow, inputs, emails, changes } = await render(RECIPIENTS);

		expect(emails()).toStrictEqual(['team@example.com', 'Sales <sales@example.com>']);
		expect([...inputs()].map((input) => input.getAttribute('label'))).toStrictEqual(['Email address 1', 'Email address 2']);
		expect([...shadow.querySelectorAll('.row .handle')].map((handle) => handle.getAttribute('aria-label'))).toStrictEqual([
			'Move Email address 1',
			'Move Email address 2',
		]);
		expect([...shadow.querySelectorAll('.row uui-button.remove')].map((button) => button.getAttribute('label'))).toStrictEqual([
			'Remove Email address 1',
			'Remove Email address 2',
		]);
		expect(shadow.querySelector('uui-button#add')?.getAttribute('label')).toBe('Add recipient');
		expect(changes).toStrictEqual([]);
	});

	it("stores a recipient's address as it is typed, keeping what else the recipient has", async () => {
		const { inputs, changes } = await render(RECIPIENTS);

		typeInto(inputs()[1]!, 'sales@example.com, bids@example.com');

		expect(changes).toStrictEqual([[{ email: 'team@example.com' }, { email: 'sales@example.com, bids@example.com', note: 'kept' }]]);
	});

	it('adds an empty recipient at the end, and removes one', async () => {
		const { element, shadow, emails, changes } = await render(RECIPIENTS);

		click(shadow.querySelector('uui-button#add')!);
		await element.updateComplete;
		expect(emails()).toStrictEqual(['team@example.com', 'Sales <sales@example.com>', '']);

		click(shadow.querySelectorAll('.row uui-button.remove')[0]!);
		await element.updateComplete;

		expect(emails()).toStrictEqual(['Sales <sales@example.com>', '']);
		expect(changes).toStrictEqual([
			[{ email: 'team@example.com' }, { email: 'Sales <sales@example.com>', note: 'kept' }, { email: '' }],
			[{ email: 'Sales <sales@example.com>', note: 'kept' }, { email: '' }],
		]);
	});

	it('moves a recipient with the arrow keys on its handle', async () => {
		const { element, rows, emails, changes } = await render(RECIPIENTS);

		press(rows()[1]!.querySelector('.handle')!, 'ArrowUp');
		await element.updateComplete;

		expect(emails()).toStrictEqual(['Sales <sales@example.com>', 'team@example.com']);
		expect(changes).toStrictEqual([[{ email: 'Sales <sales@example.com>', note: 'kept' }, { email: 'team@example.com' }]]);
	});

	it('keeps its rows, and so the focus, when the recipients it stored come back to it', async () => {
		const { element, inputs } = await render(RECIPIENTS);
		const before = inputs()[0];

		typeInto(before!, 'office@example.com');
		element.value = structuredClone(element.value);
		await element.updateComplete;

		expect(inputs()[0]).toBe(before);
	});

	it('can only be read when it is read-only', async () => {
		const { shadow, inputs } = await render(RECIPIENTS, true);

		expect([
			[...inputs()].every((input) => input.hasAttribute('readonly')),
			shadow.querySelectorAll('.handle, uui-button.remove, uui-button#add').length,
		]).toStrictEqual([true, 0]);
	});
});
