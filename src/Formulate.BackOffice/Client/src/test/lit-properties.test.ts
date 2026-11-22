import { customElement, html, LitElement, property } from '@umbraco-cms/backoffice/external/lit';
import { afterEach, describe, expect, it } from 'vitest';

@customElement('formulate-test-reactive-property')
class FormulateTestReactivePropertyElement extends LitElement {
	@property()
	label = 'first';

	override render() {
		return html`${this.label}`;
	}
}

afterEach(() => {
	document.body.replaceChildren();
});

describe('Lit properties in Formulate elements', () => {
	// Lit's decorators put reactive properties on the prototype. If class fields were compiled as real
	// fields (useDefineForClassFields), each instance would hide them and changes would not render.
	it('re-render when a decorated class field changes', async () => {
		const element = new FormulateTestReactivePropertyElement();
		document.body.append(element);
		await element.updateComplete;

		element.label = 'second';
		await element.updateComplete;

		expect(element.shadowRoot?.textContent).toBe('second');
		expect(Object.hasOwn(element, 'label')).toBe(false);
	});
});
