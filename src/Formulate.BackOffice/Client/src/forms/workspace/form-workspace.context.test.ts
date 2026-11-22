import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FormResponseModel } from '../../api/index.js';
import { jsonResponse } from '../../test/fake-api.js';
import {
	BASIC_LAYOUT_FORM_KIND,
	contactForm,
	createFormWorkspaceHost,
	DROP_DOWN,
	FIELD_ID,
	FORM_ID,
	HANDLER_ID,
	HEADER,
	OTHER_FIELD_ID,
	registerFormRepositories,
	serveForms,
	STORE_DATA,
	TEXT,
	UNKNOWN_KIND,
} from '../../test/forms.js';
import { API, describeSaves, destroyKept, FOLDER_ID, getMessages, keep } from '../../test/kind-items.js';
import { newFormField, newFormHandler } from '../form-items.js';
import type { FormulateFormFieldModel } from '../types.js';
import { FormulateFormWorkspaceContext } from './form-workspace.context.js';

beforeAll(registerFormRepositories);

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

/** A workspace with the Contact form loaded, and the requests sent to the API. */
async function openContactForm(form: FormResponseModel = contactForm()) {
	const requests = serveForms([form]);
	const workspaceHost = createFormWorkspaceHost();
	const context = keep(new FormulateFormWorkspaceContext(workspaceHost.host));
	await context.load(FORM_ID);

	return { ...workspaceHost, context, requests };
}

/** The IDs of the fields the workspace observes, in order. */
function observedFieldIds(context: FormulateFormWorkspaceContext) {
	let ids: Array<string> = [];
	context.fields.subscribe((fields) => (ids = fields.map((field) => field.id))).unsubscribe();
	return ids;
}

/** A copy of a field, as the field's dialog gives it back. */
function copyOf(field: FormulateFormFieldModel | undefined): FormulateFormFieldModel {
	return structuredClone(field!);
}

describe('Formulate form workspace, creating a form', () => {
	it('starts a form of the kind it is asked for, with no fields or handlers', async () => {
		serveForms();
		const { host } = createFormWorkspaceHost();
		const context = keep(new FormulateFormWorkspaceContext(host));

		await context.create({ entityType: 'formulate-form-folder', unique: FOLDER_ID }, BASIC_LAYOUT_FORM_KIND);

		expect(context.getData()).toStrictEqual({
			entityType: 'formulate-form',
			unique: context.getUnique(),
			name: '',
			alias: null,
			kindId: BASIC_LAYOUT_FORM_KIND,
			fields: [],
			handlers: [],
		});
		expect(context.getHasUnpersistedChanges()).toBe(false);
	});

	it("sends the kind with the form's fields and handlers, and reloads the folder it is created in", async () => {
		const requests = serveForms();
		const { host, reloadedChildren } = createFormWorkspaceHost();
		const context = keep(new FormulateFormWorkspaceContext(host));
		await context.create({ entityType: 'formulate-form-folder', unique: FOLDER_ID }, BASIC_LAYOUT_FORM_KIND);
		const unique = context.getUnique();
		const field = { ...newFormField({ kindId: TEXT }), name: 'Name', alias: 'name' };
		const handler = newFormHandler({ kindId: STORE_DATA });

		context.setName('Contact');
		context.setAlias('contact');
		context.addField(field);
		context.addHandler(handler);
		await context.requestSubmit();

		expect(await describeSaves(requests)).toStrictEqual([
			[
				`POST ${API}/form`,
				{
					id: unique,
					parentId: FOLDER_ID,
					kindId: BASIC_LAYOUT_FORM_KIND,
					name: 'Contact',
					alias: 'contact',
					fields: [
						{ id: field.id, kindId: TEXT, name: 'Name', alias: 'name', label: null, category: null, validations: [] },
					],
					handlers: [{ id: handler.id, kindId: STORE_DATA, name: null, alias: null, enabled: true }],
				},
			],
		]);
		// The new form shows in its folder; a Basic Layout form shows with its layout under it.
		expect(reloadedChildren).toContain(`formulate-form-folder ${FOLDER_ID}`);
	});
});

describe('Formulate form workspace, editing the fields', () => {
	it('shows the fields and handlers of the form it opens, with nothing changed yet', async () => {
		const { context } = await openContactForm();

		expect(observedFieldIds(context)).toStrictEqual([FIELD_ID, OTHER_FIELD_ID]);
		expect(context.getHandlers().map((handler) => handler.id)).toStrictEqual([HANDLER_ID]);
		expect(context.getHasUnpersistedChanges()).toBe(false);
	});

	it('marks an added field as a change, and saves it after the others', async () => {
		const { context, requests } = await openContactForm();
		const header = { ...newFormField({ kindId: HEADER, defaultConfiguration: { text: null } }), name: 'Intro' };

		context.addField(header);

		expect(context.getHasUnpersistedChanges()).toBe(true);
		expect(observedFieldIds(context)).toStrictEqual([FIELD_ID, OTHER_FIELD_ID, header.id]);

		await context.requestSubmit();

		const [[, body]] = await describeSaves(requests);
		expect(body.fields.map((field: { id: string }) => field.id)).toStrictEqual([FIELD_ID, OTHER_FIELD_ID, header.id]);
		expect(body.fields[2]).toStrictEqual({
			id: header.id,
			kindId: HEADER,
			name: 'Intro',
			alias: null,
			label: null,
			category: null,
			validations: [],
			configuration: { text: null },
		});
		expect(context.getHasUnpersistedChanges()).toBe(false);
	});

	it('marks an edited field as a change, in its place', async () => {
		const { context, requests } = await openContactForm();
		const edited = { ...copyOf(context.getFields()[0]), label: 'Full name', validations: ['5c2e8a41-7d3b-4f19-a6e0-3b9d1f7c2a03'] };

		context.updateField(edited);

		expect(context.getHasUnpersistedChanges()).toBe(true);
		await context.requestSubmit();
		const [[, body]] = await describeSaves(requests);
		expect(body.fields[0]).toStrictEqual({
			id: FIELD_ID,
			kindId: TEXT,
			name: 'Name',
			alias: 'name',
			label: 'Full name',
			category: null,
			validations: ['5c2e8a41-7d3b-4f19-a6e0-3b9d1f7c2a03'],
		});
		expect(body.fields[1].id).toBe(OTHER_FIELD_ID);
	});

	it('changes nothing when a field comes back from its dialog as it was, whatever the order of its parts', async () => {
		const { context } = await openContactForm();
		const { configuration, validations, category, label, alias, name, kindId, id } = copyOf(context.getFields()[1]);

		context.updateField({ configuration, validations, category, label, alias, name, kindId, id });

		expect(context.getHasUnpersistedChanges()).toBe(false);
	});

	it('marks a removed field as a change, and saves the form without it', async () => {
		const { context, requests } = await openContactForm();

		context.removeField(FIELD_ID);

		expect(context.getHasUnpersistedChanges()).toBe(true);
		expect(observedFieldIds(context)).toStrictEqual([OTHER_FIELD_ID]);
		await context.requestSubmit();
		const [[, body]] = await describeSaves(requests);
		expect(body.fields.map((field: { id: string }) => field.id)).toStrictEqual([OTHER_FIELD_ID]);
	});

	it('marks a new order of the fields as a change, and none once they are back in their first order', async () => {
		const { context, requests } = await openContactForm();
		const [first, second] = context.getFields();

		context.setFields([second, first]);

		expect(context.getHasUnpersistedChanges()).toBe(true);
		expect(observedFieldIds(context)).toStrictEqual([OTHER_FIELD_ID, FIELD_ID]);

		context.setFields([first, second]);
		expect(context.getHasUnpersistedChanges()).toBe(false);

		context.setFields([second, first]);
		await context.requestSubmit();
		const [[, body]] = await describeSaves(requests);
		expect(body.fields.map((field: { id: string }) => field.id)).toStrictEqual([OTHER_FIELD_ID, FIELD_ID]);
	});

	it('moves a field to another place', async () => {
		const { context } = await openContactForm();

		context.moveField(FIELD_ID, 1);

		expect(observedFieldIds(context)).toStrictEqual([OTHER_FIELD_ID, FIELD_ID]);
		expect(context.getHasUnpersistedChanges()).toBe(true);
	});

	it('sends fields and handlers of unknown kinds back as they came, with all of their configuration', async () => {
		const form = contactForm();
		const unknownField = {
			id: '9d1f3b5c-7e9a-4b2d-8f4a-6c8e0a2c4e05',
			kindId: UNKNOWN_KIND,
			name: 'Signature',
			alias: 'signature',
			label: 'Sign here',
			category: null,
			validations: [],
			configuration: { pen: { width: 2, colors: ['#000', '#00f'] }, hint: null },
		};
		const unknownHandler = { id: '8c0e2a4b-6d8f-4a1c-9e3b-5d7f9b1d3f06', kindId: UNKNOWN_KIND, name: 'CRM', alias: 'crm', enabled: false, configuration: [1, 'two'] };
		form.fields.push(unknownField);
		form.handlers.push(unknownHandler);
		const { context, requests } = await openContactForm(form);

		context.setName('Contact us');
		await context.requestSubmit();

		const [[, body]] = await describeSaves(requests);
		expect(body.fields[2]).toStrictEqual(unknownField);
		expect(body.handlers[1]).toStrictEqual(unknownHandler);
	});
});

describe('Formulate form workspace, editing the handlers', () => {
	it('marks an added, edited, switched off or removed handler as a change', async () => {
		const { context, requests } = await openContactForm();
		const added = newFormHandler({ kindId: STORE_DATA });

		context.addHandler(added);
		expect(context.getHasUnpersistedChanges()).toBe(true);

		context.updateHandler({ ...structuredClone(context.getHandlers()[0]), name: 'Store it' });
		context.setHandlerEnabled(added.id, false);
		await context.requestSubmit();

		const [[, body]] = await describeSaves(requests);
		expect(body.handlers).toStrictEqual([
			{ id: HANDLER_ID, kindId: STORE_DATA, name: 'Store it', alias: 'store', enabled: true },
			{ id: added.id, kindId: STORE_DATA, name: null, alias: null, enabled: false },
		]);

		context.removeHandler(HANDLER_ID);
		expect(context.getHasUnpersistedChanges()).toBe(true);
		expect(context.getHandlers().map((handler) => handler.id)).toStrictEqual([added.id]);
	});

	it('changes nothing when a handler is switched to the state it is in', async () => {
		const { context } = await openContactForm();

		context.setHandlerEnabled(HANDLER_ID, true);

		expect(context.getHasUnpersistedChanges()).toBe(false);
	});

	it('marks a new order of the handlers as a change', async () => {
		const form = contactForm();
		form.handlers.push({ id: '3e9a1c5b-7d2f-4e8a-b0c4-6f8a0c2e4a07', kindId: STORE_DATA, name: 'Second', alias: 'second', enabled: true, configuration: null });
		const { context } = await openContactForm(form);
		const [first, second] = context.getHandlers();

		context.setHandlers([second, first]);

		expect(context.getHandlers().map((handler) => handler.name)).toStrictEqual(['Second', 'Store']);
		expect(context.getHasUnpersistedChanges()).toBe(true);
	});
});

describe('Formulate form workspace, saving', () => {
	it('shows a problem the API reports for the alias on the alias', async () => {
		const problem = {
			type: 'Error',
			title: 'Invalid request',
			status: 400,
			detail: 'alias: The alias is used by another form.',
			field: 'alias',
		};
		serveForms([contactForm()], () => jsonResponse(problem, 400));
		const { host } = createFormWorkspaceHost();
		const context = keep(new FormulateFormWorkspaceContext(host));
		await context.load(FORM_ID);

		await expect(context.requestSubmit()).rejects.toBeDefined();

		expect(await getMessages(host)).toContainEqual({ type: 'server', path: '$.alias', body: 'The alias is used by another form.' });
	});

	it('stores an empty alias as none', async () => {
		const { context } = await openContactForm();

		context.setAlias('');

		expect(context.getAlias()).toBeNull();
	});

	it('keeps the kinds of the fields it shows', async () => {
		const { context } = await openContactForm();

		expect(context.getFields().map((field) => field.kindId)).toStrictEqual([TEXT, DROP_DOWN]);
	});
});
