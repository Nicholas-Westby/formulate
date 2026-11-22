import { UmbActionEventContext } from '@umbraco-cms/backoffice/action';
import { UmbRequestReloadChildrenOfEntityEvent } from '@umbraco-cms/backoffice/entity-action';
import { UmbModalManagerContext, type UmbModalContext } from '@umbraco-cms/backoffice/modal';
import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { UMB_FOLDER_CREATE_MODAL } from '@umbraco-cms/backoffice/tree';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateOptionModel } from '../../api/index.js';
import { createTestHost } from '../../test/test-host.js';
import { FormulateCreateOptionsModalElement } from './create-options-modal.element.js';
import { FORMULATE_CREATE_OPTIONS_MODAL, type FormulateCreateOptionsModalData } from './create-options-modal.token.js';

const FORM_KIND_ID = '3a11bd58-0ac6-43d7-8f63-2f88e7c132af';
const FOLDER_OPTION: CreateOptionModel = { entityType: 'formulate-form-folder', name: 'Folder', icon: 'icon-folder' };
const FORM_OPTION: CreateOptionModel = {
	entityType: 'formulate-form',
	kindId: FORM_KIND_ID,
	name: 'Form with Basic Layout',
	description: 'Creates a form with a preconfigured form layout.',
	icon: 'icon-document',
};
const ROOT = { entityType: 'formulate-forms-root', unique: null };

/**
 * Opens the dialog as the modal manager would, inside a back office host: with a modal context that holds
 * its data and value. Dialogs the dialog opens itself answer with the given values in turn (none: cancelled).
 */
async function openDialog(data: FormulateCreateOptionsModalData, ...dialogAnswers: Array<unknown>) {
	const host = createTestHost();
	new UmbNotificationContext(host);
	const events = new UmbActionEventContext(host);
	const modals = new UmbModalManagerContext(host);
	const modalContext = modals.open(host, FORMULATE_CREATE_OPTIONS_MODAL, { data });
	const open = vi.spyOn(modals, 'open').mockImplementation(() => {
		const answer = dialogAnswers.shift();
		const onSubmit = () => (answer === undefined ? Promise.reject(new Error('Cancelled')) : Promise.resolve(answer));
		return { onSubmit } as unknown as UmbModalContext;
	});
	const reloads: Array<string> = [];
	events.addEventListener(UmbRequestReloadChildrenOfEntityEvent.TYPE, (event) => {
		const reload = event as UmbRequestReloadChildrenOfEntityEvent;
		reloads.push(`${reload.getEntityType()} ${reload.getUnique()}`);
	});

	const element = new FormulateCreateOptionsModalElement();
	element.modalContext = modalContext;
	element.data = modalContext.data;
	host.append(element);
	await element.updateComplete;

	return { element, modalContext, open, reloads, shadow: element.shadowRoot! };
}

/** Whether the dialog was submitted, closed, or is still open shortly after. */
function outcomeOf(modalContext: UmbModalContext<FormulateCreateOptionsModalData, unknown>) {
	return Promise.race([
		modalContext.onSubmit().then(
			() => 'submitted',
			() => 'closed',
		),
		new Promise((resolve) => setTimeout(() => resolve('open'), 20)),
	]);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate create dialog', () => {
	// Without the back office's translations loaded, a term shows as its key and a #key text as it is.
	it("lists each option with its name, description and icon; the folder with Umbraco's own text", async () => {
		const { shadow } = await openDialog({ parent: ROOT, options: [FORM_OPTION, FOLDER_OPTION] });

		const items = [...shadow.querySelectorAll('umb-ref-item')].map((item) => ({
			name: item.getAttribute('name'),
			detail: item.getAttribute('detail'),
			icon: item.getAttribute('icon'),
		}));

		// A name ends with "...", as more is asked once it is picked, as in Umbraco's own create dialog.
		expect(items).toStrictEqual([
			{
				name: 'Form with Basic Layout...',
				detail: 'Creates a form with a preconfigured form layout.',
				icon: 'icon-document',
			},
			{ name: '#create_folder...', detail: null, icon: 'icon-folder' },
		]);
		expect(shadow.querySelector('uui-dialog-layout')?.getAttribute('headline')).toBe('general_create');
	});

	it("links a kind to its workspace's create route, so it can open in a new tab; the folder has no link", async () => {
		const { shadow } = await openDialog({ parent: ROOT, options: [FORM_OPTION, FOLDER_OPTION] });

		const links = [...shadow.querySelectorAll('umb-ref-item')].map((item) => item.getAttribute('href'));

		expect(links).toStrictEqual([
			`section/formulate/workspace/formulate-form/create/parent/formulate-forms-root/null/${FORM_KIND_ID}`,
			null,
		]);
	});

	it('closes and gives back the kind when its link is followed', async () => {
		const { shadow, modalContext } = await openDialog({ parent: ROOT, options: [FORM_OPTION, FOLDER_OPTION] });

		// The click does not bubble: the router's link handler on the window needs SVG classes jsdom lacks.
		shadow.querySelectorAll('umb-ref-item')[0].dispatchEvent(new MouseEvent('click'));

		await expect(modalContext.onSubmit()).resolves.toStrictEqual({ option: FORM_OPTION });
	});

	it("opens Umbraco's folder dialog over this one, and closes once the folder is created", async () => {
		const parent = { entityType: 'formulate-validation-folder', unique: '0b7c1f9e-3a51-4d0a-9a43-6a1e1c6b2f01' };
		const folderOption = { ...FOLDER_OPTION, entityType: 'formulate-validation-folder' };
		const { shadow, modalContext, open, reloads } = await openDialog(
			{ parent, options: [folderOption] },
			{ folder: { unique: 'new-folder' } },
		);

		shadow.querySelector('umb-ref-item')?.dispatchEvent(new CustomEvent('open'));

		await expect(modalContext.onSubmit()).resolves.toStrictEqual({ option: folderOption });
		expect(open.mock.calls.map((call) => [call[1], call[2]])).toStrictEqual([
			[UMB_FOLDER_CREATE_MODAL, { data: { folderRepositoryAlias: 'Formulate.Repository.Folder.Validations', parent } }],
		]);
		// Reloading the parent's children makes the new folder appear, and the parent's caret with it.
		expect(reloads).toStrictEqual([`formulate-validation-folder ${parent.unique}`]);
	});

	it('comes back when the folder dialog is cancelled, as Umbraco does, so something else can be picked', async () => {
		const { shadow, modalContext, open, reloads } = await openDialog({ parent: ROOT, options: [FORM_OPTION, FOLDER_OPTION] });

		shadow.querySelectorAll('umb-ref-item')[1].dispatchEvent(new CustomEvent('open'));

		expect(await outcomeOf(modalContext)).toBe('open');
		expect(open.mock.calls.map((call) => call[1])).toStrictEqual([UMB_FOLDER_CREATE_MODAL]);
		expect(reloads).toStrictEqual([]);
	});

	it('closes without an option when cancelled', async () => {
		const { shadow, modalContext } = await openDialog({ parent: ROOT, options: [FORM_OPTION, FOLDER_OPTION] });

		shadow.querySelector('uui-button[slot="actions"]')?.dispatchEvent(new MouseEvent('click'));

		expect(await outcomeOf(modalContext)).toBe('closed');
	});

	it('says when nothing can be created', async () => {
		const { shadow } = await openDialog({ parent: ROOT, options: [] });

		expect(shadow.querySelector('umb-ref-item')).toBeNull();
		expect(shadow.querySelector('#nothing-to-create')?.textContent?.trim()).toBe('formulate_nothingToCreate');
	});
});
