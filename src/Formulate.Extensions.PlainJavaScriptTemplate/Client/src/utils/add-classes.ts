/** Adds CSS classes to an element, skipping empty class names. */
export function addClasses(element: Element, cssClasses: readonly string[]): void {
  for (const cssClass of cssClasses) {
    if (cssClass) {
      element.classList.add(cssClass);
    }
  }
}
