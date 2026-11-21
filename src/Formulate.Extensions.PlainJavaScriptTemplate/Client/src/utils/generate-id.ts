let idCount = 0;

/** Generates an element ID that is unique on the page (across every form). */
export function generateId(prefix: string): string {
  idCount++;
  return `${prefix}${idCount}`;
}
