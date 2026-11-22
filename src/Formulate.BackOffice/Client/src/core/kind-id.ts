/**
 * Whether two kind IDs are the same kind. GUIDs can come in either case, with or without dashes.
 * @param a A kind ID.
 * @param b Another kind ID.
 * @returns True for the same kind.
 */
export function isSameKind(a: string, b: string): boolean {
	const normalize = (id: string) => id.replace(/-/g, '').toLowerCase();
	return normalize(a) === normalize(b);
}
