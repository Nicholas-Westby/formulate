import { UmbChangeEvent } from '@umbraco-cms/backoffice/event';
import type { UmbPropertyEditorConfigCollection } from '@umbraco-cms/backoffice/property-editor';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormulateRichTextFieldEditorElement } from './rich-text-field-editor.element.js';

// Umbraco's rich text editor needs a browser's layout, which jsdom has not got: its element is left out,
// so these tests see what the editor gives it and what it stores when it changes.
vi.mock('@umbraco-cms/backoffice/tiptap', () => ({}));

/**
 * Stands in for Umbraco's rich text editor (umb-input-tiptap) as it takes its value. As Umbraco's does, it
 * makes its editor once it is shown; a value set after that goes into the editor (Tiptap's setContent), which
 * reports it as a change, as editing the text does.
 */
class TiptapInput extends HTMLElement {
	configuration?: UmbPropertyEditorConfigCollection;

	#value = '';

	get value() {
		return this.#value;
	}

	set value(value: string) {
		if (value !== this.#value) {
			this.#value = value;

			if (this.isConnected) {
				this.dispatchEvent(new UmbChangeEvent());
			}
		}
	}

	/** Changes the text as typing in the editor does. */
	type(html: string) {
		this.#value = html;
		this.dispatchEvent(new UmbChangeEvent());
	}
}

customElements.define('umb-input-tiptap', TiptapInput);

async function render(value: unknown, readonly = false) {
	const element = new FormulateRichTextFieldEditorElement();
	element.value = value;
	element.readonly = readonly;
	const changes: Array<unknown> = [];
	element.addEventListener('change', (event) => {
		changes.push(event instanceof UmbChangeEvent ? JSON.parse(JSON.stringify(element.value)) : 'not an UmbChangeEvent');
	});
	document.body.append(element);
	await element.updateComplete;

	return { element, changes, input: element.shadowRoot!.querySelector('umb-input-tiptap#text') as TiptapInput };
}

/** The settings the rich text editor is given, by alias. */
function settingsOf(input: TiptapInput) {
	return Object.fromEntries([...(input.configuration ?? [])].map(({ alias, value }) => [alias, value]));
}

afterEach(() => {
	document.body.replaceChildren();
});

// The server reads RichTextFieldConfiguration: { text } (the HTML).
describe('Formulate Rich Text field editor', () => {
	it("sets up the rich text editor as Umbraco's default Rich Text data type, but for blocks and pasted images", async () => {
		const { input } = await render({ text: null });

		expect(settingsOf(input)).toStrictEqual({
			// Umbraco's, but for Umb.Tiptap.Block and Umb.Tiptap.MediaUpload (after Image and Link).
			extensions: [
				'Umb.Tiptap.RichTextEssentials',
				'Umb.Tiptap.Anchor',
				'Umb.Tiptap.Blockquote',
				'Umb.Tiptap.Bold',
				'Umb.Tiptap.BulletList',
				'Umb.Tiptap.CodeBlock',
				'Umb.Tiptap.Embed',
				'Umb.Tiptap.Figure',
				'Umb.Tiptap.Heading',
				'Umb.Tiptap.HorizontalRule',
				'Umb.Tiptap.HtmlAttributeClass',
				'Umb.Tiptap.HtmlAttributeDataset',
				'Umb.Tiptap.HtmlAttributeId',
				'Umb.Tiptap.HtmlAttributeStyle',
				'Umb.Tiptap.HtmlTagDiv',
				'Umb.Tiptap.HtmlTagSpan',
				'Umb.Tiptap.Image',
				'Umb.Tiptap.Italic',
				'Umb.Tiptap.Link',
				'Umb.Tiptap.OrderedList',
				'Umb.Tiptap.Strike',
				'Umb.Tiptap.Subscript',
				'Umb.Tiptap.Superscript',
				'Umb.Tiptap.Table',
				'Umb.Tiptap.TextAlign',
				'Umb.Tiptap.TextDirection',
				'Umb.Tiptap.TextIndent',
				'Umb.Tiptap.TrailingNode',
				'Umb.Tiptap.Underline',
			],
			// Umbraco's, all of it.
			toolbar: [
				[
					['Umb.Tiptap.Toolbar.SourceEditor'],
					['Umb.Tiptap.Toolbar.Bold', 'Umb.Tiptap.Toolbar.Italic', 'Umb.Tiptap.Toolbar.Underline'],
					['Umb.Tiptap.Toolbar.TextAlignLeft', 'Umb.Tiptap.Toolbar.TextAlignCenter', 'Umb.Tiptap.Toolbar.TextAlignRight'],
					['Umb.Tiptap.Toolbar.BulletList', 'Umb.Tiptap.Toolbar.OrderedList'],
					['Umb.Tiptap.Toolbar.Blockquote', 'Umb.Tiptap.Toolbar.HorizontalRule'],
					['Umb.Tiptap.Toolbar.Link', 'Umb.Tiptap.Toolbar.Unlink'],
					['Umb.Tiptap.Toolbar.MediaPicker', 'Umb.Tiptap.Toolbar.EmbeddedMedia'],
				],
			],
			maxImageSize: 500,
			overlaySize: 'medium',
			// The Image and Vector Graphics media types.
			allowedMediaTypes: 'cc07b313-0843-4aa8-bbda-871c8da728c8,c4b1efcf-a9d5-41c4-9621-e9d273b52a9c',
		});
		expect(input.value).toBe('');
	});

	it('gives the rich text editor the HTML as it is stored, and stores nothing when it is shown', async () => {
		// Markup the rich text editor would write another way (<b> as <strong>) or drop (the iframe).
		const html = '<h2 class="intro">Hello</h2><p>Fill <b>this</b> in.</p><iframe src="https://www.example.com/video"></iframe>';
		const { element, input, changes } = await render({ text: html });
		await element.updateComplete;

		expect(input.value).toBe(html);
		expect(changes).toStrictEqual([]);
		expect(element.value).toStrictEqual({ text: html });
	});

	it('stores the HTML the rich text editor writes once the text is edited, keeping the settings it does not edit', async () => {
		const { element, input, changes } = await render({ text: '<p>Old</p>', other: true });

		input.type('<p>New</p>');
		await element.updateComplete;

		expect(changes).toStrictEqual([{ text: '<p>New</p>', other: true }]);
		// The editor is given what it wrote, so it takes in nothing new.
		expect(input.value).toBe('<p>New</p>');
	});

	it('makes the rich text editor read-only while the editor is', async () => {
		const { input } = await render({ text: '<p>x</p>' }, true);

		// The attribute, which the rich text editor reads into its readonly property.
		expect(input.hasAttribute('readonly')).toBe(true);
	});
});
