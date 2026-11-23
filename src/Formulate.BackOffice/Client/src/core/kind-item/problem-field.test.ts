import { UmbApiError } from '@umbraco-cms/backoffice/resources';
import { describe, expect, it } from 'vitest';
import { findFieldProblem } from './problem-field.js';

/** The API's answer to a save with a name of spaces. */
const NAME_PROBLEM = { type: 'Error', title: 'Invalid request', status: 400, detail: 'name: The name is required.', field: 'name' };

describe('findFieldProblem', () => {
	it("finds the field in the API's error, which Umbraco's workspaces throw as the cause of their own", () => {
		const error = new Error('Entity Detail Repository failed saving', {
			cause: new UmbApiError(NAME_PROBLEM.detail, 400, null, NAME_PROBLEM),
		});

		expect(findFieldProblem(error)).toStrictEqual({ path: '$.name', message: 'The name is required.' });
	});

	it("finds the field in the error's message alone, which is all that Umbraco 18.0's workspaces throw", () => {
		expect(findFieldProblem('name: The name is required.')).toStrictEqual({ path: '$.name', message: 'The name is required.' });
		expect(findFieldProblem('templateId: The template does not exist.')).toStrictEqual({
			path: '$.templateId',
			message: 'The template does not exist.',
		});
	});

	it('finds no field in a message that names none the item has, or names none at all', () => {
		expect(findFieldProblem('kindId: Legacy data values can not be changed.')).toBeUndefined();
		expect(findFieldProblem('Repository did not return data after create.')).toBeUndefined();
		expect(findFieldProblem(undefined)).toBeUndefined();
	});
});
