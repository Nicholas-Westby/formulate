// Vite's import.meta.glob, which reads the sources as text.
/// <reference types="vite/types/importMeta.d.ts" />
import { describe, expect, it } from 'vitest';
import { manifests } from '../bundle.manifests.js';
import { EXPRESSION, readHtmlTemplates, writtenText } from '../test/templates.js';
import en from './en.js';

/** The back office's own sources, as text, by their paths: not its tests, their helpers or the generated API. */
const SOURCES = Object.fromEntries(
	Object.entries(
		import.meta.glob<string>(['../**/*.ts', '!../**/*.test.ts', '!../test/**', '!../api/**'], {
			query: '?raw',
			import: 'default',
			eager: true,
		}),
	).map(([path, source]) => [path.replace(/^\.\.\//, 'src/'), source]),
);

/** Each text a source's templates show as written, with the source and line it is on. */
function textAsWritten(sources: Record<string, string>) {
	return Object.entries(sources).flatMap(([path, source]) =>
		readHtmlTemplates(source).flatMap(({ line, text }) => writtenText(text).map((written) => `${path}:${line}: ${written}`)),
	);
}

describe("Formulate's screens", () => {
	it('show no text as written in their templates: each text comes from a term, so it can be translated', () => {
		expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
		expect(textAsWritten(SOURCES)).toStrictEqual([]);
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

	it('label their extensions with terms, as Umbraco does, but for property editors, whose names Umbraco does not translate', () => {
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
