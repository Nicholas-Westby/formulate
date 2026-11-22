import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './repo.ts';

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

	// The class's own text: up to the brace that closes it.
	let depth = 1;
	let end = start.index + start[0].length;

	while (depth > 0 && end < source.length) {
		depth += source[end] === '{' ? 1 : source[end] === '}' ? -1 : 0;
		end++;
	}

	const body = source.slice(start.index + start[0].length, end - 1);
	const constants: Record<string, string> = {};

	for (const match of body.matchAll(/public\s+const\s+string\s+(\w+)\s*=\s*"([^"]*)"\s*;/g)) {
		constants[match[1]!] = match[2]!;
	}

	return constants;
}

/**
 * Send Data's transmission formats, from the server's own constants
 * (src/Formulate.Extensions.SendData/Constants.cs, Constants.TransmissionFormats).
 */
export function transmissionFormats(): Record<'QueryString' | 'FormBody' | 'Json' | 'HubSpotJson', string> {
	const source = readFileSync(join(REPO_ROOT, 'src', 'Formulate.Extensions.SendData', 'Constants.cs'), 'utf8');
	const { QueryString, FormBody, Json, HubSpotJson } = readStringConstants(source, 'TransmissionFormats');

	if (!QueryString || !FormBody || !Json || !HubSpotJson) {
		throw new Error('Constants.TransmissionFormats does not have the four transmission formats.');
	}

	return { QueryString, FormBody, Json, HubSpotJson };
}
