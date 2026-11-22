import { isSameGuid } from './guid.js';

/**
 * Whether two kind IDs are the same kind. GUIDs can come in either case, with or without dashes.
 * @param a A kind ID.
 * @param b Another kind ID.
 * @returns True for the same kind.
 */
export function isSameKind(a: string, b: string): boolean {
	return isSameGuid(a, b);
}
