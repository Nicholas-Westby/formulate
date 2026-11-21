/** Renders a row of the form, marked with its step and whether that step is active. */
export function renderRow(stepIndex: number, isActiveStep: boolean): HTMLDivElement {
  const rowElement = document.createElement("div");
  rowElement.classList.add(
    "formulate__row",
    `formulate__row--step-${stepIndex}`,
    `formulate__row--${isActiveStep ? "active" : "inactive"}`,
  );
  return rowElement;
}
