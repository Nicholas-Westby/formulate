/** A GUID's 32 hex digits in lower case, without dashes or braces. */
function digitsOf(id: string): string {
	return id.replace(/[{}()-]/g, '').toLowerCase();
}

/**
 * Whether two GUIDs are the same. GUIDs come in either case, with or without dashes or braces: the server
 * reads them all, and Formulate 3 stored some without dashes, in upper case.
 * @param a A GUID.
 * @param b Another GUID.
 * @returns True for the same GUID; false when either is empty.
 */
export function isSameGuid(a: string, b: string): boolean {
	const digits = digitsOf(a);
	return digits !== '' && digits === digitsOf(b);
}
