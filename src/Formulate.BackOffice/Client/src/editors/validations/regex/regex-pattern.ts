/**
 * What is wrong with a regular expression, as the browser says it. The visitor's browser checks values
 * with the pattern (new RegExp(pattern), without flags), so a pattern it cannot read checks nothing there.
 * @param pattern The pattern.
 * @returns Why the browser cannot read the pattern, or undefined when it can.
 */
export function getPatternProblem(pattern: string): string | undefined {
	try {
		new RegExp(pattern);
		return undefined;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// Chromium repeats the pattern: "Invalid regular expression: /(/: Unterminated group".
		return message.replace(/^Invalid regular expression: \/.*\/[a-z]*: /s, '') || message;
	}
}
