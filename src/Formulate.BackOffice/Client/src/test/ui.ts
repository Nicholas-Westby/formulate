/**
 * Types into a Umbraco UI input as a user does: the input gets the text and announces it.
 * @param input A uui-input (or anything else with a value that reports input events).
 * @param text The input's whole new text.
 */
export function typeInto(input: Element, text: string) {
	(input as HTMLInputElement).value = text;
	input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Clicks a button. The click does not bubble: a bubbling click would reach the back office router,
 * which jsdom cannot follow.
 * @param element The button, such as a uui-button.
 */
export function click(element: Element) {
	element.dispatchEvent(new MouseEvent('click'));
}

/**
 * Presses a key on an element that has the keyboard focus.
 * @param element The focused element.
 * @param key The key, such as ArrowUp.
 */
export function press(element: Element, key: string) {
	element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

/** The values of a set of inputs, in order. */
export function valuesOf(inputs: Iterable<Element>): Array<string> {
	return [...inputs].map((input) => String((input as HTMLInputElement).value ?? ''));
}
