import { setTimeout as sleepFor } from 'node:timers/promises';
import { type LogEvent, readSiteLog, seedLines } from './site-log.ts';

/** How long a test that needs the dev site's seeded page waits for "/" to serve it. */
export const SEEDED_PAGE_WAIT_MS = 180_000;

/** How long one request for "/" may take. */
export const SEEDED_PAGE_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The `seededPage` fixture's own timeout: the wait, its last request and room to spare. It must outlast them, or
 * Playwright ends the fixture first and says "Test timeout of 60000ms exceeded", the test's timeout, although the
 * fixture had waited for the whole of its own.
 */
export const SEEDED_PAGE_FIXTURE_TIMEOUT_MS = SEEDED_PAGE_WAIT_MS + SEEDED_PAGE_REQUEST_TIMEOUT_MS + 15_000;

/** What one request for "/" found. */
export interface SeededPageAnswer {
	/** Whether "/" served the seeded page. */
	served: boolean;
	/** What it answered, for the failure, such as "200, without the page", "503" or why the request failed. */
	answer: string;
}

export interface SeededPageWaitOptions {
	/** How long to wait, in milliseconds. */
	waitMs: number;
	/** The site's log folder: a failure says what the seed logged last there. */
	logFolder?: string;
	/** Reads a log folder's events (default: readSiteLog). */
	readLog?: (folder: string) => Array<LogEvent>;
	/** The clock (default: Date.now). */
	now?: () => number;
	/** Waits between two requests (default: a timer). */
	sleep?: (ms: number) => Promise<void>;
}

/**
 * Asks for "/" once a second until it serves the dev site's seeded page. If it has not within the wait, fails
 * with what it waited for, for how long, what "/" answered last and the seed's last line in the site log.
 * @param ask Asks for "/" once.
 * @param options How long to wait, and where the site log is.
 */
export async function waitForSeededPage(ask: () => Promise<SeededPageAnswer>, options: SeededPageWaitOptions): Promise<void> {
	const now = options.now ?? Date.now;
	const sleep = options.sleep ?? ((ms: number) => sleepFor(ms));
	const start = now();

	for (;;) {
		const { served, answer } = await ask();

		if (served) {
			return;
		}

		const waited = now() - start;

		if (waited >= options.waitMs) {
			throw new Error(missingPageMessage(waited, answer, options));
		}

		await sleep(Math.min(1000, options.waitMs - waited));
	}
}

function missingPageMessage(waitedMs: number, answer: string, options: SeededPageWaitOptions): string {
	const message = `Waited ${Math.round(waitedMs / 1000)} s for "/" to serve the seeded Contact Us page, and it did not. Its last answer: ${answer}.`;

	if (!options.logFolder) {
		return message;
	}

	const lastLine = seedLines((options.readLog ?? readSiteLog)(options.logFolder)).at(-1);

	return lastLine === undefined
		? `${message} The site log (${options.logFolder}) has no line from the seed.`
		: `${message} The dev site's seed makes the page when the site starts; its last line in the site log (${options.logFolder}) was: "${lastLine}"`;
}
