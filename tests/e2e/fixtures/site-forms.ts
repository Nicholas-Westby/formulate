import { randomUUID } from 'node:crypto';
import { expect, type ConsoleMessage, type Page } from '@playwright/test';
import { callManagementApi } from './management-api.ts';

// Forms on pages of the dev site, made through the Management API: the kinds they are made of, a form with a
// Basic layout, a published page that shows it, and what a test watches on that page.

/** The seed's document type (src/Website/Seed), which shows the form its "form" property picks. */
const DOCUMENT_TYPE_ID = '5d3a0b0e-6a43-4a4f-9a3c-1f6f7b0f2a02';

/** A kind of field, as GET definition/form-field gives it. */
export interface FieldKind {
	kindId: string;
	name: string;
	isHidden?: boolean;
	isServerSideOnly?: boolean;
	isLegacy?: boolean;
	defaultConfiguration?: unknown;
}

/** The kinds a form on a page is made of. */
export interface SiteKinds {
	/** The field kinds, by their names in lower case, such as "text" or "date". */
	fields: Record<string, FieldKind>;
	basicLayoutKindId: string;
	formKindId: string;
	templateId: string;
}

/** A field, as the API takes it. */
export interface FormField {
	id: string;
	kindId: string;
	name: string;
	alias: string;
	label: string;
	validations: Array<string>;
	configuration?: unknown;
}

/** A handler, as the API takes it. */
export interface FormHandler {
	id?: string;
	kindId: string;
	name: string;
	alias?: string;
	enabled?: boolean;
	configuration?: unknown;
}

/** A row of a Basic layout: a step, or cells of fields. */
export type LayoutRow = { isStep: boolean; cells: Array<{ columnSpan: number; fields: Array<{ id: string }> }> };

/** Reads the kinds of field, layout, form and template the site has. */
export async function findKinds(page: Page): Promise<SiteKinds> {
	const [fieldKinds, layoutKinds, templates, formOptions] = await Promise.all([
		callManagementApi<Array<FieldKind>>(page, 'GET', '/formulate/definition/form-field'),
		callManagementApi<Array<FieldKind>>(page, 'GET', '/formulate/definition/layout'),
		callManagementApi<Array<{ id: string; isDefault: boolean }>>(page, 'GET', '/formulate/definition/template'),
		callManagementApi<Array<{ entityType: string; kindId?: string; name: string }>>(
			page,
			'GET',
			'/formulate/tree/forms/create-options',
		),
	]);
	const layout = layoutKinds.find((kind) => !kind.isLegacy && /basic/i.test(kind.name));
	const form = formOptions.find((option) => option.entityType === 'formulate-form' && option.name === 'Form');
	const template = templates.find((candidate) => candidate.isDefault) ?? templates[0];
	expect(layout, 'the Basic layout kind exists').toBeTruthy();
	expect(form?.kindId, 'the Forms root offers the plain Form kind').toBeTruthy();
	expect(template, 'a template exists').toBeTruthy();

	return {
		fields: Object.fromEntries(fieldKinds.map((kind) => [kind.name.toLowerCase(), kind])),
		basicLayoutKindId: layout!.kindId,
		formKindId: form!.kindId!,
		templateId: template!.id,
	};
}

/**
 * A field kind by its name.
 * @param kinds The site's kinds.
 * @param name The kind's name, such as Text.
 */
export function fieldKind(kinds: SiteKinds, name: string): FieldKind {
	const kind = kinds.fields[name.toLowerCase()];
	expect(kind, `a ${name} field kind exists`).toBeTruthy();

	return kind!;
}

/** A new field of a kind, with its kind's default configuration unless it is given one. */
export function formField(
	kind: FieldKind,
	name: string,
	alias: string,
	options: { validations?: string[]; configuration?: unknown } = {},
): FormField {
	return {
		id: randomUUID(),
		kindId: kind.kindId,
		name,
		alias,
		label: name,
		validations: options.validations ?? [],
		...(options.configuration ?? kind.defaultConfiguration
			? { configuration: options.configuration ?? kind.defaultConfiguration }
			: {}),
	};
}

/**
 * Makes a form with a Basic layout. Returns their IDs.
 * @param rows The layout's rows; undefined for a layout that places the fields itself.
 */
export async function createForm(
	page: Page,
	kinds: SiteKinds,
	form: { name: string; fields: Array<FormField>; handlers: Array<FormHandler>; rows?: Array<LayoutRow> },
) {
	const formId = randomUUID();
	const layoutId = randomUUID();
	await callManagementApi(page, 'POST', '/formulate/form', {
		id: formId,
		kindId: kinds.formKindId,
		name: form.name,
		fields: form.fields,
		handlers: form.handlers.map((handler) => ({ id: randomUUID(), enabled: true, ...handler })),
	});
	await callManagementApi(page, 'POST', '/formulate/layout', {
		id: layoutId,
		formId,
		kindId: kinds.basicLayoutKindId,
		name: `${form.name} layout`,
		templateId: kinds.templateId,
		configuration: { autoPopulate: form.rows === undefined, rows: form.rows ?? [] },
	});

	return { formId, layoutId };
}

/** Makes a published page of the seeded document type that shows the layout, and returns its ID and path. */
export async function createPage(page: Page, name: string, layoutId: string) {
	const documentType = await callManagementApi<{ defaultTemplate?: { id: string } | null }>(
		page,
		'GET',
		`/document-type/${DOCUMENT_TYPE_ID}`,
	);
	expect(documentType.defaultTemplate?.id, 'the seeded document type has a template').toBeTruthy();
	const id = randomUUID();
	await callManagementApi(page, 'POST', '/document', {
		id,
		parent: null,
		documentType: { id: DOCUMENT_TYPE_ID },
		template: { id: documentType.defaultTemplate!.id },
		values: [{ alias: 'form', value: { id: layoutId }, culture: null, segment: null }],
		variants: [{ culture: null, segment: null, name }],
	});
	await callManagementApi(page, 'PUT', `/document/${id}/publish`, { publishSchedules: [{ culture: null }] });

	return { id, path: `/${name.toLowerCase().replaceAll(' ', '-')}/` };
}

/**
 * Moves the pages and media to the recycle bin and deletes the forms and validations, ignoring what is already
 * gone.
 */
export async function cleanUp(
	page: Page,
	items: { documentIds: string[]; formIds: string[]; validationIds?: string[]; mediaIds?: string[] },
) {
	await openBackOffice(page);
	for (const id of items.documentIds) {
		await callManagementApi(page, 'PUT', `/document/${id}/move-to-recycle-bin`).catch(() => undefined);
	}
	for (const id of items.mediaIds ?? []) {
		await callManagementApi(page, 'PUT', `/media/${id}/move-to-recycle-bin`).catch(() => undefined);
	}
	for (const id of items.formIds) {
		await callManagementApi(page, 'DELETE', `/formulate/form/${id}`).catch(() => undefined);
	}
	for (const id of items.validationIds ?? []) {
		await callManagementApi(page, 'DELETE', `/formulate/validation/${id}`).catch(() => undefined);
	}
}

/**
 * Records a page's console errors and uncaught errors from now on.
 * @returns The errors so far, and a function that stops recording them.
 */
export function recordErrors(page: Page) {
	const problems: string[] = [];
	const onConsole = (message: ConsoleMessage) => {
		if (message.type() === 'error') {
			problems.push(`console: ${message.text()}`);
		}
	};
	const onPageError = (error: Error) => problems.push(`page error: ${error.message}`);
	page.on('console', onConsole);
	page.on('pageerror', onPageError);

	return {
		problems,
		stop: () => {
			page.off('console', onConsole);
			page.off('pageerror', onPageError);
		},
	};
}

/** Records the page's console errors and uncaught errors, and the form's events. */
export async function watchPage(site: Page) {
	const { problems } = recordErrors(site);
	await site.addInitScript(() => {
		const events: Record<string, number> = {};
		(window as unknown as { formulateEvents: Record<string, number> }).formulateEvents = events;
		for (const name of ['formulate form: submit: success', 'formulate form: submit: failure']) {
			document.addEventListener(name, () => {
				events[name] = (events[name] ?? 0) + 1;
			});
		}
	});

	return problems;
}

/** Waits until a new page is published, with its form. */
export async function waitForPage(site: Page, path: string) {
	await expect
		.poll(async () => (await site.request.get(path)).text(), { message: `${path} is published` })
		.toContain('formulate-plain-js-forms');
}

/** Opens the back office, so the Management API can be called from the page. */
export async function openBackOffice(page: Page) {
	await page.goto('/umbraco/section/formulate');
	await expect(page.locator('umb-backoffice-header')).toBeVisible();
}

/** The form's events so far, by name (see watchPage). */
export function formEvents(site: Page) {
	return site.evaluate(() => (window as unknown as { formulateEvents: object }).formulateEvents);
}
