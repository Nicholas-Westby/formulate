import { describe, expect, it } from 'vitest';
import { SERVER_CONSTANTS } from '../test/server-constants.js';
import en from './en.js';

/**
 * Text that the markdown of a property's description (Umbraco's UFM) does not show as written: an email
 * address or a URL becomes a link, and anything in angle brackets is taken for a link or HTML and loses its
 * brackets. In backticks (code), it shows as written.
 */
const NOT_AS_WRITTEN = /<[^>]*>|[\w.+-]+@[\w-]+\.[\w.-]+|https?:\/\/\S+/g;

describe('Formulate English terms', () => {
	it('show the examples in descriptions as written, in code', () => {
		const descriptions = Object.entries(en.formulate)
			.filter(([key]) => key.endsWith('Description'))
			.map(([key, term]) => [key, typeof term === 'function' ? (term as (path: string) => string)('~/Views/Example.cshtml') : term]);
		const notAsWritten = descriptions
			.map(([key, text]) => [key, text.replace(/`[^`]*`/g, '').match(NOT_AS_WRITTEN)])
			.filter(([, found]) => found !== null);

		expect(descriptions.length).toBeGreaterThan(30);
		expect(notAsWritten).toStrictEqual([]);
	});

	it("say that the whitelist limits the recipient fields' addresses, by the name the server reads it by", () => {
		// EmailRecipientResolver sends to an address from these fields only when Formulate:Email:Whitelist allows it.
		const setting = `${SERVER_CONSTANTS.emailSettings.SectionName}:Whitelist`;

		expect(setting).toBe('Formulate:Email:Whitelist');
		expect(en.formulate.recipientFieldsDescription).toContain(`\`${setting}\``);
	});
});
