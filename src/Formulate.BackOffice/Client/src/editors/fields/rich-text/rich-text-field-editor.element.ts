import { css, customElement, html } from '@umbraco-cms/backoffice/external/lit';
import { UmbPropertyEditorConfigCollection } from '@umbraco-cms/backoffice/property-editor';
import { UmbTextStyles } from '@umbraco-cms/backoffice/style';
import '@umbraco-cms/backoffice/tiptap';
import { FormulateKindEditorElementBase, readSettings, readText } from '../../../core/kind-editor.js';
import { FORMULATE_SETTINGS_STYLES } from '../../../core/settings-styles.js';

/**
 * The settings of Umbraco's default Rich Text data type, which are the same on Umbraco 17.8 to 19: its
 * toolbar, its extensions, the largest size of an image it inserts, the size of its link dialog, and the media
 * types its media picker offers (Image and Vector Graphics). Two of its extensions are left out, as they work
 * only in a document's rich text: Block, whose blocks need the document's block settings and are stored
 * apart from its HTML, and Media Upload, which uploads a pasted or dropped image as a temporary file that only
 * the save of a document turns into media (here, the HTML would keep the file's address in the browser).
 */
const CONFIGURATION = [
	{
		alias: 'extensions',
		value: [
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
	},
	{
		alias: 'toolbar',
		value: [
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
	},
	{ alias: 'maxImageSize', value: 500 },
	{ alias: 'overlaySize', value: 'medium' },
	{ alias: 'allowedMediaTypes', value: 'cc07b313-0843-4aa8-bbda-871c8da728c8,c4b1efcf-a9d5-41c4-9621-e9d273b52a9c' },
];

/**
 * The editor of the Rich Text field, { text }: the formatted text the form shows, as HTML, in Umbraco's rich
 * text editor, set up as Umbraco's default Rich Text data type is. The stored HTML is given to the editor as it
 * is, and stored again only once it is edited, as the editor writes it.
 */
@customElement('formulate-rich-text-field-editor')
export class FormulateRichTextFieldEditorElement extends FormulateKindEditorElementBase {
	#configuration = new UmbPropertyEditorConfigCollection(CONFIGURATION);

	#onChange(event: Event) {
		const input = event.target as HTMLElement & { value?: string };
		this.updateValue({ ...readSettings(this.value), text: input.value ?? '' });
	}

	override render() {
		const label = this.localize.term('formulate_text');

		return html`
			<umb-property-layout label=${label} description=${this.localize.term('formulate_richTextDescription')} orientation="vertical">
				<umb-input-tiptap
					slot="editor"
					id="text"
					label=${label}
					.configuration=${this.#configuration}
					.value=${readText(readSettings(this.value), 'text')}
					?readonly=${this.readonly}
					@change=${this.#onChange}></umb-input-tiptap>
			</umb-property-layout>
		`;
	}

	static override styles = [
		UmbTextStyles,
		FORMULATE_SETTINGS_STYLES,
		css`
			/* As tall as Formulate 4's editor. */
			umb-input-tiptap {
				--umb-rte-min-height: 250px;
			}
		`,
	];
}

export { FormulateRichTextFieldEditorElement as element };

declare global {
	interface HTMLElementTagNameMap {
		'formulate-rich-text-field-editor': FormulateRichTextFieldEditorElement;
	}
}
