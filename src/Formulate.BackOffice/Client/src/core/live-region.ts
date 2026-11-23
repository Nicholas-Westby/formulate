import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbLitElement } from '@umbraco-cms/backoffice/lit-element';

/**
 * The text of a live region (role="status", or aria-live), which screen readers read out when it changes. Some
 * screen readers say nothing when a region is given the text it has already, such as when the same keyboard move is
 * made twice in a row. So each message empties the region first, and is put in it on the next frame. The host shows
 * {@link text} in the region, which is always in the page.
 */
export class FormulateLiveRegion extends UmbControllerBase {
	#host: UmbLitElement;
	#text = '';
	#frame?: number;

	constructor(host: UmbLitElement) {
		super(host);
		this.#host = host;
	}

	/** What the region says now. */
	get text(): string {
		return this.#text;
	}

	/**
	 * Says a message, even one the region says already. Of two messages in one frame, only the last is said.
	 * @param message The message; an empty one empties the region.
	 */
	say(message: string) {
		this.#cancel();
		this.#show('');

		if (message) {
			this.#frame = requestAnimationFrame(() => {
				this.#frame = undefined;
				this.#show(message);
			});
		}
	}

	override hostDisconnected() {
		super.hostDisconnected();
		// Taken out of the page, it has no one to say it to.
		this.#cancel();
	}

	#cancel() {
		if (this.#frame !== undefined) {
			cancelAnimationFrame(this.#frame);
			this.#frame = undefined;
		}
	}

	#show(text: string) {
		if (text !== this.#text) {
			this.#text = text;
			this.#host.requestUpdate();
		}
	}
}
