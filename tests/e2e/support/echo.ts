import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** A request the dev site's echo received (src/Website/Composers/DevEchoComposer.cs writes one file for each). */
export interface EchoRecord {
	receivedAt: string;
	method: string;
	/** The request's path, such as /dev/echo/run-1/json. */
	path: string;
	/** The request's query string, with its "?", or "" when it has none. */
	query: string;
	/** The request's headers, by their names in lower case. */
	headers: Record<string, string>;
	/** The request's body, as UTF-8 text. */
	body: string;
	/** The record's file. */
	file: string;
}

/**
 * The requests the echo received under a path, in the order they arrived (the files are named by the time).
 * @param folder The echo's folder (runFolderPaths(...).echo).
 * @param pathPrefix The start of the requests' paths, such as /dev/echo/run-1/.
 */
export function readEchoRecords(folder: string, pathPrefix: string): Array<EchoRecord> {
	let names: Array<string>;

	try {
		names = readdirSync(folder).filter((name) => name.endsWith('.json')).sort();
	} catch {
		return [];
	}

	return names
		.map((name) => {
			const file = join(folder, name);
			return { ...(JSON.parse(readFileSync(file, 'utf8')) as Omit<EchoRecord, 'file'>), file };
		})
		.filter((record) => record.path.startsWith(pathPrefix));
}
