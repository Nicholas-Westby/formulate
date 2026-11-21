import type { FormulateField } from "../types";

/** Maps fields by their ID, for quick lookups. */
export function mapFieldsById(fields: readonly FormulateField[]): Map<string, FormulateField> {
  return new Map(fields.map((field) => [field.id, field]));
}
