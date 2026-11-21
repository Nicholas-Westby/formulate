/** Renders a cell that spans the specified number of the 12 grid columns. */
export function renderCell(columnCount: number): HTMLDivElement {
  const cellElement = document.createElement("div");
  cellElement.classList.add("formulate__cell", `formulate__cell--${columnCount}-columns`);
  return cellElement;
}
