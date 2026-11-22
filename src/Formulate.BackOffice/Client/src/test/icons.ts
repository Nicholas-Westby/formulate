import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UMB_ICON_REGISTRY_CONTEXT } from '@umbraco-cms/backoffice/icon';
import { UmbArrayState } from '@umbraco-cms/backoffice/observable-api';

/** The icons the back office has in the tests: Umbraco's own names that Formulate's elements use. */
export const BACK_OFFICE_ICONS = ['icon-document-dashed-line', 'icon-alert', 'icon-autofill', 'icon-lightning', 'icon-edit', 'icon-trash'];

/** Umbraco's icon registry, as far as Formulate reads it: the names of the icons the back office has. */
class FormulateTestIconRegistry extends UmbContextBase {
	readonly icons;

	constructor(host: UmbControllerHost, names: ReadonlyArray<string>) {
		super(host, UMB_ICON_REGISTRY_CONTEXT as never);
		this.icons = new UmbArrayState(
			names.map((name) => ({ name, path: () => Promise.resolve({ default: '' }) })),
			(icon) => icon.name,
		).asObservable();
	}
}

/** Gives a host the icon registry of the back office, with the given icons. */
export function provideIcons(host: UmbControllerHost, names: ReadonlyArray<string> = BACK_OFFICE_ICONS) {
	return new FormulateTestIconRegistry(host, names);
}
