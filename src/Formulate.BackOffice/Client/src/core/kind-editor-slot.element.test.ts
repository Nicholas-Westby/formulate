import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import type { UmbConditionConfigBase } from '@umbraco-cms/backoffice/extension-api';
import { UmbConditionBase, umbExtensionsRegistry } from '@umbraco-cms/backoffice/extension-registry';
import { customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestHost } from '../test/test-host.js';
import type { ManifestFormulateKindEditor } from './extension-types.js';
import { FormulateKindEditorElementBase, type FormulateKindEditorContext } from './kind-editor.js';
import { FormulateKindEditorSlotElement } from './kind-editor-slot.element.js';

/** A kind editor as another package would write one: it shows its value and can change it. */
@customElement('formulate-test-kind-editor')
class FormulateTestKindEditorElement extends FormulateKindEditorElementBase<{ text?: string }> {
	change(text: string) {
		this.updateValue({ ...this.value, text });
	}

	override render() {
		return html`<span id="text">${this.value?.text}</span>`;
	}
}

/** A condition that never allows what it is set on, as a condition of another package might not here. */
class FormulateTestNeverCondition extends UmbConditionBase<UmbConditionConfigBase> {}

const REGISTERED: Array<string> = [];

/** Registers a kind editor manifest for the test, as another package's bundle would. */
function register(manifest: Omit<ManifestFormulateKindEditor, 'element' | 'name'> & { name?: string }) {
	umbExtensionsRegistry.register({
		name: manifest.alias,
		element: FormulateTestKindEditorElement,
		...manifest,
	} as ManifestFormulateKindEditor);
	REGISTERED.push(manifest.alias);
}

/** Registers a kind editor whose element module exports no element, as a broken build of a package gives. */
function registerBroken(alias: string, editorAlias: string) {
	umbExtensionsRegistry.register({
		type: 'formulateValidationEditor',
		alias,
		name: alias,
		element: () => Promise.resolve({}),
		meta: { editorAlias },
	} as ManifestFormulateKindEditor);
	REGISTERED.push(alias);
}

/** Shows a slot in a back office host, and records the values it reports as changed. */
async function renderSlot(props: {
	type: FormulateKindEditorSlotElement['type'];
	editorAlias?: string | null;
	value?: unknown;
	context?: FormulateKindEditorContext;
	readonly?: boolean;
}) {
	const slot = new FormulateKindEditorSlotElement();
	Object.assign(slot, props);
	const changes: Array<unknown> = [];
	slot.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? slot.value : 'not an UmbChangeEvent');
	});
	createTestHost().append(slot);
	await slot.updateComplete;

	const editor = () => slot.shadowRoot!.querySelector('formulate-test-kind-editor') as FormulateTestKindEditorElement | null;
	const noSettings = () => slot.shadowRoot!.querySelector('#no-settings');
	const notAvailable = () => slot.shadowRoot!.querySelector('#not-available');

	return { slot, changes, editor, noSettings, notAvailable };
}

afterEach(() => {
	umbExtensionsRegistry.unregisterMany(REGISTERED.splice(0));
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('Formulate kind editor slot', () => {
	it("shows the editor whose manifest has the definition's editor alias, with the value and context", async () => {
		register({ type: 'formulateValidationEditor', alias: 'Test.Editor.Other', meta: { editorAlias: 'test-other' } });
		register({ type: 'formulateValidationEditor', alias: 'Test.Editor.Wanted', meta: { editorAlias: 'test-wanted' } });
		// The same editor alias for another extension type is not this slot's.
		register({ type: 'formulateFieldEditor', alias: 'Test.Editor.Field', meta: { editorAlias: 'test-wanted' } });

		const { editor } = await renderSlot({
			type: 'formulateValidationEditor',
			editorAlias: 'test-wanted',
			value: { text: 'Hello' },
			context: { formId: 'f1' },
		});

		await expect.poll(() => editor()).not.toBeNull();
		await editor()!.updateComplete;
		expect(editor()!.manifest?.alias).toBe('Test.Editor.Wanted');
		expect(editor()!.value).toStrictEqual({ text: 'Hello' });
		expect(editor()!.context).toStrictEqual({ formId: 'f1' });
		expect(editor()!.readonly).toBe(false);
		expect(editor()!.shadowRoot!.querySelector('#text')?.textContent).toBe('Hello');
	});

	it("reports the editor's change as its own, with the editor's new value", async () => {
		register({ type: 'formulateDataValuesEditor', alias: 'Test.Editor.DataValues', meta: { editorAlias: 'test-data-values' } });
		const { slot, editor, changes } = await renderSlot({
			type: 'formulateDataValuesEditor',
			editorAlias: 'test-data-values',
			value: { text: 'one', other: 1 },
		});
		await expect.poll(() => editor()).not.toBeNull();

		editor()!.change('two');

		expect(changes).toStrictEqual([{ text: 'two', other: 1 }]);
		expect(slot.value).toStrictEqual({ text: 'two', other: 1 });
	});

	it('gives the editor a new value, context and read-only state when they change', async () => {
		register({ type: 'formulateValidationEditor', alias: 'Test.Editor.Validation', meta: { editorAlias: 'test-validation' } });
		const { slot, editor } = await renderSlot({ type: 'formulateValidationEditor', editorAlias: 'test-validation', value: { text: 'a' } });
		await expect.poll(() => editor()).not.toBeNull();

		slot.value = { text: 'b' };
		slot.context = { formFields: [] };
		slot.readonly = true;
		await slot.updateComplete;

		expect([editor()!.value, editor()!.context, editor()!.readonly]).toStrictEqual([{ text: 'b' }, { formFields: [] }, true]);
	});

	it('says there are no settings when no editor has the alias, and leaves the value alone', async () => {
		register({ type: 'formulateValidationEditor', alias: 'Test.Editor.Validation', meta: { editorAlias: 'test-validation' } });
		const unknownConfiguration = { anything: ['the', 'kind', 'stores'] };

		const { slot, noSettings, editor, changes } = await renderSlot({
			type: 'formulateValidationEditor',
			editorAlias: 'not-installed',
			value: unknownConfiguration,
		});

		await expect.poll(() => noSettings()).not.toBeNull();
		// Without the back office's translations loaded, a term shows as its key.
		expect(noSettings()!.textContent?.trim()).toBe('formulate_noSettings');
		expect(editor()).toBeNull();
		expect(changes).toStrictEqual([]);
		expect(slot.value).toBe(unknownConfiguration);
	});

	it('says there are no settings for a kind without an editor alias', async () => {
		const { noSettings } = await renderSlot({ type: 'formulateDataValuesEditor', editorAlias: null, value: null });

		await expect.poll(() => noSettings()).not.toBeNull();
	});

	it('shows an editor registered after the slot, such as by a package that loads later', async () => {
		const { editor, noSettings } = await renderSlot({
			type: 'formulateHandlerEditor',
			editorAlias: 'test-late',
			value: { text: 'late' },
		});
		await expect.poll(() => noSettings()).not.toBeNull();

		register({ type: 'formulateHandlerEditor', alias: 'Test.Editor.Late', meta: { editorAlias: 'test-late' } });

		await expect.poll(() => editor()).not.toBeNull();
		expect(noSettings()).toBeNull();
		expect(editor()!.value).toStrictEqual({ text: 'late' });
	});

	it("adopts only the editor's own change, not a native change from an element inside it", async () => {
		register({ type: 'formulateValidationEditor', alias: 'Test.Editor.Native', meta: { editorAlias: 'test-native' } });
		const { slot, editor, changes } = await renderSlot({
			type: 'formulateValidationEditor',
			editorAlias: 'test-native',
			value: { text: 'kept' },
		});
		await expect.poll(() => editor()).not.toBeNull();
		await editor()!.updateComplete;
		const inside = editor()!.shadowRoot!.querySelector('#text')!;
		const child = editor()!.appendChild(document.createElement('input'));

		// From the editor's shadow root, as a native input's; one that is composed, so it leaves the editor;
		// and one from the editor's light DOM.
		inside.dispatchEvent(new Event('change', { bubbles: true }));
		inside.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
		child.dispatchEvent(new Event('change', { bubbles: true }));

		expect(slot.value).toStrictEqual({ text: 'kept' });
		// The slot says nothing changed. The composed one passes the slot as it is, as Umbraco's property lets it.
		expect(changes).toStrictEqual(['not an UmbChangeEvent']);

		editor()!.change('new');

		expect(changes).toStrictEqual(['not an UmbChangeEvent', { text: 'new' }]);
	});

	it('takes no change while read-only, and shows the editor the value again', async () => {
		register({ type: 'formulateDataValuesEditor', alias: 'Test.Editor.ReadOnly', meta: { editorAlias: 'test-read-only' } });
		const stored = { text: 'old' };
		const { slot, editor, changes } = await renderSlot({
			type: 'formulateDataValuesEditor',
			editorAlias: 'test-read-only',
			value: stored,
			readonly: true,
		});
		await expect.poll(() => editor()).not.toBeNull();

		// An editor that changes its value anyway, as a careless one might.
		editor()!.change('new');
		await editor()!.updateComplete;

		expect(changes).toStrictEqual([]);
		expect(slot.value).toBe(stored);
		expect(editor()!.value).toBe(stored);
		expect(editor()!.shadowRoot!.querySelector('#text')?.textContent).toBe('old');
	});

	it("says an editor whose element does not load is not available, logs why, and leaves the value alone", async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		umbExtensionsRegistry.register({
			type: 'formulateValidationEditor',
			alias: 'Test.Editor.Broken',
			name: 'Test.Editor.Broken',
			// A module without the element, as a broken build of a package gives.
			element: () => Promise.resolve({}),
			meta: { editorAlias: 'test-broken' },
		} as ManifestFormulateKindEditor);
		REGISTERED.push('Test.Editor.Broken');
		const configuration = { text: 'kept' };

		const { slot, notAvailable, noSettings, changes } = await renderSlot({
			type: 'formulateValidationEditor',
			editorAlias: 'test-broken',
			value: configuration,
		});

		await expect.poll(() => notAvailable(), { timeout: 3000 }).not.toBeNull();
		// Without the back office's translations loaded, a term shows as its key; not "No settings".
		expect(notAvailable()!.textContent?.trim()).toBe('formulate_editorNotAvailable');
		expect(noSettings()).toBeNull();
		expect(warn).toHaveBeenCalledWith(
			'Formulate: the formulateValidationEditor with the editor alias "test-broken" is not available, so the kind\'s settings are not shown. They are kept as they are.',
			['Test.Editor.Broken: its element module exports no element.'],
		);
		expect(changes).toStrictEqual([]);
		expect(slot.value).toBe(configuration);
	});

	it('says an editor whose conditions do not allow it is not available', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		umbExtensionsRegistry.register({
			type: 'condition',
			alias: 'Test.Condition.Never',
			name: 'Test.Condition.Never',
			api: FormulateTestNeverCondition,
		});
		REGISTERED.push('Test.Condition.Never');
		register({
			type: 'formulateHandlerEditor',
			alias: 'Test.Editor.NotHere',
			meta: { editorAlias: 'test-not-here' },
			conditions: [{ alias: 'Test.Condition.Never' }],
		});

		const { notAvailable, editor } = await renderSlot({ type: 'formulateHandlerEditor', editorAlias: 'test-not-here', value: {} });

		await expect.poll(() => notAvailable(), { timeout: 3000 }).not.toBeNull();
		expect(editor()).toBeNull();
		expect(warn.mock.calls.at(-1)?.[1]).toStrictEqual(['Test.Editor.NotHere: its conditions do not allow it here.']);
	});

	it('logs that an editor is not available once for its alias, however many slots show it', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		registerBroken('Test.Editor.BrokenTwice', 'test-broken-twice');

		const first = await renderSlot({ type: 'formulateValidationEditor', editorAlias: 'test-broken-twice', value: {} });
		await expect.poll(() => first.notAvailable(), { timeout: 3000 }).not.toBeNull();
		// Another field of the kind, or the same dialog opened again.
		const second = await renderSlot({ type: 'formulateValidationEditor', editorAlias: 'test-broken-twice', value: {} });
		await expect.poll(() => second.notAvailable(), { timeout: 3000 }).not.toBeNull();

		expect(warn.mock.calls.filter(([message]) => String(message).includes('"test-broken-twice"'))).toHaveLength(1);
	});

	it('clears its timer when it is taken out of the page, and checks again when it is shown again', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const timers = vi.spyOn(globalThis, 'setTimeout');
		const cleared = vi.spyOn(globalThis, 'clearTimeout');
		registerBroken('Test.Editor.BrokenGone', 'test-broken-gone');
		const { slot, notAvailable } = await renderSlot({ type: 'formulateValidationEditor', editorAlias: 'test-broken-gone', value: {} });
		const host = slot.parentElement!;
		// The slot's own warnings, not core's about the broken manifest.
		const warned = () => warn.mock.calls.filter(([message]) => String(message).startsWith('Formulate:'));

		// The slot waits for the editor to be shown, then says it is not available.
		const timerIndex = await vi.waitFor(() => {
			const index = timers.mock.calls.findIndex(([, delay]) => delay === 500);
			expect(index).toBeGreaterThanOrEqual(0);
			return index;
		});
		slot.remove();
		expect(cleared).toHaveBeenCalledWith(timers.mock.results[timerIndex]!.value);

		await new Promise((resolve) => setTimeout(resolve, 700));
		expect(warned()).toStrictEqual([]);
		expect(notAvailable()).toBeNull();

		host.append(slot);
		await expect.poll(() => notAvailable(), { timeout: 3000 }).not.toBeNull();
		expect(warned()).toHaveLength(1);
	});

	it('changes to the matching editor when the editor alias changes', async () => {
		register({ type: 'formulateLayoutEditor', alias: 'Test.Editor.First', meta: { editorAlias: 'test-first' } });
		register({ type: 'formulateLayoutEditor', alias: 'Test.Editor.Second', meta: { editorAlias: 'test-second' } });
		const { slot, editor } = await renderSlot({ type: 'formulateLayoutEditor', editorAlias: 'test-first', value: {} });
		await expect.poll(() => editor()?.manifest?.alias).toBe('Test.Editor.First');

		slot.editorAlias = 'test-second';

		await expect.poll(() => editor()?.manifest?.alias).toBe('Test.Editor.Second');
	});
});
