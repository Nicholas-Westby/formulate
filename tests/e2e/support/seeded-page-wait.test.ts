import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	SEEDED_PAGE_FIXTURE_TIMEOUT_MS,
	SEEDED_PAGE_REQUEST_TIMEOUT_MS,
	SEEDED_PAGE_WAIT_MS,
	type SeededPageAnswer,
	waitForSeededPage,
} from './seeded-page-wait.ts';
import { parseSiteLog } from './site-log.ts';

const LOG_FOLDER = '/tmp/formulate-e2e-1/Logs';

/** A site log with the seed's lines of a start whose seed gave up, and a line from another logger. */
const FAILED_SEED_LOG = parseSiteLog(
	[
		'{"@t":"2026-11-22T23:12:46.7Z","@mt":"Seeding the Formulate test content (attempt {Attempt}).","Attempt":1,"SourceContext":"Website.Seed.FormulateTestContentSeeder"}',
		'{"@t":"2026-11-22T23:12:47.1Z","@mt":"Notifications can not be sent","@l":"Warning","SourceContext":"Umbraco.Cms.Core.Events.UserNotificationsHandler.Notifier"}',
		'{"@t":"2026-11-22T23:50:12.4Z","@mt":"The Formulate test content could not be made.","@l":"Error","SourceContext":"Website.Seed.FormulateTestContentSeeder"}',
	].join('\n'),
);

/** A clock that moves only when the wait pauses, and a record of each pause. */
function fakeClock() {
	let time = 1_000_000;
	const pauses: Array<number> = [];

	return {
		pauses,
		now: () => time,
		sleep: async (ms: number) => {
			pauses.push(ms);
			time += ms;
		},
	};
}

/** "/" answering with each of these in turn, then with the last one again and again. */
function answers(...list: Array<SeededPageAnswer>) {
	let asked = 0;

	return {
		asked: () => asked,
		ask: async () => list[Math.min(asked++, list.length - 1)]!,
	};
}

const NOT_THERE: SeededPageAnswer = { served: false, answer: '200, without the page' };
const THERE: SeededPageAnswer = { served: true, answer: 'the page' };

test('a test that needs the seeded page goes on at once when "/" serves it', async () => {
	const clock = fakeClock();
	const site = answers(THERE);

	await waitForSeededPage(site.ask, { waitMs: SEEDED_PAGE_WAIT_MS, now: clock.now, sleep: clock.sleep });

	assert.equal(site.asked(), 1);
	assert.deepEqual(clock.pauses, []);
});

test('"/" is asked again, a second apart, until it serves the seeded page', async () => {
	const clock = fakeClock();
	const site = answers(NOT_THERE, { served: false, answer: '503' }, THERE);

	await waitForSeededPage(site.ask, { waitMs: SEEDED_PAGE_WAIT_MS, now: clock.now, sleep: clock.sleep });

	assert.equal(site.asked(), 3);
	assert.deepEqual(clock.pauses, [1000, 1000]);
});

test("a seeded page that never comes fails with what was waited for, for how long, the last answer and the seed's last line", async () => {
	const clock = fakeClock();
	const site = answers(NOT_THERE);

	await assert.rejects(
		waitForSeededPage(site.ask, {
			waitMs: SEEDED_PAGE_WAIT_MS,
			logFolder: LOG_FOLDER,
			readLog: () => FAILED_SEED_LOG,
			now: clock.now,
			sleep: clock.sleep,
		}),
		{
			message:
				'Waited 180 s for "/" to serve the seeded Contact Us page, and it did not. Its last answer: 200, without the page. ' +
				'The dev site\'s seed makes the page when the site starts; its last line in the site log (/tmp/formulate-e2e-1/Logs) was: ' +
				'"The Formulate test content could not be made."',
		},
	);
	// It never waits past its time.
	assert.equal(clock.pauses.reduce((sum, ms) => sum + ms, 0), SEEDED_PAGE_WAIT_MS);
});

test('when the site log has no line from the seed, the failure says so', async () => {
	const clock = fakeClock();

	await assert.rejects(
		waitForSeededPage(answers({ served: false, answer: 'the request failed: connect ECONNREFUSED ::1:44331' }).ask, {
			waitMs: 5000,
			logFolder: LOG_FOLDER,
			readLog: () => [],
			now: clock.now,
			sleep: clock.sleep,
		}),
		{
			message:
				'Waited 5 s for "/" to serve the seeded Contact Us page, and it did not. Its last answer: the request failed: ' +
				'connect ECONNREFUSED ::1:44331. The site log (/tmp/formulate-e2e-1/Logs) has no line from the seed.',
		},
	);
});

test("the fixture's own timeout outlasts the wait and its last request, so the wait's failure is the one shown", () => {
	// When a fixture's timeout runs out first, Playwright says "Test timeout of 60000ms exceeded", the test's
	// timeout, although the fixture had waited for its own, longer one.
	assert.ok(SEEDED_PAGE_FIXTURE_TIMEOUT_MS >= SEEDED_PAGE_WAIT_MS + SEEDED_PAGE_REQUEST_TIMEOUT_MS + 10_000);
});
