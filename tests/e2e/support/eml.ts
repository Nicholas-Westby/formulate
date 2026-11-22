import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** An email, as far as the specs read it. */
export interface Email {
	/** Each header by its name in lower case, unfolded, with encoded words decoded. */
	headers: Record<string, string>;
	from: string;
	to: string;
	cc: string;
	bcc: string;
	subject: string;
	/** The HTML body, decoded, if the email has one. */
	html: string | undefined;
	/** The plain text body, decoded, if the email has one. */
	text: string | undefined;
	attachments: Array<{ fileName: string }>;
}

/** A part of an email: its headers and its body, as written. */
interface Part {
	headers: Record<string, string>;
	body: string;
}

/**
 * Reads an email as Umbraco writes it to its pickup folder (an .eml file, RFC 5322 and MIME): its headers, its
 * text and HTML bodies (quoted-printable and base64 decoded, as UTF-8), and the names of its attachments. Only
 * what the specs need: it is not a full MIME reader.
 * @param source The file's text.
 */
export function parseEmail(source: string): Email {
	const message = splitPart(source);
	const email: Email = {
		headers: message.headers,
		from: message.headers.from ?? '',
		to: message.headers.to ?? '',
		cc: message.headers.cc ?? '',
		bcc: message.headers.bcc ?? '',
		subject: message.headers.subject ?? '',
		html: undefined,
		text: undefined,
		attachments: [],
	};

	readBody(message, email);

	return email;
}

/**
 * Reads every email (.eml file) in a folder, in the order of their names; none when there is no folder.
 * Umbraco writes each file as SMTP would send it (MailKit's SmtpDataFilter), with a second dot in front of a
 * line that starts with a dot, so that dot is taken off.
 * @param folder The folder, such as Umbraco's pickup folder.
 */
export function readEmails(folder: string): Array<Email & { file: string }> {
	let names: Array<string>;

	try {
		names = readdirSync(folder).filter((name) => name.toLowerCase().endsWith('.eml')).sort();
	} catch {
		return [];
	}

	return names.map((name) => {
		const file = join(folder, name);
		return { ...parseEmail(readFileSync(file, 'utf8').replace(/^\./gm, '')), file };
	});
}

/**
 * The addresses in an address header, such as `Ada <ada@example.com>, team@example.com`, without their names; none
 * for an empty group such as `undisclosed-recipients:;`.
 */
export function addressesOf(header: string): Array<string> {
	return header.match(/[^\s<>,;:"]+@[^\s<>,;:"]+/g) ?? [];
}

/** Splits a part into its headers (unfolded, by lower case name) and its body. */
function splitPart(source: string): Part {
	const match = /\r?\n\r?\n/.exec(source);
	const head = match ? source.slice(0, match.index) : source;
	const body = match ? source.slice(match.index + match[0].length) : '';
	const headers: Record<string, string> = {};

	// A line that starts with white space goes on with the header before it.
	for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
		const colon = line.indexOf(':');

		if (colon > 0) {
			headers[line.slice(0, colon).trim().toLowerCase()] = decodeWords(line.slice(colon + 1).trim());
		}
	}

	return { headers, body };
}

/** Puts a part's text bodies and attachments into the email, going into the parts of a multipart part. */
function readBody(part: Part, email: Email) {
	const type = part.headers['content-type'] ?? 'text/plain';
	const mediaType = type.split(';')[0]!.trim().toLowerCase();

	if (mediaType.startsWith('multipart/')) {
		const boundary = parameter(type, 'boundary');

		if (!boundary) {
			return;
		}

		const delimiter = `--${boundary}`;
		const sections = part.body.split(new RegExp(`(?:^|\\r?\\n)${escapeRegExp(delimiter)}`));

		// The text before the first boundary is the preamble; the section after the closing boundary starts with "--".
		for (const section of sections.slice(1)) {
			if (section.startsWith('--')) {
				break;
			}

			readBody(splitPart(section.replace(/^[ \t]*\r?\n/, '')), email);
		}

		return;
	}

	const disposition = part.headers['content-disposition'] ?? '';
	const fileName = parameter(disposition, 'filename') ?? parameter(type, 'name');

	if (/^attachment/i.test(disposition) || (fileName && !mediaType.startsWith('text/'))) {
		email.attachments.push({ fileName: fileName ?? '' });
		return;
	}

	const text = decodeBody(part.body, part.headers['content-transfer-encoding']);

	if (mediaType === 'text/html') {
		email.html ??= text;
	} else if (mediaType === 'text/plain') {
		email.text ??= text;
	}
}

/** A body's text, decoded from its transfer encoding, as UTF-8. */
function decodeBody(body: string, encoding: string | undefined): string {
	switch (encoding?.trim().toLowerCase()) {
		case 'quoted-printable':
			return decodeQuotedPrintable(body).toString('utf8');
		case 'base64':
			return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
		default:
			return body;
	}
}

/** Quoted-printable's bytes: =XX is a byte, and = at the end of a line joins it with the next. */
function decodeQuotedPrintable(text: string): Buffer {
	const joined = text.replace(/=\r?\n/g, '');
	const bytes: Array<number> = [];

	for (let i = 0; i < joined.length; i++) {
		const hex = joined.slice(i + 1, i + 3);

		if (joined[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
			bytes.push(Number.parseInt(hex, 16));
			i += 2;
		} else {
			bytes.push(...Buffer.from(joined[i]!, 'utf8'));
		}
	}

	return Buffer.from(bytes);
}

/** Decodes the encoded words in a header (RFC 2047), such as =?utf-8?Q?Caf=C3=A9?=; white space between two goes. */
function decodeWords(value: string): string {
	return value
		.replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?)/g, '$1')
		.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, _charset: string, kind: string, text: string) =>
			kind.toUpperCase() === 'B'
				? Buffer.from(text, 'base64').toString('utf8')
				: decodeQuotedPrintable(text.replaceAll('_', ' ')).toString('utf8'),
		);
}

/** A parameter of a header, such as the boundary of a Content-Type. */
function parameter(header: string, name: string): string | undefined {
	const match = new RegExp(`;\\s*${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i').exec(header);

	return match ? (match[1] ?? match[2]) : undefined;
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
