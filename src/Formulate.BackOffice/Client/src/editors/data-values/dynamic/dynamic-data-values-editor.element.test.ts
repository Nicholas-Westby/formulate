import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FormulateDataValuesWorkspaceContext } from '../../../data-values/workspace/data-values-workspace.context.js';
import {
	createWorkspaceHost,
	destroyKept,
	keep,
	LIST,
	registerKindItemRepositories,
	serve,
	US_STATES,
} from '../../../test/kind-items.js';
import { loadFormulateEnglish } from '../../../test/localization.js';
import { FormulateDynamicDataValuesEditorElement } from './dynamic-data-values-editor.element.js';

/** Shows the editor in a host, as the kind editor slot does, and reads its description. */
async function render(host: HTMLElement) {
	const element = new FormulateDynamicDataValuesEditorElement();
	host.append(element);
	await element.updateComplete;

	return { element, description: () => element.shadowRoot!.querySelector('#description')?.textContent?.trim() };
}

/** A data values workspace on a host, creating data values of a kind. */
async function createDataValues(kindId: string) {
	serve();
	const { host } = createWorkspaceHost();
	const context = keep(new FormulateDataValuesWorkspaceContext(host));
	await context.create({ entityType: 'formulate-data-values-root', unique: null }, kindId);

	return host;
}

const GENERIC = 'This kind makes its items itself, so there is nothing to set here.';

beforeAll(() => {
	registerKindItemRepositories();
	loadFormulateEnglish();
});

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

describe('Formulate Dynamic data values editor', () => {
	it('says what the US states are, and which part is stored, as there is nothing to set', async () => {
		const { description } = await render(await createDataValues(US_STATES));

		await expect
			.poll(description)
			.toBe(
				'The 50 states, Washington, D.C., American Samoa, Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin Islands, in alphabetical order. Visitors see each name, such as Alabama; its two-letter postal code, such as AL, is what is stored. Formulate makes these items itself, so there is nothing to set here.',
			);
	});

	it('says only that the kind makes its items for another kind, and outside a workspace', async () => {
		const other = await render(await createDataValues(LIST));
		const outside = await render(document.body);
		await other.element.updateComplete;

		expect([other.description(), outside.description()]).toStrictEqual([GENERIC, GENERIC]);
	});

	it('sends no change, so data values left alone are not changed', async () => {
		const host = await createDataValues(US_STATES);
		const element = new FormulateDynamicDataValuesEditorElement();
		const changes: Array<Event> = [];
		element.addEventListener('change', (event) => changes.push(event));

		host.append(element);
		await element.updateComplete;

		expect(changes).toStrictEqual([]);
		expect(element.value).toBeUndefined();
	});
});
