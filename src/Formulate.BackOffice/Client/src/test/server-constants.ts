import sendDataConstants from '../../../../Formulate.Extensions.SendData/Constants.cs?raw';
import emailViewPaths from '../../../../Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs?raw';

/**
 * The string constants of a C# class, by their names, from its source: each `public const string Name = "value";`
 * in the class's braces, not in classes nested in it. Enough for the server's small constant classes.
 * @param source The C# source.
 * @param className The class, such as TransmissionFormats.
 */
export function readStringConstants(source: string, className: string): Record<string, string> {
	const start = new RegExp(`\\bclass\\s+${className}\\b[^{]*\\{`).exec(source);

	if (!start) {
		throw new Error(`The source has no class ${className}.`);
	}

	// The class's own text: up to the brace that closes it, without the classes nested in it.
	let depth = 1;
	let body = '';

	for (let i = start.index + start[0].length; i < source.length && depth > 0; i++) {
		depth += source[i] === '{' ? 1 : source[i] === '}' ? -1 : 0;
		body += depth === 1 ? source[i] : ' ';
	}

	return Object.fromEntries([...body.matchAll(/public\s+const\s+string\s+(\w+)\s*=\s*"([^"]*)"\s*;/g)].map((match) => [match[1], match[2]]));
}

/** The server's constants the back office has to match, from the C# source. */
export const SERVER_CONSTANTS = {
	/** src/Formulate.Extensions.SendData/Constants.cs, Constants.TransmissionFormats. */
	transmissionFormats: readStringConstants(sendDataConstants, 'TransmissionFormats'),
	/** src/Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs. */
	emailViewPaths: readStringConstants(emailViewPaths, 'EmailViewPaths'),
};
