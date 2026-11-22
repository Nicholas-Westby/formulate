import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';

/** An element that hosts controllers, data sources and contexts in a test, as a back office element would. */
export class FormulateTestHostElement extends UmbElementMixin(HTMLElement) {}

if (!customElements.get('formulate-test-host')) {
	customElements.define('formulate-test-host', FormulateTestHostElement);
}

/** Creates a test host attached to the document. */
export function createTestHost(): FormulateTestHostElement {
	const host = new FormulateTestHostElement();
	document.body.append(host);
	return host;
}
