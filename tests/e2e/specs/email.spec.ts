import { randomUUID } from 'node:crypto';
import { expect, test } from '../fixtures/seeded-page.ts';
import {
	cleanUp,
	createForm,
	createPage,
	fieldKind,
	findKinds,
	formEvents,
	formField,
	waitForPage,
	watchPage,
} from '../fixtures/site-forms.ts';
import { addressesOf, readEmails, type Email } from '../support/eml.ts';
import { siteFolderPaths } from '../support/site-environment.ts';

/** The Email handler's kind. */
const EMAIL_KIND_ID = 'a0c06033-cb94-424f-9c03-5b10a420db16';
/** The Designed Email handler's kind. */
const DESIGNED_EMAIL_KIND_ID = '15be7a7d-179d-40a5-9ad0-34b71dac52d4';
/** The built-in sample views (src/Formulate.Extensions.SendEmail/DesignedEmail/EmailViewPaths.cs). */
const SAMPLE_SUBJECT_VIEW = '~/Views/Formulate/Email/Sample (Subject).cshtml';
const SAMPLE_HTML_VIEW = '~/Views/Formulate/Email/Sample (HTML).cshtml';
const SENDER = 'forms@example.com';
const THANK_YOU = 'Thank you, your message was sent.';

/** An Email handler's configuration, as the editor stores it, with the settings a test does not set at their defaults. */
function emailConfiguration(settings: Record<string, unknown>) {
	return {
		senderEmail: SENDER,
		recipients: [],
		recipientFields: [],
		deliveryType: 'to',
		subject: '',
		message: '',
		appendFields: false,
		appendPayload: false,
		excludeFieldLabels: false,
		includeHiddenFields: false,
		fieldsToInclude: [],
		...settings,
	};
}

/** The lines of an Email handler's HTML body, which it separates with <br> (SendEmailContentBuilder). */
function linesOf(sent: Email) {
	return (sent.html ?? '').trimEnd().split(/\r?\n<br>\r?\n/);
}

test.use({ actionTimeout: 15_000 });

test('a submission from a page is emailed to the To, Cc and Bcc recipients with its values, and as a designed email', async ({
	page,
	context,
	seededPage,
	workerSite,
}) => {
	void seededPage;
	test.setTimeout(180_000);
	const { origin } = workerSite;
	const emailFolder = siteFolderPaths(workerSite.folder).email;
	// This test's emails are the ones whose subjects start with it.
	const run = randomUUID().slice(0, 8);

	const kinds = await findKinds(page);
	const name = formField(fieldKind(kinds, 'Text'), 'Name', 'fullName');
	const email = formField(fieldKind(kinds, 'Text'), 'Email', 'email');
	const visit = formField(fieldKind(kinds, 'Date'), 'Visit date', 'visitDate');
	const send = formField(fieldKind(kinds, 'Button'), 'Send', 'send', { configuration: { buttonKind: 'Submit' } });
	const { formId, layoutId } = await createForm(page, kinds, {
		name: 'Email test form',
		fields: [name, email, visit, send],
		handlers: [
			{
				kindId: EMAIL_KIND_ID,
				name: 'Email the team',
				// To the team, and to the address the visitor types in; every value, after the page's URL and name.
				configuration: emailConfiguration({
					recipients: [{ email: 'team@example.com' }],
					recipientFields: [{ id: email.id }],
					deliveryType: 'to',
					subject: `${run} to`,
					message: 'Someone wrote in.',
					appendFields: true,
					appendPayload: true,
				}),
			},
			{
				kindId: EMAIL_KIND_ID,
				name: 'Copy the office',
				// Only the date, without its label.
				configuration: emailConfiguration({
					recipients: [{ email: 'office@example.com' }],
					deliveryType: 'cc',
					subject: `${run} cc`,
					message: 'The visit is on:',
					appendFields: true,
					excludeFieldLabels: true,
					fieldsToInclude: [{ id: visit.id }],
				}),
			},
			{
				kindId: EMAIL_KIND_ID,
				name: 'Tell the archive',
				configuration: emailConfiguration({
					recipients: [{ email: 'archive@example.com' }],
					deliveryType: 'bcc',
					subject: `${run} bcc`,
					// A line that starts with dots, which the pickup file has another dot in front of.
					message: 'A form was sent.\n...and that is all.',
				}),
			},
			{
				kindId: DESIGNED_EMAIL_KIND_ID,
				name: 'Designed email',
				configuration: {
					senderEmail: SENDER,
					recipients: [{ email: 'designed@example.com' }],
					recipientFields: [],
					deliveryType: 'to',
					subject: `${run} designed for {PageName}`,
					message: 'A designed message.',
					subjectRazorPath: SAMPLE_SUBJECT_VIEW,
					htmlEmailRazorPath: SAMPLE_HTML_VIEW,
					textEmailRazorPath: '',
				},
			},
		],
	});
	const created = await createPage(page, 'Email test', layoutId);
	const pageUrl = new URL(created.path, origin).href;
	const site = await context.newPage();
	const problems = await watchPage(site);

	try {
		await waitForPage(site, created.path);
		await site.goto(created.path);
		const form = site.locator('form.formulate__form');
		await form.getByLabel('Name').fill('Ada Lovelace');
		await form.getByLabel('Email').fill('ada@example.com');
		await form.getByLabel('Visit date').fill('2026-03-05');
		await form.getByRole('button', { name: 'Send' }).click();
		// The thank-you is on the page, hidden, until the form is sent.
		await expect(site.locator('#thank-you')).toBeVisible();
		await expect(site.locator('#thank-you')).toHaveText(THANK_YOU);
		expect(await formEvents(site)).toEqual({ 'formulate form: submit: success': 1 });
		expect(problems, 'no console errors').toEqual([]);

		// The handlers run before the submission is answered, so Umbraco has written each email.
		const emails = () => readEmails(emailFolder).filter((candidate) => candidate.subject.startsWith(run));
		await expect.poll(() => emails().length, { message: 'each handler wrote its email' }).toBe(4);
		const bySubject = (subject: string): Email => {
			const found = emails().find((candidate) => candidate.subject === subject);
			expect(found, `an email with the subject "${subject}"`).toBeTruthy();
			return found!;
		};
		const recipients = (sent: Email) => ({
			from: addressesOf(sent.from),
			to: addressesOf(sent.to),
			cc: addressesOf(sent.cc),
			bcc: addressesOf(sent.bcc),
		});

		// To: the team and the visitor. The page comes first, then each value, a date as Formulate 3 wrote it.
		const toTeam = bySubject(`${run} to`);
		expect(recipients(toTeam)).toStrictEqual({ from: [SENDER], to: ['team@example.com', 'ada@example.com'], cc: [], bcc: [] });
		expect(linesOf(toTeam)).toStrictEqual([
			'Someone wrote in.',
			`URL: ${pageUrl}`,
			'Page Name: Email test',
			'Name: Ada Lovelace',
			'Email: ada@example.com',
			'Visit date: March 05, 2026',
		]);

		// Cc: "To" is the empty group Umbraco needs; only the date, without its label.
		const toOffice = bySubject(`${run} cc`);
		expect(recipients(toOffice)).toStrictEqual({ from: [SENDER], to: [], cc: ['office@example.com'], bcc: [] });
		expect(toOffice.to).toMatch(/^undisclosed-recipients:\s*;$/);
		expect(linesOf(toOffice)).toStrictEqual(['The visit is on:', 'March 05, 2026']);

		// Bcc: the message alone, each line of it, as the handler adds no fields.
		const toArchive = bySubject(`${run} bcc`);
		expect(recipients(toArchive)).toStrictEqual({ from: [SENDER], to: [], cc: [], bcc: ['archive@example.com'] });
		expect(linesOf(toArchive)).toStrictEqual(['A form was sent.', '...and that is all.']);

		// Designed: the sample subject names the page, and the sample HTML lists the values by alias.
		const designed = bySubject(`${run} designed for Email test`);
		expect(recipients(designed)).toStrictEqual({ from: [SENDER], to: ['designed@example.com'], cc: [], bcc: [] });
		const html = designed.html ?? '';
		expect(html).toContain('<h2>Submitted Values</h2>');
		expect(html).toContain('A designed message.');
		expect(html).toContain(`<li><strong>URL:</strong> ${pageUrl}</li>`);
		expect(html).toContain('<li><strong>PageName:</strong> Email test</li>');
		expect(html).toContain('<li><strong>fullName:</strong> Ada Lovelace</li>');
		expect(html).toContain('<li><strong>email:</strong> ada@example.com</li>');
		expect(html).toContain('<li><strong>visitDate:</strong> 2026-03-05</li>');
		expect(html).toContain(`The sender ${SENDER} sent this email.`);
		// The built-in sample leaves the recipients out, as they can include Bcc addresses.
		expect(html).not.toContain('designed@example.com');
	} finally {
		await site.close();
		await cleanUp(page, { documentIds: [created.id], formIds: [formId] });
	}
});
