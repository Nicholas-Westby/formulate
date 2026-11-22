import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** One event in Umbraco's log file (Serilog's compact JSON: one object per line, properties at the top). */
export type LogEvent = Record<string, unknown>;

/** The logger of the dev site's start-up lines about Formulate (src/Website/Composers/LoadedFormulateComposer.cs). */
export const LOADED_FORMULATE_LOGGER = 'Website.Composers.LoadedFormulateLogger';

/** The logger of the dev site's seed, which makes the test page (src/Website/Seed/FormulateTestContentComposer.cs). */
export const SEED_LOGGER = 'Website.Seed.FormulateTestContentSeeder';

/** What the dev site logged at start-up about the Formulate it runs. */
export interface LoadedFormulate {
	/** Each Formulate assembly it loaded, with its informational version and file. */
	assemblies: Array<{ name: string; version: string; location: string }>;
	/** The file it serves the back office script from, if it logged one. */
	backOfficeScript?: string;
}

/**
 * Reads the events of a log file's text. A line that is not JSON, such as a last line the site is still
 * writing, is left out.
 * @param text The file's text.
 */
export function parseSiteLog(text: string): Array<LogEvent> {
	const events: Array<LogEvent> = [];

	for (const line of text.split(/\r?\n/)) {
		if (line.trim() === '') {
			continue;
		}

		try {
			const event: unknown = JSON.parse(line);

			if (event && typeof event === 'object' && !Array.isArray(event)) {
				events.push(event as LogEvent);
			}
		} catch {
			// Not a whole event (yet).
		}
	}

	return events;
}

/**
 * Reads the events of every Umbraco log file (UmbracoTraceLog.*.json) in a folder, or none if the folder
 * does not exist yet.
 * @param folder The site's log folder (Umbraco:CMS:Logging:Directory).
 */
export function readSiteLog(folder: string): Array<LogEvent> {
	let names: Array<string>;

	try {
		names = readdirSync(folder);
	} catch {
		return [];
	}

	return names
		.filter((name) => /^UmbracoTraceLog\..*\.json$/.test(name))
		.sort()
		.flatMap((name) => parseSiteLog(readFileSync(join(folder, name), 'utf8')));
}

/**
 * Picks out the dev site's start-up lines about Formulate. If the site started more than once, the back
 * office script is the one it logged last, and every assembly line is kept.
 * @param events The log's events.
 */
export function loadedFormulate(events: Array<LogEvent>): LoadedFormulate {
	const result: LoadedFormulate = { assemblies: [] };

	for (const event of events) {
		if (event.SourceContext !== LOADED_FORMULATE_LOGGER) {
			continue;
		}

		if (typeof event.FormulateAssembly === 'string') {
			result.assemblies.push({
				name: event.FormulateAssembly,
				version: String(event.FormulateVersion ?? ''),
				location: String(event.FormulateAssemblyLocation ?? ''),
			});
		} else if (typeof event.FormulateBackOfficeScript === 'string') {
			result.backOfficeScript = event.FormulateBackOfficeScript;
		}
	}

	return result;
}

/**
 * The seed's lines, in the order it logged them, each with its values filled in as the console shows it.
 * @param events The log's events.
 */
export function seedLines(events: Array<LogEvent>): Array<string> {
	return events.filter((event) => event.SourceContext === SEED_LOGGER).map(messageOf);
}

/**
 * An event's message: its template with each {Name} replaced by the event's value of that name. A name the event
 * has no value for is left as it is.
 * @param event The event.
 */
function messageOf(event: LogEvent): string {
	const template = typeof event['@mt'] === 'string' ? event['@mt'] : '';

	return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (placeholder, name: string) =>
		name in event ? String(event[name]) : placeholder,
	);
}
