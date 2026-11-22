import { getPageState } from "./page-state.js";

/**
 * Generates an element ID that is unique on the page: across every form, and
 * across every copy of the renderer (the readable and the minified files).
 */
export function generateId(prefix: string): string {
  const state = getPageState();
  state.lastId++;
  return `${prefix}${state.lastId}`;
}
