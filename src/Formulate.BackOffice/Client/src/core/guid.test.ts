import { describe, expect, it } from 'vitest';
import { isSameGuid } from './guid.js';
import { isSameKind } from './kind-id.js';

// The server reads GUIDs in any of .NET's formats: Formulate 3 stored field IDs without dashes, in upper case.
describe('Formulate GUIDs', () => {
	it('are the same in either case, with or without dashes or braces', () => {
		const id = '17906580-86ea-440b-bc30-9e1b099f803b';

		expect(
			['1790658086EA440BBC309E1B099F803B', '{17906580-86EA-440B-BC30-9E1B099F803B}', id].map((other) => isSameGuid(id, other)),
		).toStrictEqual([true, true, true]);
		expect([isSameGuid(id, '27906580-86ea-440b-bc30-9e1b099f803b'), isSameGuid(id, ''), isSameGuid('', '')]).toStrictEqual([
			false,
			false,
			false,
		]);
	});

	it('of kinds are compared as GUIDs', () => {
		expect(isSameKind('{1790658086EA440BBC309E1B099F803B}', '17906580-86ea-440b-bc30-9e1b099f803b')).toBe(true);
	});
});
