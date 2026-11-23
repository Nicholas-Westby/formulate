import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import { FormulateDefinitionsContext } from '../core/definitions.context.js';
import type { FormulateKindEditorElementBase } from '../core/kind-editor.js';
import { createTestHost } from './test-host.js';

/** Waits for an element to show what it was given, and for what it reads from the fake API meanwhile. */
export async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 3; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** A back office host with the definitions context, which reads the definitions and Formulate's configuration. */
export function createDefinitionsHost() {
	const host = createTestHost();
	new FormulateDefinitionsContext(host);

	return host;
}

/**
 * Shows a kind editor in a back office host, as the kind editor slot does, and records the values it stores each
 * time it says it changed. The fake API is served first, such as with serveForms.
 * @param element The editor.
 * @param value Its value, as the API stores it.
 * @param options Whether it is read-only, and the host to show it in (by default, one with the definitions).
 */
export async function renderEditor<T extends FormulateKindEditorElementBase>(
	element: T,
	value: unknown,
	{ readonly = false, host = createDefinitionsHost() }: { readonly?: boolean; host?: HTMLElement } = {},
) {
	element.value = value;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? JSON.parse(JSON.stringify(element.value)) : 'not an UmbChangeEvent');
	});
	host.append(element);
	await settle(element);

	return { element, changes, shadow: element.shadowRoot! };
}
