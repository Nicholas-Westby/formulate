import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
} from '../../../test/forms.js';
import { provideIcons } from '../../../test/icons.js';
import { destroyKept, FOLDER_ID, keep } from '../../../test/kind-items.js';
import { loadFormulateEnglishTerms } from '../../../test/localization.js';
import { click, press } from '../../../test/ui.js';
import type { FormulateFormFieldModel } from '../../types.js';
import { FormulateFormWorkspaceContext } from '../form-workspace.context.js';
import { FormulateFormFieldsWorkspaceViewElement } from './form-fields-workspace-view.element.js';
import { FormulateFormHandlersWorkspaceViewElement } from './form-handlers-workspace-view.element.js';

const MANDATORY_ID = '5c2e8a41-7d3b-4f19-a6e0-3b9d1f7c2a03';
const REGEX_ID = '6d3f9b52-8e4c-4a2a-b7f1-4c0e2a8d3b04';

beforeAll(() => {
	registerFormRepositories();
	// The names of the rows' actions and switches; the other terms show as their keys.
	loadFormulateEnglishTerms(['formulate_editItem', 'formulate_deleteItem', 'formulate_enabledItem']);
});

afterEach(() => {
	destroyKept();
	document.body.replaceChildren();
});

/**
 * A view in the workspace of the Contact form, or of a new form when the form is null. The dialogs it
 * opens answer, in turn, with the given values; undefined is a dialog that was closed.
 */
async function openView<T extends FormulateFormFieldsWorkspaceViewElement | FormulateFormHandlersWorkspaceViewElement>(
	view: T,
	answers: Array<unknown> = [],
	form: ReturnType<typeof contactForm> | null = contactForm(),
	icons = true,
) {
	serveForms(form ? [form] : []);
	const { host } = createFormWorkspaceHost();
	if (icons) provideIcons(host);
	const context = keep(new FormulateFormWorkspaceContext(host));
	if (form) {
		await context.load(FORM_ID);
	} else {
		await context.create({ entityType: 'formulate-form-folder', unique: FOLDER_ID }, BASIC_LAYOUT_FORM_KIND);
	}
	const modals = new UmbModalManagerContext(host);
	const opened: Array<{ alias: string; data: unknown }> = [];
	vi.spyOn(modals, 'open').mockImplementation((_host, token, args) => {
		opened.push({ alias: String(token), data: structuredClone((args as { data?: unknown } | undefined)?.data) });
		const answer = answers.shift();
		const onSubmit = () => (answer === undefined ? Promise.reject(new Error('Closed')) : Promise.resolve(answer));
		return { onSubmit } as unknown as UmbModalContext;
	});
	host.append(view);
	await settle(view);

	return { view, context, opened, shadow: view.shadowRoot! };
}

async function settle(element: { updateComplete: Promise<unknown> }) {
	for (let i = 0; i < 4; i++) {
		await element.updateComplete;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

/** Each row the view shows: its icon, name, detail line and tags. */
function rowsOf(shadow: ShadowRoot) {
	return [...shadow.querySelectorAll('.row')].map((row) => {
		const ref = row.querySelector('uui-ref-node')!;
		return {
			icon: ref.querySelector('umb-icon[slot="icon"]')?.getAttribute('name'),
			name: ref.getAttribute('name'),
			detail: ref.getAttribute('detail'),
			tags: [...ref.querySelectorAll('uui-tag')].map((tag) => tag.textContent?.trim()),
		};
	});
}

function rowButton(shadow: ShadowRoot, index: number, label: string) {
	return shadow.querySelectorAll('.row')[index].querySelector(`uui-action-bar uui-button[label="${label}"]`)!;
}

describe('Formulate form Fields view', () => {
	it("shows each field in order: its kind's icon, its name and alias, its kind's name and how many validations it has", async () => {
		const form = contactForm();
		form.fields[0].validations = [MANDATORY_ID, REGEX_ID];
		form.fields.push({ id: 'b18e4a07-3d9f-4c5b-8e2a-9f1c3e5a7b09', kindId: UNKNOWN_KIND, name: null, alias: null, validations: [] });
		const { shadow } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [], form);

		// A kind's icon the back office has not got (the drop down's) shows as a field's icon.
		expect(rowsOf(shadow)).toStrictEqual([
			{ icon: 'icon-document-dashed-line', name: 'Name', detail: 'name', tags: ['Text', 'formulate_validationCount'] },
			{ icon: 'icon-autofill', name: 'State', detail: 'state', tags: ['Drop Down'] },
			{ icon: 'icon-alert', name: 'formulate_unnamed', detail: '', tags: ['formulate_unknownKind'] },
		]);
	});

	it("shows no icons until the back office's icons are known, so none shows in place of another", async () => {
		const { shadow } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [], contactForm(), false);

		expect(rowsOf(shadow).map((row) => [row.name, row.icon])).toStrictEqual([
			['Name', undefined],
			['State', undefined],
		]);
	});

	it('asks for the kind of a new field, then opens its dialog with a new field of that kind', async () => {
		const { shadow, view, context, opened } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [
			{ kindId: HEADER },
		]);

		click(shadow.querySelector('uui-button#add')!);
		await settle(view);

		const [pick, edit] = opened;
		expect(pick.alias).toBe('Formulate.Modal.PickKind');
		expect(pick.data).toStrictEqual({
			headline: 'formulate_addField',
			kinds: [
				{ kindId: TEXT, name: 'Text', icon: 'icon-document-dashed-line', category: 'Inputs' },
				{ kindId: DROP_DOWN, name: 'Drop Down', icon: 'icon-autofill', category: 'Inputs' },
				{ kindId: HEADER, name: 'Header', icon: 'icon-autofill', category: 'Content' },
				{ kindId: 'cde8565c-5e92-4112-9a1f-7ffa1940c53c', name: 'Button', icon: 'icon-autofill', category: 'Actions' },
			],
		});
		expect(edit.alias).toBe('Formulate.Modal.EditField');
		const newField = (edit.data as { field: FormulateFormFieldModel }).field;
		expect(edit.data).toStrictEqual({
			field: {
				id: newField.id,
				kindId: HEADER,
				name: null,
				alias: null,
				label: null,
				category: null,
				validations: [],
				configuration: { text: null },
			},
			isNew: true,
			formFields: structuredClone(context.getFields()),
			formId: FORM_ID,
		});
		// The dialog was closed, so nothing was added.
		expect(context.getFields().map((field) => field.id)).toStrictEqual([FIELD_ID, OTHER_FIELD_ID]);
	});

	it('gives the dialogs of a new form no form ID until the form is saved, as the server has no such form', async () => {
		const { shadow, view, context, opened } = await openView(
			new FormulateFormFieldsWorkspaceViewElement(),
			[{ kindId: HEADER }, undefined, { kindId: HEADER }],
			null,
		);

		click(shadow.querySelector('uui-button#add')!);
		await settle(view);
		context.setName('Contact');
		await context.requestSubmit();
		click(shadow.querySelector('uui-button#add')!);
		await settle(view);

		const [, unsaved, , saved] = opened.map((modal) => modal.data as Record<string, unknown>);
		expect([unsaved.formFields, 'formId' in unsaved, saved.formId]).toStrictEqual([[], false, context.getUnique()]);
	});

	it('adds the field its dialog gives back', async () => {
		const header = {
			id: 'c29f5b18-4e0a-4d6c-9f3b-0a2d4f6b8c10',
			kindId: HEADER,
			name: 'Intro',
			alias: 'intro',
			label: null,
			category: null,
			validations: [],
			configuration: { text: 'Hello' },
		};
		const { shadow, view, context } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [
			{ kindId: HEADER },
			{ field: header },
		]);

		click(shadow.querySelector('uui-button#add')!);
		await settle(view);

		expect(context.getFields().map((field) => field.id)).toStrictEqual([FIELD_ID, OTHER_FIELD_ID, header.id]);
		expect(context.getFields()[2]).toStrictEqual(header);
		expect(rowsOf(shadow)[2]).toStrictEqual({ icon: 'icon-autofill', name: 'Intro', detail: 'intro', tags: ['Header'] });
		expect(context.getHasUnpersistedChanges()).toBe(true);
	});

	it('adds nothing, and opens no field dialog, when no kind is picked', async () => {
		const { shadow, view, context, opened } = await openView(new FormulateFormFieldsWorkspaceViewElement(), []);

		click(shadow.querySelector('uui-button#add')!);
		await settle(view);

		expect(opened.map((modal) => modal.alias)).toStrictEqual(['Formulate.Modal.PickKind']);
		expect(context.getHasUnpersistedChanges()).toBe(false);
	});

	it('edits a field in its dialog, from its Edit button or its name, and keeps it in its place', async () => {
		const { shadow, view, context, opened } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [
			undefined,
			{ field: { ...structuredClone(contactForm().fields[0]), configuration: undefined, label: 'Full name' } },
		]);

		click(rowButton(shadow, 0, 'general_edit'));
		await settle(view);
		expect(opened[0]).toStrictEqual({
			alias: 'Formulate.Modal.EditField',
			data: {
				field: { id: FIELD_ID, kindId: TEXT, name: 'Name', alias: 'name', label: 'Your name', category: null, validations: [] },
				isNew: false,
				formFields: structuredClone(context.getFields()),
				formId: FORM_ID,
			},
		});
		// Closed: nothing changed.
		expect(context.getHasUnpersistedChanges()).toBe(false);

		shadow.querySelectorAll('.row uui-ref-node')[0].dispatchEvent(new CustomEvent('open'));
		await settle(view);

		expect(opened.length).toBe(2);
		expect(context.getFields().map((field) => [field.id, field.label])).toStrictEqual([
			[FIELD_ID, 'Full name'],
			[OTHER_FIELD_ID, 'Your state'],
		]);
		expect(context.getHasUnpersistedChanges()).toBe(true);
	});

	it("names each row's Edit and Delete after its field, keeping what they show", async () => {
		const form = contactForm();
		form.fields[1].name = null;
		const { shadow } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [], form);

		const names = [...shadow.querySelectorAll('.row')].map((row) =>
			[...row.querySelectorAll('uui-action-bar uui-button')].map((button) => [
				button.getAttribute('label'),
				button.getAttribute('aria-label'),
				button.querySelector('uui-icon')?.getAttribute('name'),
			]),
		);
		expect(names).toStrictEqual([
			[
				['general_edit', 'Edit Name', 'icon-edit'],
				['general_delete', 'Delete Name', 'icon-trash'],
			],
			[
				['general_edit', 'Edit item 2', 'icon-edit'],
				['general_delete', 'Delete item 2', 'icon-trash'],
			],
		]);
	});

	it('asks before deleting a field, and deletes it only when that is confirmed', async () => {
		const { shadow, view, context, opened } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [undefined, {}]);

		click(rowButton(shadow, 1, 'general_delete'));
		await settle(view);
		expect(context.getFields().length).toBe(2);

		click(rowButton(shadow, 1, 'general_delete'));
		await settle(view);

		expect(opened.map((modal) => modal.alias)).toStrictEqual(['Umb.Modal.Confirm', 'Umb.Modal.Confirm']);
		expect(opened[0].data).toMatchObject({ headline: 'formulate_deleteField', color: 'danger', confirmLabel: 'general_delete' });
		expect(context.getFields().map((field) => field.id)).toStrictEqual([FIELD_ID]);
		expect(rowsOf(shadow).map((row) => row.name)).toStrictEqual(['Name']);
	});

	it('moves a field with the keyboard, keeping the focus on its handle', async () => {
		const { shadow, view, context } = await openView(new FormulateFormFieldsWorkspaceViewElement());
		const handle = shadow.querySelector<HTMLElement>(`.row[data-key="${FIELD_ID}"] .handle`)!;

		handle.focus();
		press(handle, 'ArrowDown');
		await settle(view);

		expect(context.getFields().map((field) => field.id)).toStrictEqual([OTHER_FIELD_ID, FIELD_ID]);
		expect(rowsOf(shadow).map((row) => row.name)).toStrictEqual(['State', 'Name']);
		expect(shadow.activeElement).toBe(shadow.querySelector(`.row[data-key="${FIELD_ID}"] .handle`));
		expect(shadow.querySelector('#announcement')?.textContent).toBe('formulate_itemMoved');
	});

	it('shows only Add for a form without fields, with the list there for the sorter to find', async () => {
		const errors: Array<unknown> = [];
		const onError = (event: ErrorEvent) => errors.push(event.error);
		window.addEventListener('error', onError);
		const form = { ...contactForm(), fields: [] };

		try {
			const { shadow } = await openView(new FormulateFormFieldsWorkspaceViewElement(), [], form);
			// The sorter looks for its list in the next animation frame after the view is shown.
			await new Promise((resolve) => requestAnimationFrame(resolve));
			await new Promise((resolve) => requestAnimationFrame(resolve));

			expect([rowsOf(shadow), shadow.querySelector('#rows') !== null, shadow.querySelector('uui-button#add')?.getAttribute('label')]).toStrictEqual([
				[],
				true,
				'formulate_addField',
			]);
			// Empty, so its styles hide it and it takes no room above Add.
			expect(shadow.querySelector('#rows')?.matches(':empty')).toBe(true);
			expect(errors).toStrictEqual([]);
		} finally {
			window.removeEventListener('error', onError);
		}
	});

	it('shows the changes of the form, such as discarded ones, as they happen', async () => {
		const { shadow, view, context } = await openView(new FormulateFormFieldsWorkspaceViewElement());

		context.removeField(FIELD_ID);
		await settle(view);

		expect(rowsOf(shadow).map((row) => row.name)).toStrictEqual(['State']);
	});
});

describe('Formulate form Handlers view', () => {
	it("shows each handler with its kind's icon and name, and whether it is enabled", async () => {
		const form = contactForm();
		form.handlers.push({ id: 'd3a0c629-5f1b-4e7d-8a4c-1b3e5a7c9d11', kindId: STORE_DATA, name: 'Backup', alias: null, enabled: false });
		const { shadow } = await openView(new FormulateFormHandlersWorkspaceViewElement(), [], form);

		expect(rowsOf(shadow)).toStrictEqual([
			{ icon: 'icon-lightning', name: 'Store', detail: 'store', tags: ['Store Data'] },
			{ icon: 'icon-lightning', name: 'Backup', detail: '', tags: ['Store Data'] },
		]);
		expect([...shadow.querySelectorAll<HTMLInputElement>('.row uui-toggle')].map((toggle) => toggle.checked)).toStrictEqual([true, false]);
	});

	it("names each handler's switch after the handler, keeping Enabled as what it shows", async () => {
		const form = contactForm();
		form.handlers.push({ id: 'd3a0c629-5f1b-4e7d-8a4c-1b3e5a7c9d11', kindId: STORE_DATA, name: null, alias: null, enabled: false });
		const { shadow } = await openView(new FormulateFormHandlersWorkspaceViewElement(), [], form);

		const toggles = [...shadow.querySelectorAll('.row uui-toggle')];
		expect(toggles.map((toggle) => [toggle.getAttribute('label'), toggle.getAttribute('aria-label')])).toStrictEqual([
			['formulate_enabled', 'Enabled: Store'],
			['formulate_enabled', 'Enabled: item 2'],
		]);
		expect(rowButton(shadow, 0, 'general_edit').getAttribute('aria-label')).toBe('Edit Store');
	});

	it('switches a handler on and off from its row', async () => {
		const { shadow, view, context } = await openView(new FormulateFormHandlersWorkspaceViewElement());
		const toggle = shadow.querySelector<HTMLInputElement>('.row uui-toggle')!;

		toggle.checked = false;
		toggle.dispatchEvent(new Event('change'));
		await settle(view);

		expect(context.getHandlers()[0].enabled).toBe(false);
		expect(context.getHasUnpersistedChanges()).toBe(true);
	});

	it('adds a handler of the picked kind with what its dialog gives back', async () => {
		const handler = { id: 'e4b1d73a-6a2c-4f8e-9b5d-2c4f6b8d0e12', kindId: STORE_DATA, name: 'Archive', alias: 'archive', enabled: true };
		const { shadow, view, context, opened } = await openView(new FormulateFormHandlersWorkspaceViewElement(), [
			{ kindId: STORE_DATA },
			{ handler },
		]);

		click(shadow.querySelector('uui-button#add')!);
		await settle(view);

		expect(opened.map((modal) => modal.alias)).toStrictEqual(['Formulate.Modal.PickKind', 'Formulate.Modal.EditHandler']);
		expect(opened[0].data).toStrictEqual({
			headline: 'formulate_addHandler',
			kinds: [{ kindId: STORE_DATA, name: 'Store Data', icon: 'icon-lightning', category: 'Persistence' }],
		});
		const given = (opened[1].data as { handler: { id: string } }).handler;
		expect(opened[1].data).toStrictEqual({
			handler: { id: given.id, kindId: STORE_DATA, name: null, alias: null, enabled: true },
			isNew: true,
			formFields: structuredClone(context.getFields()),
			formId: FORM_ID,
		});
		expect(context.getHandlers().map((candidate) => candidate.id)).toStrictEqual([HANDLER_ID, handler.id]);
	});

	it('edits and deletes a handler', async () => {
		const { shadow, view, context } = await openView(new FormulateFormHandlersWorkspaceViewElement(), [
			{ handler: { id: HANDLER_ID, kindId: STORE_DATA, name: 'Keep', alias: 'store', enabled: true } },
			{},
		]);

		click(rowButton(shadow, 0, 'general_edit'));
		await settle(view);
		expect(context.getHandlers()[0].name).toBe('Keep');

		click(rowButton(shadow, 0, 'general_delete'));
		await settle(view);
		expect(context.getHandlers()).toStrictEqual([]);
	});
});
