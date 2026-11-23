import type { CSSResult } from '@umbraco-cms/backoffice/external/lit';
import { afterEach, describe, expect, it } from 'vitest';
import { FormulateSubmissionValueElement, LONGEST_WHOLE_WORD } from './submission-value.element.js';

/** An address with no space to break at, longer than a narrow column. */
const LONG_ADDRESS = 'maria.lopez.purchasing.department@example-company.com';

afterEach(() => {
	document.body.replaceChildren();
});

/** A value cell on the page, holding the text. */
async function valueOf(text: string) {
	const value = document.createElement('formulate-submission-value');
	value.textContent = text;
	document.body.append(value);
	await value.updateComplete;
	return value;
}

/**
 * The declarations of the value cell's rule for itself (:host), by property, as its styles write them. jsdom lays
 * nothing out, and its style sheets drop properties it does not know, such as -webkit-line-clamp; the E2E tests see
 * the rule work in a browser.
 */
function ownDeclarations(): Record<string, string> {
	return declarationsOf(/:host\s*\{([^}]*)\}/);
}

/** The declarations of the value cell's rule for itself with a word too long to keep whole (:host([long-word])). */
function longWordDeclarations(): Record<string, string> {
	return declarationsOf(/:host\(\[long-word\]\)\s*\{([^}]*)\}/);
}

/** The declarations of the first rule of the value cell's styles that the pattern finds, by property. */
function declarationsOf(rule: RegExp): Record<string, string> {
	const styles = [FormulateSubmissionValueElement.styles].flat(Infinity) as Array<CSSResult>;
	const block = rule.exec(styles.map((style) => style.cssText).join('\n'))?.[1] ?? '';

	return Object.fromEntries(
		block
			.split(';')
			.map((declaration) => declaration.trim())
			.filter(Boolean)
			.map((declaration) => {
				const colon = declaration.indexOf(':');
				return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
			}),
	);
}

/** Sets how tall the value cell's text is and how tall the cell shows it, which jsdom, laying nothing out, leaves at 0. */
function setHeights(value: HTMLElement, text: number, shown: number) {
	Object.defineProperty(value, 'scrollHeight', { configurable: true, value: text });
	Object.defineProperty(value, 'clientHeight', { configurable: true, value: shown });
}

describe('Formulate submission value', () => {
	it('breaks a long word anywhere it must, and shows at most three lines, ending with "…" when they cut it', async () => {
		const value = await valueOf(LONG_ADDRESS);

		// The text stays in the page, where the table's own tests and a screen reader find it, and shows in the slot.
		expect([value.textContent, value.shadowRoot?.querySelectorAll('slot').length]).toStrictEqual([LONG_ADDRESS, 1]);
		expect(value.hasAttribute('long-word')).toBe(true);
		expect(longWordDeclarations()).toMatchObject({ 'overflow-wrap': 'anywhere' });
		expect(ownDeclarations()).toMatchObject({
			display: '-webkit-box',
			'-webkit-box-orient': 'vertical',
			'-webkit-line-clamp': '3',
			overflow: 'hidden',
		});
	});

	it('keeps a value of short words whole, wrapping only between them, so a narrow column never splits "Support"', async () => {
		// break-word, unlike anywhere, leaves the words in the width a table gives a column at the least.
		const words = await valueOf('Support');
		const longest = await valueOf(`${'a'.repeat(LONGEST_WHOLE_WORD)} b`);

		expect([words.hasAttribute('long-word'), longest.hasAttribute('long-word')]).toStrictEqual([false, false]);
		expect(ownDeclarations()['overflow-wrap']).toBe('break-word');
	});

	it('marks the value again when the table reuses the cell for other text', async () => {
		const value = await valueOf('Support');
		const text = value.firstChild as Text;

		text.data = LONG_ADDRESS;
		await Promise.resolve();
		const long = value.hasAttribute('long-word');

		text.data = 'Sales';
		await Promise.resolve();

		expect([long, value.hasAttribute('long-word')]).toStrictEqual([true, false]);
	});

	it('keeps its lines to 16em, so one long value cannot take the width the other columns need', async () => {
		await valueOf(LONG_ADDRESS);

		// Three lines of 16em hold the 100 characters the table keeps of a value (previewText).
		expect(ownDeclarations()['max-width']).toBe('16em');
	});

	it('shows its text as a title on hover while its three lines cut it, and no title once they do not', async () => {
		const value = await valueOf(LONG_ADDRESS);

		setHeights(value, 120, 60);
		value.dispatchEvent(new MouseEvent('mouseenter'));
		const whileCut = value.getAttribute('title');

		setHeights(value, 40, 40);
		value.dispatchEvent(new MouseEvent('mouseenter'));

		expect([whileCut, value.getAttribute('title')]).toStrictEqual([LONG_ADDRESS, null]);
	});
});
