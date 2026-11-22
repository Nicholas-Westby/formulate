import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import { UMB_ICON_REGISTRY_CONTEXT } from '@umbraco-cms/backoffice/icon';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';

/**
 * Knows the names of the icons the back office has, so an element can show another icon for a kind whose
 * icon it has not got (such as a kind of another package, or a name of Formulate's retired icon font).
 * Umbraco's icon registry takes every name and shows nothing for one it has not got.
 *
 * Until the back office's icons are known, {@link choose} gives no icon: showing one, then another, can leave
 * the first one shown, as the icons load in any order.
 */
export class FormulateIconNames extends UmbControllerBase {
	#host: UmbLitElement;
	#names?: ReadonlySet<string>;

	constructor(host: UmbLitElement) {
		super(host);
		this.#host = host;

		this.consumeContext(UMB_ICON_REGISTRY_CONTEXT, (registry) => {
			this.observe(
				registry?.icons,
				(icons) => {
					this.#names = icons?.length ? new Set(icons.map((icon) => icon.name)) : undefined;
					this.#host.requestUpdate();
				},
				'_formulateObserveIcons',
			);
		});
	}

	/**
	 * The icon to show.
	 * @param icon The icon wanted, such as a kind's icon.
	 * @param fallback The icon to show when the back office has no icon of that name.
	 * @returns The icon, the fallback, or undefined while the back office's icons are not known yet.
	 */
	choose(icon: string | null | undefined, fallback: string): string | undefined {
		if (!this.#names) {
			return undefined;
		}

		return icon && this.#names.has(icon) ? icon : fallback;
	}
}
