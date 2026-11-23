import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';
import { afterEach, describe, expect, it } from 'vitest';
import { FormulateLiveRegion } from './live-region.js';

/** An element with a live region, as the lists that announce their keyboard moves have one. */
@customElement('formulate-test-live-region')
class FormulateTestLiveRegionElement extends UmbLitElement {
	region = new FormulateLiveRegion(this);

	override render() {
		return html`<div id="region" role="status">${this.region.text}</div>`;
	}
}

/** Shows the element, and records every text its region shows, in order. */
async function renderRegion() {
	const element = new FormulateTestLiveRegionElement();
	document.body.append(element);
	await element.updateComplete;
	const region = element.shadowRoot!.querySelector('#region')!;
	const texts: Array<string> = [];
	new MutationObserver(() => texts.push(region.textContent ?? '')).observe(region, {
		characterData: true,
		childList: true,
		subtree: true,
	});

	return { element, region, texts };
}

/** Waits for the next frames, when the region shows what it was given. */
async function nextFrames(element: FormulateTestLiveRegionElement) {
	for (let i = 0; i < 3; i++) {
		await new Promise((resolve) => requestAnimationFrame(resolve));
		await element.updateComplete;
	}
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate live region', () => {
	it('says a message on the next frame, after emptying the region', async () => {
		const { element, region, texts } = await renderRegion();

		element.region.say('Moved to item 2 of 3.');
		await element.updateComplete;
		expect(region.textContent).toBe('');

		await nextFrames(element);
		expect(region.textContent).toBe('Moved to item 2 of 3.');
		expect(texts.at(-1)).toBe('Moved to item 2 of 3.');
	});

	it('says the same message again: the region is emptied first, so screen readers read it twice', async () => {
		const { element, texts } = await renderRegion();

		element.region.say('Moved to item 2 of 3.');
		await nextFrames(element);
		element.region.say('Moved to item 2 of 3.');
		await nextFrames(element);

		expect(texts.filter((text) => text !== '')).toStrictEqual(['Moved to item 2 of 3.', 'Moved to item 2 of 3.']);
		expect(texts.at(-2)).toBe('');
	});

	it('says only the last of two messages given in the same frame', async () => {
		const { element, region, texts } = await renderRegion();

		element.region.say('Picked up item 1 of 3.');
		element.region.say('Moved to item 2 of 3.');
		await nextFrames(element);

		expect(region.textContent).toBe('Moved to item 2 of 3.');
		expect(texts).not.toContain('Picked up item 1 of 3.');
	});

	it('says nothing once its element is taken out of the page', async () => {
		const { element, region } = await renderRegion();

		element.region.say('Moved to item 2 of 3.');
		element.remove();
		await nextFrames(element);

		expect(region.textContent).toBe('');
	});
});
