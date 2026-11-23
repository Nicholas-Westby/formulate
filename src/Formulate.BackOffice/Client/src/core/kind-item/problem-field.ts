import { UmbApiError } from '@umbraco-cms/backoffice/resources';

/** The data path of each field of an item that the API can name in a problem, and an input shows. */
const FIELD_PATHS: Readonly<Record<string, string>> = {
	name: '$.name',
	alias: '$.alias',
	configuration: '$.configuration',
	// A layout's template.
	templateId: '$.templateId',
};

/** A problem the API reported for one field of an item. */
export interface FormulateFieldProblem {
	/** The data path of the field's input, such as $.name. */
	path: string;
	/** What is wrong, as the API says it, without the field name the API puts in front. */
	message: string;
}

/**
 * Finds the field a failed save is about. The API's ProblemDetails names the field in a `field`
 * extension and starts its detail with "field: ".
 * @param error What the save threw. Umbraco's workspaces throw an Error whose cause is the API's error, except in
 * Umbraco 18.0, whose workspaces throw only that error's message: the detail, such as "name: The name is required.".
 * @returns The field's input and the message to show on it, or undefined when no input is at fault.
 */
export function findFieldProblem(error: unknown): FormulateFieldProblem | undefined {
	if (typeof error === 'string') {
		return findFieldInDetail(error);
	}

	const cause = error instanceof Error ? error.cause : error;

	// isUmbApiError reads the error's name, so it needs an error to look at.
	if (!cause || !UmbApiError.isUmbApiError(cause)) {
		return undefined;
	}

	// ASP.NET writes the extensions of a ProblemDetails next to its standard members.
	const problem = cause.problemDetails as unknown as Record<string, unknown> | undefined;
	const extensions = problem?.extensions as Record<string, unknown> | undefined;
	const field = problem?.field ?? extensions?.field;
	const path = typeof field === 'string' ? FIELD_PATHS[field] : undefined;

	if (!path) {
		return undefined;
	}

	const detail = typeof problem?.detail === 'string' ? problem.detail : '';
	const prefix = `${field}: `;
	const message = detail.startsWith(prefix) ? detail.slice(prefix.length) : detail || String(problem?.title ?? '');

	return { path, message };
}

/** Finds the field a detail starts with, such as name in "name: The name is required.", if an input shows it. */
function findFieldInDetail(detail: string): FormulateFieldProblem | undefined {
	const match = /^(\w+): (.+)$/s.exec(detail);

	if (!match || !Object.hasOwn(FIELD_PATHS, match[1]!)) {
		return undefined;
	}

	return { path: FIELD_PATHS[match[1]!]!, message: match[2]! };
}
