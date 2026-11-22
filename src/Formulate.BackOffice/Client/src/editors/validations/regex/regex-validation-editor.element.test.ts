import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { afterEach, describe, expect, it } from 'vitest';
import { typeInto } from '../../../test/ui.js';
import { getPatternProblem } from './regex-pattern.js';
import { FormulateRegexValidationEditorElement } from './regex-validation-editor.element.js';

async function render(value: unknown) {
	const element = new FormulateRegexValidationEditorElement();
	element.value = value;
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
		regex: shadow.querySelector('uui-input#regex')!,
		message: shadow.querySelector('uui-input#message')!,
		warning: () => shadow.querySelector('#pattern-warning'),
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate regular expression pattern check', () => {
	it('accepts patterns browsers can use, including none', () => {
		expect(['', '^\\d{5}$', '^[^@\\s]+@[^@\\s]+$', '(?:a|b)+'].map(getPatternProblem)).toStrictEqual([
			undefined,
			undefined,
			undefined,
			undefined,
		]);
	});

	it('flags patterns browsers cannot use, with the reason', () => {
		for (const pattern of ['(', '[a-', 'a{2,1}', '*a']) {
			expect(getPatternProblem(pattern), pattern).toMatch(/\S/);
		}
	});
});

describe('Formulate Regular Expression validation editor', () => {
	it('shows the pattern and the error message', async () => {
		const { regex, message } = await render({ regex: '^\\d{5}$', message: 'Enter a five digit zip code.' });

		expect([(regex as HTMLInputElement).value, (message as HTMLInputElement).value]).toStrictEqual([
			'^\\d{5}$',
			'Enter a five digit zip code.',
		]);
	});

	it('warns while the pattern is not valid, and stores it all the same', async () => {
		const { element, regex, changes, warning } = await render({ regex: '', message: 'Wrong.' });
		expect(warning()).toBeNull();

		typeInto(regex, '(\\d');
		await element.updateComplete;
		// Without the back office's translations loaded, a term shows as its key.
		expect(warning()?.textContent).toContain('formulate_regexInvalid');

		typeInto(regex, '(\\d)');
		await element.updateComplete;
		expect(warning()).toBeNull();

		expect(changes).toStrictEqual([
			{ regex: '(\\d', message: 'Wrong.' },
			{ regex: '(\\d)', message: 'Wrong.' },
		]);
	});

	it('warns about a stored pattern that is not valid as soon as it is shown', async () => {
		const { warning } = await render({ regex: '[a-' });

		expect(warning()).not.toBeNull();
	});

	it('gives the warning politely, as a description of the pattern input', async () => {
		const { element, regex, warning } = await render({ regex: '' });
		const status = element.shadowRoot!.querySelector('#pattern-status');
		const input = regex.shadowRoot!.querySelector('input')!;

		// A status, not an alert: it changes as the pattern is typed, which must not interrupt the typing.
		expect(status?.getAttribute('role')).toBe('status');
		expect(element.shadowRoot!.querySelector('[role="alert"]')).toBeNull();
		// uui-input keeps its input in a shadow root, which an ID cannot reach, so the input gets the element.
		await expect.poll(() => input.ariaDescribedByElements).toStrictEqual([status]);

		typeInto(regex, '(');
		await element.updateComplete;
		expect(status?.contains(warning())).toBe(true);
	});

	it('stores the error message as it is typed, keeping the other settings', async () => {
		const { message, changes } = await render({ regex: 'x', message: '', flags: 'i' });

		typeInto(message, 'Use an x.');

		expect(changes).toStrictEqual([{ regex: 'x', message: 'Use an x.', flags: 'i' }]);
	});
});
