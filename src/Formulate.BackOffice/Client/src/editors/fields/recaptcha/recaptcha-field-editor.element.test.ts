import { UmbNotificationContext } from '@umbraco-cms/backoffice/notification';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormulateDefinitionsContext } from '../../../core/definitions.context.js';
import { createDefinitionsHost, renderEditor, settle } from '../../../test/editors.js';
import { fakeApi, jsonResponse } from '../../../test/fake-api.js';
import { CONFIG, serveForms } from '../../../test/forms.js';
import { API } from '../../../test/kind-items.js';
import { SERVER_CONSTANTS } from '../../../test/server-constants.js';
import { createTestHost } from '../../../test/test-host.js';
import { FormulateButtonFieldEditorElement } from '../button/button-field-editor.element.js';
import { manifests } from '../manifests.js';
import { FormulateRecaptchaFieldEditorElement } from './recaptcha-field-editor.element.js';

// RecaptchaFieldDefinition stores no configuration: the keys are the site's settings (Formulate:Recaptcha), and a
// stored value, such as one Formulate 3 wrote, is ignored. The editor says whether this site has both keys set, as
// Formulate's configuration (GET formulate/config, recaptchaConfigured) tells it.

/** Shows the editor in a host, and records the values it stores. */
async function render(value: unknown, host?: HTMLElement) {
	const { element, changes, shadow } = await renderEditor(new FormulateRecaptchaFieldEditorElement(), value, { host });

	return {
		element,
		changes,
		layout: shadow.querySelector('umb-property-layout'),
		notice: shadow.querySelector('#notice'),
		status: shadow.querySelector('#status'),
		inputs: shadow.querySelectorAll('input, textarea, select, uui-input, uui-textarea, uui-select, uui-toggle'),
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Formulate reCAPTCHA field editor', () => {
	it("is the editor of the server's reCAPTCHA field, by the editor alias its definition gives", () => {
		const manifest = manifests.find(({ alias }) => alias === 'Formulate.FieldEditor.Recaptcha') as { meta: { editorAlias: string } } | undefined;

		expect(manifest?.meta.editorAlias).toBe(SERVER_CONSTANTS.recaptchaField.EditorAlias);
	});

	it('says that this site does not have both keys set, so the field rejects every submission, and which settings hold them', async () => {
		serveForms([], undefined, { ...CONFIG, recaptchaConfigured: false });

		const { layout, notice, status, inputs, changes } = await render(null);

		// Without the back office's translations loaded, a term shows as its key.
		expect(notice?.textContent?.trim()).toBe('formulate_recaptchaKeysNotSet');
		expect(notice?.getAttribute('role')).toBe('note');
		expect(status).toBeNull();
		expect([layout?.getAttribute('label'), layout?.getAttribute('description')]).toStrictEqual([
			'formulate_recaptchaKeys',
			'formulate_recaptchaKeysDescription',
		]);
		// There is nothing to set, and showing the editor stores nothing.
		expect(inputs).toHaveLength(0);
		expect(changes).toStrictEqual([]);
	});

	it('says that both keys are set when they are', async () => {
		serveForms([], undefined, { ...CONFIG, recaptchaConfigured: true });

		const { notice, status } = await render(null);

		expect(status?.textContent?.trim()).toBe('formulate_recaptchaKeysSet');
		expect(notice).toBeNull();
	});

	it('says nothing about the keys while it cannot know, such as when the configuration cannot be read', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		fakeApi(() => jsonResponse({ title: 'Server error', status: 500, detail: 'The configuration could not be read.' }, 500));
		const host = createTestHost();
		new UmbNotificationContext(host);
		new FormulateDefinitionsContext(host);

		const { layout, notice, status } = await render(null, host);

		expect([notice, status]).toStrictEqual([null, null]);
		expect(layout?.getAttribute('description')).toBe('formulate_recaptchaKeysDescription');
	});

	it('leaves a stored configuration as it is, such as one Formulate 3 wrote', async () => {
		serveForms();
		const stored = { siteKey: 'written by Formulate 3' };

		const { element, changes } = await render(stored);

		expect(element.value).toBe(stored);
		expect(changes).toStrictEqual([]);
	});

	it("reads Formulate's configuration through the definitions context, which reads it once for every editor", async () => {
		const requests = serveForms();
		const host = createDefinitionsHost();

		await render(null, host);
		await render(null, host);
		const button = new FormulateButtonFieldEditorElement();
		host.append(button);
		await settle(button);

		expect(requests.filter((request) => new URL(request.url).pathname === `${API}/config`)).toHaveLength(1);
	});
});
