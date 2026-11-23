// Vite's import.meta.glob, which reads the sources as text.
/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vitest';
import { manifests } from '../bundle.manifests.js';
import { EXPRESSION, readHtmlTemplates, writtenText } from '../test/templates.js';
import en from './en.js';

/**
 * The back office's own sources, as text, by their paths: not its tests, their helpers or the generated API. The glob
 * gives a file in this folder as ./en.ts, and any other as ../forms/..., so both are given their path from the client.
 */
const SOURCES = Object.fromEntries(
	Object.entries(
		import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts', '!../test/**', '!../api/**'], {
			query: '?raw',
			import: 'default',
			eager: true,
		}),
	).map(([path, source]) => [path.replace(/^\.\.\//, 'src/').replace(/^\.\//, 'src/localization/'), source]),
);

/** Each text a source's templates show as written, with the source and line it is on. */
function textAsWritten(sources: Record<string, string>) {
	return Object.entries(sources).flatMap(([path, source]) =>
		readHtmlTemplates(source).flatMap(({ line, text }) => writtenText(text).map((written) => `${path}:${line}: ${written}`)),
	);
}

/** The properties that hold what people read or hear when code sets them: in a notification, a dialog or a manifest. */
const TEXT_PROPERTIES = ['headline', 'message', 'label', 'title', 'confirmLabel', 'text'];

/**
 * One of TEXT_PROPERTIES given a string that starts with a letter, as in headline: 'Deleted'. A term key
 * ('#formulate_x') starts with #, and a term (this.localize.term(...)) is not a string, so neither is found.
 */
const SET_AS_WRITTEN = new RegExp(String.raw`(?<![\w$.])(['"]?)(${TEXT_PROPERTIES.join('|')})\1\s*:\s*(['"\x60])(\p{L}.*?)\3`, 'gu');

/** A language's terms, such as src/localization/en.ts, which are text as written on purpose. */
const TERMS = /^src\/localization\/[a-z]{2}(?:-[a-z]{2})?\.ts$/i;

/** The labels of Formulate's property editor UIs, which Umbraco shows as written (see the last test). */
const PROPERTY_EDITOR_NAMES = (manifests as Array<{ type: string; meta?: { label?: unknown } }>)
	.filter((manifest) => manifest.type === 'propertyEditorUi')
	.map((manifest) => manifest.meta?.label)
	.filter((label): label is string => typeof label === 'string');

/**
 * Each text that a source's code sets as written in one of TEXT_PROPERTIES, with the source and line it is on. A
 * cheap scan, line by line: it leaves out the lines of comments, and does not read templates (see textAsWritten).
 * @param sources The sources, by their paths.
 * @param propertyEditorNames The labels of property editor UIs, which are left out.
 */
function textSetAsWritten(sources: Record<string, string>, propertyEditorNames: ReadonlyArray<string>) {
	return Object.entries(sources)
		.filter(([path]) => !TERMS.test(path))
		.flatMap(([path, source]) =>
			source.split('\n').flatMap((code, index) =>
				/^\s*(?:\/\/|\/\*|\*)/.test(code)
					? []
					: [...code.matchAll(SET_AS_WRITTEN)]
							.filter(([, , property, , text]) => !(property === 'label' && propertyEditorNames.includes(text!)))
							.map(([written]) => `${path}:${index + 1}: ${written}`),
			),
		);
}

describe("Formulate's screens", () => {
	it('show no text as written in their html templates, in the tags or the attributes people read or hear', () => {
		expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
		expect(textAsWritten(SOURCES)).toStrictEqual([]);
	});

	it('set no text as written in code, in the properties that hold what people read: each is a term', () => {
		expect(PROPERTY_EDITOR_NAMES).toStrictEqual(['Formulate Form Layout Picker']);
		expect(textSetAsWritten(SOURCES, PROPERTY_EDITOR_NAMES)).toStrictEqual([]);
	});

	it("find the text that code sets as written, but not a term key, a term or a property editor's name", () => {
		const sources = {
			'src/x.ts': [
				"this.#notifications.peek('positive', { data: { headline: 'Deleted', message: this.localize.term('formulate_x') } });",
				"const options = { 'title': '#formulate_title', confirmLabel: \"Delete\", text: `Sure, ${name}?` };",
				"// headline: 'Not code: a comment'",
				" * label: 'Not code: a line of a comment'",
				"const shown = open ? item.label : 'Closed';",
				"const meta = { label: 'Formulate Form Layout Picker', title: '', 'headline': 'Saved' };",
			].join('\n'),
			'src/localization/en.ts': "export default { formulate: { label: 'Label' } };",
		};

		expect(textSetAsWritten(sources, ['Formulate Form Layout Picker'])).toStrictEqual([
			"src/x.ts:1: headline: 'Deleted'",
			'src/x.ts:2: confirmLabel: "Delete"',
			'src/x.ts:2: text: `Sure, ${name}?`',
			"src/x.ts:6: 'headline': 'Saved'",
		]);
	});

	it('find the text as written in a template, in its tags and in the attributes people read or hear', () => {
		const source = [
			'// html`<p>Not a template: a comment</p>`',
			"const quote = 'html`<p>Not a template: a string</p>`';",
			'const slash = /`/.test(quote) ? 1 / 2 : 0;',
			'render() {',
			"\treturn html`<uui-button label=${this.localize.term('general_close')} look=\"primary\"></uui-button>",
			'\t\t<!-- A comment is not shown. -->',
			'\t\t<uui-box headline="Settings">${this.open ? html`<p>Open</p>` : nothing}</uui-box>',
			'\t\t<span>${count}&nbsp;·&nbsp;${total}</span>',
			"\t\t<uui-input placeholder='Type here' .value=${value} aria-label=${label}></uui-input>`;",
			'}',
		].join('\n');

		expect(readHtmlTemplates(source).map(({ line, text }) => [line, writtenText(text)])).toStrictEqual([
			[7, ['Open']],
			[5, ['headline="Settings"', "placeholder=\"Type here\""]],
		]);
		expect(readHtmlTemplates(source)[1]!.text).toContain(`label=${EXPRESSION} look="primary"`);
	});

	it('use only terms that the English terms have', () => {
		const english = en.formulate as Record<string, unknown>;
		const used = new Set(
			Object.values(SOURCES).flatMap((source) => [...source.matchAll(/['"`#]formulate_(\w+)/g)].map((match) => match[1]!)),
		);

		expect(used.size).toBeGreaterThan(100);
		expect([...used].filter((key) => !(key in english))).toStrictEqual([]);
	});

	// Umbraco labels its own property editor UIs as written, and its pickers sort and search them by that label.
	it('label their extensions with terms, as Umbraco does, but for property editor UIs, which Umbraco labels as written', () => {
		const labels = (manifests as Array<{ type: string; alias: string; meta?: Record<string, unknown> }>).flatMap((manifest) =>
			['label', 'headline', 'description', 'title']
				.map((key) => [key, manifest.meta?.[key]] as const)
				.filter(([, value]) => typeof value === 'string')
				.map(([key, value]) => ({ type: manifest.type, alias: manifest.alias, key, value: value as string })),
		);
		const notTerms = labels.filter(({ type, value }) => type !== 'propertyEditorUi' && !value.startsWith('#'));

		expect(labels.length).toBeGreaterThan(10);
		expect(notTerms).toStrictEqual([]);
	});
});
