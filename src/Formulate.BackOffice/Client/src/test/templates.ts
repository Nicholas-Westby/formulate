/** Where an expression of a template was, in its text. */
export const EXPRESSION = '\u0000';

/** An html`` template of a source file: its text, with EXPRESSION in place of each of its expressions. */
export interface FormulateSourceTemplate {
	/** The line the template starts on, counted from 1. */
	line: number;
	text: string;
}

/**
 * Reads the html`` templates of a TypeScript source: the parts of each that Lit puts on the page as written, with
 * EXPRESSION where each expression goes. A template in an expression of another is a template of its own. Enough
 * for the back office's own sources: it skips comments, strings and regular expressions, and tells a regular
 * expression from a division by what comes before it, as tools that only read JavaScript do.
 * @param source The source.
 */
export function readHtmlTemplates(source: string): Array<FormulateSourceTemplate> {
	const templates: Array<FormulateSourceTemplate> = [];
	let i = 0;

	const lineAt = (index: number) => source.slice(0, index).split('\n').length;

	/** Whether the source has a word (html) right before the backtick at index. */
	const taggedHtml = (index: number) => /(?:^|[^\w$.])html\s*$/.test(source.slice(Math.max(0, index - 20), index));

	/** Whether a slash at index starts a regular expression, by the last character before it that is not a space. */
	const startsRegex = (index: number) => {
		const before = source.slice(0, index).trimEnd();
		return before === '' || /[(,=:[!&|?{};+\-*%<>~^]$/.test(before) || /\b(?:return|typeof|case|do|else|in|of)$/.test(before);
	};

	/** The index after a quoted string that starts at index. */
	const skipString = (index: number) => {
		const quote = source[index];
		let j = index + 1;

		while (j < source.length && source[j] !== quote) {
			j += source[j] === '\\' ? 2 : 1;
		}

		return j + 1;
	};

	/** The index after a regular expression that starts at index. */
	const skipRegex = (index: number) => {
		let j = index + 1;
		let inClass = false;

		while (j < source.length && (inClass || source[j] !== '/')) {
			if (source[j] === '\\') {
				j++;
			} else if (source[j] === '[') {
				inClass = true;
			} else if (source[j] === ']') {
				inClass = false;
			}

			j++;
		}

		return j + 1;
	};

	/** The index after a comment that starts at index, or index when none does. */
	const skipComment = (index: number) => {
		if (source.startsWith('//', index)) {
			const end = source.indexOf('\n', index);
			return end === -1 ? source.length : end;
		}

		if (source.startsWith('/*', index)) {
			const end = source.indexOf('*/', index + 2);
			return end === -1 ? source.length : end + 2;
		}

		return index;
	};

	/** The index after the code that starts at index and ends at a closing brace that it did not open (or the end). */
	const skipCode = (index: number, untilBrace: boolean): number => {
		let j = index;
		let depth = 0;

		while (j < source.length) {
			const char = source[j];
			const afterComment = skipComment(j);

			if (afterComment !== j) {
				j = afterComment;
			} else if (char === "'" || char === '"') {
				j = skipString(j);
			} else if (char === '`') {
				j = readTemplate(j);
			} else if (char === '/' && startsRegex(j)) {
				j = skipRegex(j);
			} else if (char === '{') {
				depth++;
				j++;
			} else if (char === '}') {
				if (untilBrace && depth === 0) {
					return j + 1;
				}

				depth--;
				j++;
			} else {
				j++;
			}
		}

		return j;
	};

	/** The index after the template literal that starts at index; an html template's text is kept. */
	const readTemplate = (index: number): number => {
		const html = taggedHtml(index);
		let text = '';
		let j = index + 1;

		while (j < source.length && source[j] !== '`') {
			if (source[j] === '\\') {
				text += source.slice(j, j + 2);
				j += 2;
			} else if (source.startsWith('${', j)) {
				text += EXPRESSION;
				j = skipCode(j + 2, true);
			} else {
				text += source[j];
				j++;
			}
		}

		if (html) {
			templates.push({ line: lineAt(index), text });
		}

		return j + 1;
	};

	i = skipCode(i, false);

	return templates;
}

/** The attributes that people read or hear: what a control says it is, and the text it shows. */
const VISIBLE_ATTRIBUTES = [
	'alt',
	'aria-description',
	'aria-label',
	'aria-placeholder',
	'aria-roledescription',
	'aria-valuetext',
	'caption',
	'confirm-label',
	'description',
	'firstlabel',
	'headline',
	'label',
	'lastlabel',
	'nextlabel',
	'placeholder',
	'previouslabel',
	'title',
];

/** A letter of any language. */
const LETTER = /\p{L}/u;

/**
 * The text a template shows as written: text between its tags, and the values of the attributes people read or
 * hear, where they have a letter. Text that comes from an expression, such as a term, is not text as written.
 * @param template The template's text, with EXPRESSION in place of its expressions.
 */
export function writtenText(template: string): Array<string> {
	const found: Array<string> = [];
	const withoutComments = template.replace(/<!--[\s\S]*?-->/g, ' ');
	const tags = /<\/?[a-zA-Z][^>]*>/g;

	for (const [tag] of withoutComments.matchAll(tags)) {
		for (const [, name, double, single, bare] of tag.matchAll(/\s([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
			const value = (double ?? single ?? bare ?? '').replaceAll(EXPRESSION, ' ');

			if (VISIBLE_ATTRIBUTES.includes(name!.toLowerCase()) && LETTER.test(value)) {
				found.push(`${name}="${value.trim()}"`);
			}
		}
	}

	const text = withoutComments
		.replace(tags, ' ')
		.replaceAll(EXPRESSION, ' ')
		// Character references, such as &nbsp;, are not words.
		.replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, ' ');

	for (const part of text.split(/\s{2,}|\n/)) {
		if (LETTER.test(part)) {
			found.push(part.trim());
		}
	}

	return found;
}
