import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { addressesOf, parseEmail, readEmails } from './eml.ts';

/** An email as Umbraco's pickup folder holds it: one HTML part, folded headers, quoted-printable. */
const HTML_EMAIL = [
	'From: forms@example.com',
	'Date: Sun, 22 Nov 2026 08:00:00 +0000',
	'Subject: New enquiry',
	'Message-Id: <ABC123@example.com>',
	'To: team@example.com,',
	' "Ada Lovelace" <ada@example.com>',
	'Cc: undisclosed-recipients:;',
	'MIME-Version: 1.0',
	'Content-Type: text/html; charset=utf-8',
	'Content-Transfer-Encoding: quoted-printable',
	'',
	'Someone wrote in.',
	'<br>',
	'Name: Ada Lovelace<br>A long line that the writer broke with a soft line break here=',
	' and went on. An equals sign: =3D, and caf=C3=A9.',
	'',
].join('\r\n');

test('an email gives its addresses, subject and HTML body, with quoted-printable decoded', () => {
	const email = parseEmail(HTML_EMAIL);

	assert.equal(email.from, 'forms@example.com');
	assert.equal(email.subject, 'New enquiry');
	assert.deepEqual(addressesOf(email.to), ['team@example.com', 'ada@example.com']);
	assert.deepEqual(addressesOf(email.cc), []);
	assert.equal(email.bcc, '');
	assert.equal(email.text, undefined);
	assert.equal(
		email.html,
		'Someone wrote in.\r\n<br>\r\nName: Ada Lovelace<br>A long line that the writer broke with a soft line break here and went on. An equals sign: =, and café.\r\n',
	);
	assert.equal(email.headers['message-id'], '<ABC123@example.com>');
});

test('encoded words in a header are decoded, in Q and in B', () => {
	const email = parseEmail(
		[
			'Subject: =?utf-8?Q?Caf=C3=A9_order?= and =?utf-8?B?ZnLDvGg=?=',
			'Bcc: =?utf-8?Q?Z=C3=B6e?= <zoe@example.com>',
			'Content-Type: text/plain; charset=utf-8',
			'',
			'Plain text.',
		].join('\r\n'),
	);

	assert.equal(email.subject, 'Café order and früh');
	assert.deepEqual(addressesOf(email.bcc), ['zoe@example.com']);
	assert.equal(email.text, 'Plain text.');
});

test('a multipart email gives its text parts, base64 decoded, and the names of its attachments', () => {
	const html = Buffer.from('<p>Hello, Zoë</p>', 'utf8').toString('base64');
	const email = parseEmail(
		[
			'Subject: With a file',
			'Content-Type: multipart/mixed; boundary="=-outer"',
			'',
			'--=-outer',
			'Content-Type: multipart/alternative; boundary=inner',
			'',
			'--inner',
			'Content-Type: text/plain; charset=utf-8',
			'',
			'Hello, Zoe',
			'--inner',
			'Content-Type: text/html; charset=utf-8',
			'Content-Transfer-Encoding: base64',
			'',
			html,
			'--inner--',
			'--=-outer',
			'Content-Type: application/pdf; name=cv.pdf',
			'Content-Disposition: attachment; filename="cv.pdf"',
			'Content-Transfer-Encoding: base64',
			'',
			'JVBERi0=',
			'--=-outer--',
			'',
		].join('\r\n'),
	);

	assert.equal(email.text, 'Hello, Zoe');
	assert.equal(email.html, '<p>Hello, Zoë</p>');
	assert.deepEqual(email.attachments, [{ fileName: 'cv.pdf' }]);
});

test('the emails of a folder are read, each with its file, and a folder that is not there has none', () => {
	// An .eml file and a file that is not an email.
	const folder = join(import.meta.dirname, 'test-data', 'emails');

	const emails = readEmails(folder);

	// Umbraco writes a file as SMTP sends it (MailKit's SmtpDataFilter), so a line that starts with a dot has
	// another dot in front.
	assert.deepEqual(
		emails.map((email) => [email.file, email.subject, email.text]),
		[[join(folder, 'one.eml'), 'From the folder', 'Hello.\r\n...and a line that starts with dots.\r\n']],
	);
	assert.deepEqual(readEmails(join(folder, 'missing')), []);
});
