import type {
  FieldRenderer,
  FieldRendererConstructor,
  FieldRenderOptions,
  FieldValidatorMap,
  FormulateField,
} from "../types.js";

/**
 * Renders a field with the renderer registered for its field type. Returns
 * null (and warns) when no renderer is registered for the type.
 */
export function renderField(
  fieldData: FormulateField,
  fieldRenderers: ReadonlyMap<string, FieldRendererConstructor>,
  fieldValidators: FieldValidatorMap,
  extraOptions: FieldRenderOptions,
): FieldRenderer | null {
  const Renderer = fieldRenderers.get(fieldData.fieldType);
  if (!Renderer) {
    console.warn(
      `Formulate: no renderer is registered for the field type "${fieldData.fieldType}", so the field "${fieldData.alias ?? fieldData.id}" was skipped.`,
    );
    return null;
  }
  const cssClasses = ["formulate__field", `formulate__field--${fieldData.fieldType}`];
  const renderer = new Renderer(fieldData, fieldValidators, cssClasses, extraOptions);
  renderer.stepIndex = extraOptions.stepIndex;
  return renderer;
}
